"""Native release train. Adapted from Overmind scripts/train.py at 49d98c2.

No automatic data restoration. Verify is credential-free; promote reads credentials
only after checking its verification receipt. Status is a read-only scheduler query.
Invoke from a trusted source checkout.
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
import time
import urllib.error
import urllib.request

PROVIDER = "https://api.cloudflare.com/client/v4"
HOSTS = ("https://chrondle.mistystep.io", "https://chrondle.app", "https://www.chrondle.app")
BACKEND = "https://chrondle-backend.mistystep.io"
PUBLIC_KEYS = {"NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
               "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST", "NEXT_PUBLIC_POSTHOG_ENVIRONMENT"}


class State(Enum):
    SELECTED = auto()
    VERIFIED = auto()
    BACKING_UP = auto()
    BACKEND_DEPLOYING = auto()
    BACKEND_VERIFIED = auto()
    PROMOTING = auto()
    RECOVERING = auto()
    DONE = auto()
    FAILED = auto()


class Event(Enum):
    BUILD_OK = auto()
    RELEASE = auto()
    BACKEND_RELEASE = auto()
    BACKUP_OK = auto()
    BACKEND_OK = auto()
    SMOKE_OK = auto()
    SMOKE_FAILED = auto()
    RECOVERED = auto()
    ERROR = auto()


def step(state, event):
    """Pure transition; returned effects are data, executed by the outer tick."""
    table = {
        (State.SELECTED, Event.BUILD_OK): (State.VERIFIED, None),
        (State.VERIFIED, Event.BACKEND_RELEASE): (State.BACKING_UP, "backup"),
        (State.BACKING_UP, Event.BACKUP_OK): (State.BACKEND_DEPLOYING, "deploy_backend"),
        (State.BACKEND_DEPLOYING, Event.BACKEND_OK): (State.BACKEND_VERIFIED, None),
        (State.BACKEND_VERIFIED, Event.RELEASE): (State.PROMOTING, "promote"),
        (State.VERIFIED, Event.RELEASE): (State.PROMOTING, "promote"),
        (State.PROMOTING, Event.SMOKE_OK): (State.DONE, None),
        (State.PROMOTING, Event.SMOKE_FAILED): (State.RECOVERING, "rollback"),
        (State.RECOVERING, Event.RECOVERED): (State.FAILED, None),
    }
    if state in (State.BACKEND_DEPLOYING, State.BACKEND_VERIFIED, State.PROMOTING) and event in (Event.ERROR, Event.SMOKE_FAILED):
        return State.RECOVERING, "rollback"
    if state not in (State.DONE, State.FAILED) and event == Event.ERROR:
        return State.FAILED, None
    return table.get((state, event), (state, None))


def command(*args, cwd=None):
    return subprocess.check_output(list(map(str, args)), cwd=cwd, text=True,
                                   stderr=subprocess.STDOUT).strip()


def config_at(repo, sha, path="wrangler.jsonc"):
    raw = command("git", "show", sha + ":" + path, cwd=repo)
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


def request(url, token=None, data=None, headers=None):
    headers = {"User-Agent": "Mozilla/5.0 ChrondleNativeTrain/1", **(headers or {})}
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
    subprocess.run(["node", str(args.wrangler), *action, "--config", str(artifact / "wrangler.json")],
                   cwd=artifact, env=env, stdout=log, stderr=log, check=True)


def credentials(path):
    # Open without following links, then check the descriptor to avoid a mode-check race.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600:
            raise RuntimeError("Credentials must be a regular 0600 file")
        values = {}
        for line in source:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, separator, value = line.partition("=")
            if not separator or key not in ("CLOUDFLARE_API_TOKEN", "CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET") or not value or key in values:
                raise RuntimeError("Invalid credentials file contract")
            values[key] = value
    if len(values) != 3:
        raise RuntimeError("Missing required credentials")
    return values


def backend_smoke(sha):
    deadline = time.monotonic() + 60
    while True:
        status, _, body = request(BACKEND + "/_backend/version?native_readback=" + str(time.time_ns()))
        identity = json.loads(body)
        if status != 200 or identity.get("service") != "chrondle-backend" or identity.get("environment") != "production":
            raise RuntimeError("Backend health failed")
        if identity.get("revision") == sha:
            return
        if not re.fullmatch(r"[a-f0-9]{40}", identity.get("revision", "")) or time.monotonic() >= deadline:
            raise RuntimeError("Backend revision mismatch")
        time.sleep(2)


def restore(config, token, version):
    payload = json.dumps({"strategy": "percentage", "versions": [{"version_id": version, "percentage": 100}]}).encode()
    status, _, body = request(f"{PROVIDER}/accounts/{config['account_id']}/workers/scripts/{config['name']}/deployments", token, payload)
    if status not in (200, 201) or not json.loads(body).get("success"):
        raise RuntimeError("Provider rollback failed")
    if deployed(config, token) != version:
        raise RuntimeError("Rollback pointer mismatch")


def activate(args, artifact, sha, config, token, previous, prior_sha, log, origins=HOSTS,
             backend_config=None, secrets=None, events=None):
    """One state machine owns both families; all failures after deploy recover both."""
    manifest = hashes(artifact)
    backend_artifact = args.home / "backend" if backend_config else None
    backend_manifest = hashes(backend_artifact) if backend_config else None
    backend_previous = backend_prior_sha = None
    backup_key = None
    state = State.VERIFIED

    def advance(event):
        nonlocal state
        next_state, effect = step(state, event)
        if events:
            receipt(events, sha=sha, state=next_state.name, backup_key=backup_key)
        state = next_state
        return effect

    try:
        if backend_config:
            advance(Event.BACKEND_RELEASE)
            status, _, body = request(BACKEND + "/_backend/admin/backup", data=b"{}", headers={
                "CF-Access-Client-Id": secrets["CF_ACCESS_CLIENT_ID"],
                "CF-Access-Client-Secret": secrets["CF_ACCESS_CLIENT_SECRET"]})
            if status != 200:
                raise RuntimeError("Backend backup failed")
            backup_key = json.loads(body).get("key")
            if not isinstance(backup_key, str) or not backup_key:
                raise RuntimeError("Backend backup key missing")
            # Persist the recovery point before any further fallible operation.
            if events:
                receipt(events, sha=sha, state=state.name, backup_key=backup_key)
            backend_previous = deployed(backend_config, token)
            backend_prior_sha = serving_source(backend_config, token, backend_previous)
            advance(Event.BACKUP_OK)
            run_wrangler(args, backend_artifact, token, "deploy", "--env", "production",
                         "--var", "REVISION:" + sha, "--message", "git:" + sha, log=log)
            current = deployed(backend_config, token)
            if current == backend_previous or serving_source(backend_config, token, current) != sha:
                raise RuntimeError("Backend provider identity mismatch")
            backend_smoke(sha)
            if hashes(backend_artifact) != backend_manifest:
                raise RuntimeError("Backend promotion changed tested bytes")
            advance(Event.BACKEND_OK)
        advance(Event.RELEASE)
        run_wrangler(args, artifact, token, "deploy", "--message", "git:" + sha, log=log)
        current = deployed(config, token)
        if current == previous or serving_source(config, token, current) != sha:
            raise RuntimeError("Provider promotion identity mismatch")
        settled_smoke(sha, origins=origins)
        if backend_config:
            backend_smoke(sha)
        if hashes(artifact) != manifest:
            raise RuntimeError("Promotion changed tested bytes")
        advance(Event.SMOKE_OK)
        return state
    except Exception:
        failed_state = state.name
        state, effect = step(state, Event.ERROR)
        if effect == "rollback":
            failures = []
            # Independent attempts: a broken family must not prevent the other's recovery.
            for family, version in ((backend_config, backend_previous), (config, previous)):
                if family and version:
                    try:
                        try:
                            current = deployed(family, token)
                        except Exception:
                            current = None  # An unreadable pointer must not skip restoration.
                        if current != version:
                            restore(family, token, version)
                    except Exception:
                        failures.append("provider recovery")
            for readback in ([lambda: backend_smoke(backend_prior_sha)] if backend_config else []) + [lambda: settled_smoke(prior_sha, rust=False, origins=origins)]:
                try:
                    readback()
                except Exception:
                    failures.append("serving readback")
            state, _ = step(state, Event.RECOVERED)
            result = "ROLLBACK INCOMPLETE" if failures else "prior versions recovered"
        else:
            result = "no deployment attempted"
        raise RuntimeError(f"Release failed in {failed_state}; {result}; backup_key={backup_key}; no data restored") from None


def stage_backend(source, target, config):
    files = hashes(source)
    mains = [name for name in files if re.fullmatch(r"[\w.-]+\.m?js", name)]
    if len(mains) != 1 or set(files) - {mains[0] if mains else "", (mains[0] + ".map") if mains else "", "README.md"}:
        raise RuntimeError("Expected one bundled backend entrypoint")
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target, ignore=shutil.ignore_patterns(".wrangler"))
    # Only trusted source config, no build hooks or candidate dependency discovery.
    production = {k: v for k, v in config.items() if k not in ("build", "main", "send_metrics")}
    production.update(main=mains[0], no_bundle=True)
    (target / "wrangler.json").write_text(json.dumps({"main": mains[0], "no_bundle": True,
        "account_id": config["account_id"], "send_metrics": False, "env": {"production": production}}))
    return hashes(target)


def build(args, source, public, sha, log):
    # The fresh Boat sandbox is the isolation boundary. Never forward its secrets.
    env = {k: os.environ[k] for k in ("PATH", "HOME", "RUSTUP_HOME", "CARGO_HOME", "SSL_CERT_FILE") if k in os.environ}
    env.update(public, CHRONDLE_REVISION=sha, NEXT_TELEMETRY_DISABLED="1",
               WRANGLER_SEND_METRICS="false", ONNXRUNTIME_NODE_INSTALL_CUDA="skip", CI="true")
    checks = "bun install --frozen-lockfile && bun run check --mode " + args.mode
    if args.mode == "fast":
        checks += " && bun run build:cf && bun run test:worker-routes && bun run test:discovery"
    checks += " && bun scripts/package-worker.mjs && CHRONDLE_ARTIFACT=.release bun run test:worker-routes"
    checks += " && CHRONDLE_ARTIFACT=.release CHRONDLE_DISCOVERY_BACKEND=$NEXT_PUBLIC_CONVEX_URL bun run test:discovery"
    checks += " && cd backend && ../node_modules/.bin/wrangler deploy --env production --var REVISION:" + sha + " --dry-run --outdir ../.backend-release"
    subprocess.run(["bash", "-c", checks], cwd=source, env=env, stdout=log, stderr=log, check=True)


def receipt(path, **event):
    with path.open("a") as output:
        output.write(json.dumps({"at": time.time(), **event}) + "\n")
        output.flush()
        os.fsync(output.fileno())


def verified(events, sha, mode, home):
    records = [json.loads(line) for line in events.read_text().splitlines()]
    latest = records[-1]
    if latest.get("state") != "VERIFIED" or latest.get("sha") != sha or latest.get("mode") != mode or mode != "fast":
        raise RuntimeError("Promotion requires an unused fast verification receipt for this SHA")
    if latest["hashes"] != hashes(home / "artifact") or latest["backend_hashes"] != hashes(home / "backend"):
        raise RuntimeError("Staged bytes differ from verified receipt")


def trusted_wrangler(repo, sha, home):
    executable = shutil.which("wrangler")
    if not executable:
        raise RuntimeError("Provision lockfile-matching Wrangler on the sandbox PATH")
    wrangler = Path(executable).resolve()
    if wrangler.is_relative_to(repo) or wrangler.is_relative_to(home):
        raise RuntimeError("Deployment tool must be outside candidate checkout and staged state")
    deployment_tool(repo, sha, wrangler)
    return wrangler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--phase", choices=("verify", "promote", "status"), required=True)
    parser.add_argument("--repo", type=lambda p: Path(p).resolve(), required=True)
    parser.add_argument("--home", type=lambda p: Path(p).resolve())
    parser.add_argument("--sha", required=True)
    parser.add_argument("--credentials", type=lambda p: Path(p).absolute())
    parser.add_argument("--mode", choices=("fast", "full"), default="fast")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-f0-9]{40}", args.sha):
        parser.error("Select one exact source SHA")
    if args.phase == "verify" and args.credentials:
        parser.error("Verify must not receive credentials")
    if args.phase != "verify" and not args.credentials:
        parser.error("Status/promote require a 0600 credentials file")
    if args.phase == "status":
        try:
            config = config_at(args.repo, args.sha)
            token = credentials(args.credentials)["CLOUDFLARE_API_TOKEN"]
            print(serving_source(config, token, deployed(config, token)))
            return 0
        except Exception:
            print("Production serving annotation read failed", file=sys.stderr)
            return 1
    if not args.home or args.home.is_relative_to(args.repo) or args.repo.is_relative_to(args.home):
        parser.error("Source and staged state must be separate directories")
    if args.credentials and (args.credentials.is_relative_to(args.repo) or args.credentials.is_relative_to(args.home)):
        parser.error("Credentials must be outside source and staged state")
    args.home.mkdir(parents=True, exist_ok=True)
    with (args.home / "tick.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        sha, state = args.sha, State.SELECTED
        events = args.home / "events.jsonl"
        started = time.time()
        with (args.home / "train.log").open("a") as log:
            try:
                if command("git", "rev-parse", "HEAD", cwd=args.repo) != sha:
                    raise RuntimeError("Checkout does not match selected SHA")
                config, public = config_at(args.repo, sha), public_at(args.repo, sha)
                backend_config = config_at(args.repo, sha, "backend/wrangler.jsonc")
                if args.phase == "verify":
                    if events.exists():
                        raise RuntimeError("Verify requires fresh per-run state")
                    command("git", "diff", "--exit-code", "HEAD", cwd=args.repo)
                    build(args, args.repo, public, sha, log)
                    manifest = stage(args.repo / ".release", args.home / "artifact", config, public)
                    backend_manifest = stage_backend(args.repo / ".backend-release", args.home / "backend", backend_config)
                    state, _ = step(state, Event.BUILD_OK)
                    receipt(events, sha=sha, state=state.name, mode=args.mode, hashes=manifest, backend_hashes=backend_manifest)
                    return 0
                # No compiler or candidate hook can run in this invocation.
                verified(events, sha, args.mode, args.home)
                state = State.VERIFIED
                command("git", "merge-base", "--is-ancestor", sha, "origin/master", cwd=args.repo)
                args.wrangler = trusted_wrangler(args.repo, sha, args.home)
                secrets = credentials(args.credentials)
                token = secrets["CLOUDFLARE_API_TOKEN"]
                previous, prior_sha = preflight(args.repo, sha, config, public, token)
                if prior_sha == sha:
                    return 0  # Another release already served this immutable candidate.
                changed = command("git", "diff", "--name-only", prior_sha, sha, "--", "backend", "convex", cwd=args.repo)
                state = activate(args, args.home / "artifact", sha, config, token, previous, prior_sha, log,
                                 backend_config=backend_config if changed else None, secrets=secrets, events=events)
                receipt(events, sha=sha, state=state.name, mode=args.mode, promoted=True,
                        elapsed_seconds=round(time.time() - started, 3))
                return 0
            except Exception as error:
                state, _ = step(state, Event.ERROR)
                try:
                    receipt(events, sha=sha, state=state.name, mode=args.mode, promoted=False,
                            error_type=type(error).__name__)
                    print(f"{type(error).__name__}: {error}", file=log, flush=True)
                except OSError:
                    pass
                print(f"Train failed; repo=misty-step/chrondle; sha={sha}; phase={args.phase}; evidence={args.home}/train.log", file=sys.stderr)
                # Launcher captures this diagnostic and delivers one external report.
                return 1


if __name__ == "__main__":
    sys.exit(main())
