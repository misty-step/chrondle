"""Native web train. Adapted from Overmind scripts/train.py at 49d98c2.

No backend deployment or accepted-data writes. Credentials are read only after
credential-free build/verification exits. Invoke from a trusted source checkout.
"""
import argparse

from enum import Enum, auto
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

PROVIDER = "https://api.cloudflare.com/client/v4"
HOSTS = ("https://chrondle.mistystep.io", "https://chrondle.app", "https://www.chrondle.app")
PUBLIC_KEYS = {"NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
               "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST", "NEXT_PUBLIC_POSTHOG_ENVIRONMENT"}


class State(Enum):
    SELECTED = auto()
    VERIFIED = auto()
    PROMOTING = auto()
    RECOVERING = auto()
    DONE = auto()
    FAILED = auto()


class Event(Enum):
    BUILD_OK = auto()
    VERIFY_ONLY = auto()
    RELEASE = auto()
    SMOKE_OK = auto()
    SMOKE_FAILED = auto()
    RECOVERED = auto()
    ERROR = auto()


def step(state, event):
    """Pure transition; returned effects are data, executed by the outer tick."""
    table = {
        (State.SELECTED, Event.BUILD_OK): (State.VERIFIED, None),
        (State.VERIFIED, Event.VERIFY_ONLY): (State.DONE, None),
        (State.VERIFIED, Event.RELEASE): (State.PROMOTING, "promote"),
        (State.PROMOTING, Event.SMOKE_OK): (State.DONE, None),
        (State.PROMOTING, Event.SMOKE_FAILED): (State.RECOVERING, "rollback"),
        (State.RECOVERING, Event.RECOVERED): (State.FAILED, None),
    }
    if state not in (State.DONE, State.FAILED) and event == Event.ERROR:
        return State.FAILED, None
    return table.get((state, event), (state, None))


def command(*args, cwd=None):
    return subprocess.check_output(list(map(str, args)), cwd=cwd, text=True,
                                   stderr=subprocess.STDOUT).strip()


def config_at(repo, sha):
    raw = command("git", "show", sha + ":wrangler.jsonc", cwd=repo)
    raw = re.sub(r"(?m)^\s*//.*$", "", raw)
    raw = re.sub(r",(\s*[}\]])", r"\1", raw)
    config = json.loads(raw)
    production = config["env"]["production"]
    return {**{k: v for k, v in config.items() if k not in ("env", "$schema")}, **production}


def public_at(repo, sha):
    values = json.loads(command("git", "show", sha + ":web/production.json", cwd=repo))
    if set(values) != PUBLIC_KEYS or not values["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"].startswith("pk_live_"):
        raise RuntimeError("Expected the explicit public production compiler contract")
    if values["NEXT_PUBLIC_POSTHOG_ENVIRONMENT"] != "production":
        raise RuntimeError("Production measurement must remain enabled")
    return values


def hashes(root):
    if not stat.S_ISDIR(root.lstat().st_mode):
        raise RuntimeError("Artifact root must be a directory")
    result = {}
    for path in sorted(root.rglob("*")):
        if ".wrangler" in path.relative_to(root).parts:
            continue
        mode = path.lstat().st_mode
        if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
            raise RuntimeError("No links or special files in deploy inputs")
        if stat.S_ISREG(mode):
            result[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def stage(source, target, config, public):
    hashes(source)
    packaged = json.loads((source / "wrangler.json").read_text())
    expected = {key: config[key] for key in ("name", "account_id", "compatibility_date",
               "compatibility_flags", "workers_dev", "preview_urls", "routes", "observability")}
    expected.update(main=packaged["main"], no_bundle=True, find_additional_modules=True,
                    rules=[{"type": "CompiledWasm", "globs": ["**/*.wasm"], "fallthrough": True}],
                    send_metrics=False, assets={**config["assets"], "directory": "assets"},
                    vars={**config.get("vars", {}), "NEXT_PUBLIC_CONVEX_URL": public["NEXT_PUBLIC_CONVEX_URL"]})
    if packaged != expected or not re.fullmatch(r"worker/[\w.-]+\.m?js", packaged["main"]):
        raise RuntimeError("Artifact config differs from trusted source contract")
    if any(p.parts[0] not in ("worker", "assets", "wrangler.json") for p in map(Path, hashes(source))):
        raise RuntimeError("Unexpected deploy input")
    for path in map(Path, hashes(source)):
        if path.parts[0] == "worker" and any(p.startswith(".") or p in ("node_modules", "package.json") for p in path.parts):
            raise RuntimeError("No deployment tool/config discovery inside Worker modules")
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target, ignore=shutil.ignore_patterns(".wrangler"))
    return hashes(target)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(url, token=None, data=None):
    headers = {"User-Agent": "Mozilla/5.0 ChrondleNativeTrain/1"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, headers=headers, data=data)
    try:
        response = urllib.request.build_opener(NoRedirect()).open(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


def provider(config, token, suffix):
    status, _, body = request(f"{PROVIDER}/accounts/{config['account_id']}/workers/scripts/{config['name']}/{suffix}", token)
    data = json.loads(body)
    if status != 200 or not data.get("success"):
        raise RuntimeError("Provider readback failed: " + suffix)
    return data["result"]


def deployed(config, token):
    latest = provider(config, token, "deployments")["deployments"][0]
    if len(latest["versions"]) != 1 or latest["versions"][0]["percentage"] != 100:
        raise RuntimeError("Expected one 100% serving version")
    return latest["versions"][0]["version_id"]


def serving_source(config, token, version):
    message = provider(config, token, "versions/" + version).get("annotations", {}).get("workers/message", "")
    match = re.fullmatch(r"(?:git:)?([a-f0-9]{40})", message)
    if not match:
        raise RuntimeError("Missing provider source annotation")
    return match[1]


def preflight(repo, sha, config, public, token):
    previous = deployed(config, token)
    prior_sha = serving_source(config, token, previous)
    subprocess.run(["git", "merge-base", "--is-ancestor", prior_sha, sha], cwd=repo, check=True)
    # This first train owns only web. Fail visibly rather than silently skip a
    # compatible backend release, accept a migration, or restore a different writer.
    if command("git", "diff", "--name-only", prior_sha, sha, "--", "backend", "convex", cwd=repo):
        raise RuntimeError("Backend source changed: implement its native release before promotion")
    bindings = provider(config, token, "settings")["bindings"]
    origin = next((b.get("text") for b in bindings if b["name"] == "NEXT_PUBLIC_CONVEX_URL"), None)
    if origin != public["NEXT_PUBLIC_CONVEX_URL"]:
        raise RuntimeError("Backend origin changed; accepted-write-preserving recovery required")
    return previous, prior_sha


def deployment_tool(repo, sha, wrangler):
    lock = command("git", "show", sha + ":bun.lock", cwd=repo)
    version = re.search(r'"wrangler": \["wrangler@([^\"]+)"', lock)
    package = json.loads((wrangler.parent.parent / "package.json").read_text())
    if not version or package["version"] != version[1]:
        raise RuntimeError("Trusted deployment tool must match the candidate lockfile")


class PendingPropagation(RuntimeError):
    pass


def smoke(sha, rust=True, origins=HOSTS):
    for origin in origins:
        status, _, body = request(origin + "/api/health?native_readback=" + str(time.time_ns()))
        health = json.loads(body)
        if status != 200 or health.get("status") != "ok" or health.get("checks", {}).get("convex") != "ok" or not re.fullmatch(r"[a-f0-9]{40}", health.get("revision", "")):
            raise RuntimeError("Serving health failed: " + origin)
        if health["revision"] != sha:
            raise PendingPropagation("Serving revision mismatch: " + origin)
        status, headers, body = request(origin + "/robots.txt")
        if status != 200 or b"Sitemap: https://chrondle.app/sitemap.xml" not in body:
            raise RuntimeError("Discovery smoke failed")
        if rust and (headers.get("X-Chrondle-Runtime") != "rust" or headers.get("X-Chrondle-Revision") != sha):
            raise PendingPropagation("Rust source identity mismatch")
    origin = origins[-1]
    status, _, body = request(origin + "/classic")
    if status != 200 or b"</html>" not in body or b"Chrondle" not in body or b'\\"digest\\"' in body:
        raise RuntimeError("Classic entry failed")
    for path, status in (("/api/stripe/checkout", 401), ("/api/webhooks/stripe", 400)):
        if request(origin + path, data=b'{}')[0] != status:
            raise RuntimeError("Anonymous billing rejection failed")


def settled_smoke(sha, rust=True, origins=HOSTS):
    deadline = time.monotonic() + 60
    while True:
        try:
            return smoke(sha, rust, origins)
        except PendingPropagation:
            if time.monotonic() >= deadline:
                raise
            time.sleep(2)  # Bounded safe GET/unsigned rejection readback, never promotion polling.


def run_wrangler(args, artifact, token, *action, log):
    env = {k: os.environ[k] for k in ("PATH", "HOME", "SSL_CERT_FILE") if k in os.environ}
    env.update(CLOUDFLARE_API_TOKEN=token, WRANGLER_SEND_METRICS="false", CI="true")
    subprocess.run([str(args.node / "bin/node"), str(args.wrangler), *action, "--config", str(artifact / "wrangler.json")],
                   cwd=artifact, env=env, stdout=log, stderr=log, check=True)


def activate(args, artifact, sha, config, token, previous, prior_sha, log, origins=HOSTS):
    """Same promotion/recovery implementation for production and isolated rehearsal."""
    manifest = hashes(artifact)
    state, effect = step(State.VERIFIED, Event.RELEASE)
    assert effect == "promote"
    try:
        run_wrangler(args, artifact, token, "deploy", "--message", "git:" + sha, log=log)
        current = deployed(config, token)
        if current == previous or serving_source(config, token, current) != sha:
            raise RuntimeError("Provider promotion identity mismatch")
        settled_smoke(sha, origins=origins)
        if hashes(artifact) != manifest:
            raise RuntimeError("Promotion changed tested bytes")
        state, _ = step(state, Event.SMOKE_OK)
        return state
    except Exception:
        state, effect = step(state, Event.SMOKE_FAILED)
        assert effect == "rollback"
        run_wrangler(args, artifact, token, "rollback", previous, "--yes", log=log)
        if deployed(config, token) != previous:
            raise RuntimeError("ROLLBACK INCOMPLETE; preserve accepted data")
        settled_smoke(prior_sha, rust=False, origins=origins)
        state, _ = step(state, Event.RECOVERED)
        assert state == State.FAILED
        raise RuntimeError("Release failed; previous compatible version and journey recovered")


def build(args, source, public, sha, log):
    cache = args.home / "cache"
    for name in ("home", "tmp", "cargo", "target", "node_modules"):
        (cache / name).mkdir(parents=True, exist_ok=True)
    name = "chrondle-train-" + str(os.getpid())
    docker = ["docker", "run", "--rm", "--init", "--name", name, "--label", "hermes.task=t_7034d1ef",
              "--cgroup-parent=gha-runners.slice", "--cpus=4", "--memory=8g", "--pids-limit=1024",
              "--cap-drop=ALL", "--security-opt=no-new-privileges", "--read-only",
              "--tmpfs", "/tmp:rw,size=1g", "--user", f"{os.getuid()}:{os.getgid()}", "--entrypoint", "/bin/bash"]
    for key in ("network", "dns"):
        if getattr(args, key):
            docker += ["--" + key, getattr(args, key)]
    for host, target, mode in ((source, "/workspace", "rw"), (cache, "/cache", "rw"),
            (args.node, "/node", "ro"), (args.bun, "/bun", "ro"), (args.rustup, "/rustup", "ro"),
            (args.cargo_bin, "/rust-bin", "ro"), (args.worker_bin, "/worker-bin", "ro"),
            (cache / "node_modules", "/workspace/node_modules", "rw")):
        docker += ["--volume", f"{host}:{target}:{mode}"]
    env = {**public, "CHRONDLE_REVISION": sha, "NEXT_TELEMETRY_DISABLED": "1", "WRANGLER_SEND_METRICS": "false",
           "HOME": "/cache/home", "TMPDIR": "/cache/tmp", "CARGO_HOME": "/cache/cargo",
           "CARGO_TARGET_DIR": "/cache/target", "RUSTUP_HOME": "/rustup",
           "PATH": "/node/bin:/bun/bin:/rust-bin:/worker-bin:/usr/local/bin:/usr/bin:/bin"}
    for key, value in env.items():
        docker += ["--env", key + "=" + value]
    checks = "bun install --frozen-lockfile && bun run check --mode " + args.mode
    if args.mode == "fast":
        checks += " && bun run build:cf && bun run test:worker-routes && bun run test:discovery"
    checks += " && bun scripts/package-worker.mjs && CHRONDLE_ARTIFACT=.release bun run test:worker-routes"
    checks += " && CHRONDLE_ARTIFACT=.release CHRONDLE_DISCOVERY_BACKEND=$NEXT_PUBLIC_CONVEX_URL bun run test:discovery"
    docker += ["--workdir", "/workspace", args.image, "-c", checks]
    try:
        subprocess.run(docker, stdout=log, stderr=log, check=True)
    finally:
        subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def receipt(path, **event):
    with path.open("a") as output:
        output.write(json.dumps({"at": time.time(), **event}) + "\n")
        output.flush()
        os.fsync(output.fileno())


def last_promoted(path):
    latest = None
    if path.exists():
        for line in path.read_text().splitlines():
            event = json.loads(line)
            if event.get("promoted") and event["state"] == "DONE":
                latest = event["sha"]
    return latest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ("repo", "home", "node", "bun", "rustup", "cargo-bin", "worker-bin"):
        parser.add_argument("--" + key, type=lambda p: Path(p).resolve(), required=True)
    parser.add_argument("--wrangler", type=lambda p: Path(p).resolve())
    parser.add_argument("--image", required=True)
    parser.add_argument("--network")
    parser.add_argument("--dns")
    parser.add_argument("--mode", choices=("fast", "full"), default="fast")
    parser.add_argument("--candidate", help="exact diagnostic SHA; never promotable")
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    if args.candidate and (args.promote or not re.fullmatch(r"[a-f0-9]{40}", args.candidate)):
        parser.error("Diagnostic candidate must be an exact SHA and cannot promote")
    if args.promote and (not args.wrangler or args.mode != "fast"):
        parser.error("Only slim releases promote, using a trusted external Wrangler")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", args.image):
        parser.error("Pin the existing build image digest")
    for path in (args.repo, args.node, args.bun, args.rustup, args.cargo_bin, args.worker_bin, args.wrangler):
        if path and path.is_relative_to(args.home):
            parser.error("Trusted source/tools must be outside writable train state")
    args.home.mkdir(parents=True, exist_ok=True)
    with (args.home / "tick.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        sha, state = "unselected", State.SELECTED
        events = args.home / "events.jsonl"
        started = time.time()
        with (args.home / "train.log").open("a") as log:
            try:
                command("git", "fetch", "origin", "master", cwd=args.repo)
                sha = args.candidate or command("git", "rev-parse", "FETCH_HEAD", cwd=args.repo)
                if args.promote and last_promoted(events) == sha:
                    return 0
                config, public = config_at(args.repo, sha), public_at(args.repo, sha)
                with tempfile.TemporaryDirectory(prefix="candidate-", dir=args.home) as directory:
                    source = Path(directory)
                    command("git", "clone", "--no-hardlinks", "--no-checkout", args.repo, source)
                    command("git", "checkout", "--detach", sha, cwd=source)
                    build(args, source, public, sha, log)
                    artifact = args.home / "artifact"
                    manifest = stage(source / ".release", artifact, config, public)
                state, _ = step(state, Event.BUILD_OK)
                receipt(events, sha=sha, state=state.name, mode=args.mode, hashes=manifest)
                if args.promote:
                    deployment_tool(args.repo, sha, args.wrangler)
                    token = command("pass", "show", "workstation/MISTY_STEP_CD_CLOUDFLARE_TOKEN").splitlines()[0]
                    previous, prior_sha = preflight(args.repo, sha, config, public, token)
                    state = activate(args, artifact, sha, config, token, previous, prior_sha, log)
                else:
                    state, _ = step(state, Event.VERIFY_ONLY)
                receipt(events, sha=sha, state=state.name, mode=args.mode, promoted=args.promote,
                        elapsed_seconds=round(time.time() - started, 3))
                return 0
            except Exception as error:
                state, _ = step(state, Event.ERROR)
                receipt(events, sha=sha, state=state.name, mode=args.mode, promoted=False,
                        error_type=type(error).__name__)
                print(f"{type(error).__name__}: {error}", file=log, flush=True)
                print(f"Chrondle native failure; repository=misty-step/chrondle; candidate={sha}; mode={args.mode}; "
                      f"failure_id=misty-step/chrondle:{sha}:{args.mode}; evidence=mirrodin-hq:{args.home}/train.log. "
                      "Kaylee owns idempotent repair/readback. No backend restore was performed.", file=sys.stderr)
                return 1


if __name__ == "__main__":
    sys.exit(main())
