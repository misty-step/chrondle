#!/usr/bin/env python3
"""Native Chrondle release owner. Installed root-owned; never executes repo code as root."""

import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import sys
import socket
import tarfile
import tempfile
import time
import urllib.request

REPO = "misty-step/chrondle"
API = f"https://api.github.com/repos/{REPO}"
ROOT = Path("/opt/public-apps/chrondle")
STATE = Path("/var/lib/chrondle-cd")
NODE = "/opt/node-v24/bin/node"
BUN = "/opt/bun-1.4.2/bin/bun"
BUILD_USER = "chrondle-build"
SHA = re.compile(r"[0-9a-f]{40}")


def event(name, **fields):
    print(json.dumps({"event": name, "service": "chrondle-cd", **fields}), flush=True)


def request_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "chrondle-cd", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def candidate(run, jobs):
    """A backend success alone is insufficient: an Actions observer must be live."""
    if (run.get("head_branch") != "master"
            or run.get("head_repository", {}).get("full_name") != REPO
            or run.get("event") not in {"push", "workflow_dispatch"}
            or run.get("status") != "in_progress"
            or not SHA.fullmatch(run.get("head_sha", ""))):
        return None
    backend = any(job.get("name") == "Deploy compatible backend"
                  and job.get("status") == "completed"
                  and job.get("conclusion") == "success" for job in jobs)
    observer = any(job.get("name") == "Deploy native host"
                   and job.get("status") == "in_progress" for job in jobs)
    return run if backend and observer else None


def write_json(path, value):
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "w") as output:
            json.dump(value, output)
            output.write("\n")
        temporary.chmod(0o644)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


PUBLIC_BUILD_VARS = frozenset({
    "NEXT_PUBLIC_ANALYTICS_DEBUG", "NEXT_PUBLIC_ANALYTICS_ENDPOINT",
    "NEXT_PUBLIC_ANALYTICS_FORMAT", "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_DEBUG_HOOKS", "NEXT_PUBLIC_POSTHOG_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
})


def public_build_environment(revision, home, host_environment):
    # Production server/deploy secrets never reach install scripts or the compiler.
    if host_environment.get("NEXT_PUBLIC_CONVEX_URL") != "https://fleet-goldfish-183.convex.cloud":
        raise RuntimeError("native_backend_is_not_production")
    return {**{key: value for key, value in host_environment.items() if key in PUBLIC_BUILD_VARS},
            "PATH": "/opt/bun-1.4.2/bin:/opt/node-v24/bin:/usr/bin:/bin",
            "HOME": str(home), "TMPDIR": str(home / "tmp"),
            "NODE_ENV": "production", "CI": "1", "HUSKY": "0",
            "NEXT_TELEMETRY_DISABLED": "1", "DAGGER_ARTIFACT_BUILD": "1",
            "CHRONDLE_REVISION": revision}


def as_builder(argv, source, environment):
    # A transient unit kills remaining build children on exit before root reads
    # the artifact. The build identity has no login, secrets, or activation grant.
    subprocess.run([
        "systemd-run", "--quiet", "--wait", "--pipe", "--collect",
        f"--uid={BUILD_USER}", f"--working-directory={source}",
        "--property=Type=exec", "--property=MemoryMax=2500M",
        "--property=RuntimeMaxSec=10min",
        "--property=CPUQuota=150%", "--property=Nice=15",
        "--property=OOMScoreAdjust=500", "--property=ProtectSystem=strict",
        f'--property=ReadWritePaths={environment["HOME"]}',
        "--property=ProtectHome=yes", "--property=NoNewPrivileges=yes",
        "--property=PrivateTmp=yes", "--", "env", "-i",
        *[f"{key}={value}" for key, value in environment.items()], *argv,
    ], check=True, timeout=720)


def host_public_environment():
    # Node's env-file parser matches the deployed values without shell evaluation.
    output = subprocess.check_output([
        NODE, "--env-file=/etc/public-apps/chrondle.env", "-e",
        'console.log(JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith("NEXT_PUBLIC_")))))',
    ], text=True)
    return json.loads(output)


def build_release(revision, workspace, environment):
    archive = workspace / "source.tar.gz"
    with urllib.request.urlopen(f"https://codeload.github.com/{REPO}/tar.gz/{revision}", timeout=60) as response:
        with archive.open("wb") as target:
            shutil.copyfileobj(response, target)
    with tarfile.open(archive) as source_archive:
        source_archive.extractall(workspace, filter="data")
    source = workspace / f"chrondle-{revision}"
    account = pwd.getpwnam(BUILD_USER)
    for directory, folders, files in os.walk(workspace):
        os.chown(directory, account.pw_uid, account.pw_gid)
        for name in folders + files:
            os.chown(Path(directory) / name, account.pw_uid, account.pw_gid, follow_symlinks=False)
    (workspace / "tmp").mkdir()
    os.chown(workspace / "tmp", account.pw_uid, account.pw_gid)
    return compile_release(revision, source, environment, as_builder, BUN)


def compile_release(revision, source, environment, builder, bun):
    """One native artifact producer, used by the sandbox and inert PR preflight."""
    builder([bun, "install", "--frozen-lockfile"], source, environment)
    builder([bun, "run", "build"], source, environment)
    if (source / ".next/BUILD_ID").read_text().strip() != revision:
        raise RuntimeError("build_revision_mismatch")
    return source


def validate_artifact_tree(tree, source):
    resolved = tree.resolve(strict=True)
    if tree.is_symlink() or not resolved.is_relative_to(source.resolve()) or not tree.is_dir():
        raise RuntimeError("artifact_root_escaped")
    for path in tree.rglob("*"):
        if path.is_symlink() and not path.resolve(strict=True).is_relative_to(resolved):
            raise RuntimeError("artifact_link_escaped")


def install_release(source, revision, receipt, root=ROOT):
    release = root / "releases" / revision
    # Releases are immutable. A rerun may reuse the identical installed artifact.
    if not release.exists():
        staging = root / "releases" / f".{revision}.{os.getpid()}"
        try:
            for tree in [source / ".next/standalone", source / ".next/static", source / "public"]:
                validate_artifact_tree(tree, source)
            shutil.copytree(source / ".next/standalone", staging, symlinks=True)
            shutil.copytree(source / ".next/static", staging / ".next/static", symlinks=True, dirs_exist_ok=True)
            shutil.copytree(source / "public", staging / "public", symlinks=True, dirs_exist_ok=True)
            staging.chmod(0o755)
            if not (staging / "server.js").is_file():
                raise RuntimeError("standalone_server_missing")
            staging.rename(release)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
    if (release / ".next/BUILD_ID").read_text().strip() != revision:
        raise RuntimeError("installed_revision_mismatch")
    # This file exists before Next indexes public assets; healthy is published only
    # after all real smoke checks pass, so Actions cannot race a later rollback.
    write_json(release / "public/deployment.json", {**receipt, "status": "checking"})
    return release


def local_builder(argv, source, environment):
    subprocess.run(argv, cwd=source, env=environment, check=True, timeout=720)


def preflight(revision):
    """Build and consume an exact Git artifact without host privileges or activation."""
    if os.geteuid() == 0 or not SHA.fullmatch(revision):
        raise RuntimeError("preflight_requires_unprivileged_user_and_exact_sha")
    bun = shutil.which("bun")
    node = shutil.which("node")
    if not bun or not node:
        raise RuntimeError("preflight_requires_bun_and_node")
    with tempfile.TemporaryDirectory(prefix="chrondle-preflight-") as directory:
        workspace = Path(directory)
        source = workspace / "source"
        source.mkdir()
        archive = workspace / "source.tar"
        subprocess.run(["git", "archive", "--format=tar", f"--output={archive}", revision], check=True)
        with tarfile.open(archive) as source_archive:
            source_archive.extractall(source, filter="data")
        (workspace / "tmp").mkdir()
        environment = {
            **{key: value for key, value in os.environ.items() if key in PUBLIC_BUILD_VARS},
            "PATH": os.environ["PATH"], "HOME": str(workspace), "TMPDIR": str(workspace / "tmp"),
            "NODE_ENV": "production", "CI": "1", "HUSKY": "0",
            "NEXT_TELEMETRY_DISABLED": "1", "DAGGER_ARTIFACT_BUILD": "1",
            "CHRONDLE_REVISION": revision, "CONVEX_DISABLE_ANALYTICS": "1",
        }
        local_builder([bun, "scripts/verify-ci-backend.mjs"], source, environment)
        compile_release(revision, source, environment, local_builder, bun)
        local_builder([bun, "scripts/verify-ci-backend.mjs", ".next"], source, environment)
        local_builder([bun, "run", "size"], source, environment)
        # Convex's own producer exports its real root modules/schema and exits
        # before push. The closed loopback target has no issuer or real credential.
        backend = workspace / "backend"
        local_builder([bun, "run", "deploy:backend", "--url", "http://127.0.0.1:1",
                       "--admin-key", "inert-local-artifact", "--debug-bundle-path", str(backend),
                       "--codegen", "disable"], source, environment)
        bundle = json.loads((backend / "fullConfig.json").read_text())
        if not any(module["path"] == "health.js" for module in bundle["modules"]):
            raise RuntimeError("backend_health_module_missing")
        root = workspace / "consumer"
        (root / "releases").mkdir(parents=True)
        release = install_release(source, revision, {"revision": revision, "preflight": True}, root)
        # Serve an actual installed CSS asset, not a synthetic fixture. This
        # exercises standalone packaging without Clerk/server secrets or gameplay.
        asset = next((release / ".next/static").rglob("*.css"))
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        process = subprocess.Popen([node, "server.js"], cwd=release,
                                   env={**environment, "HOSTNAME": "127.0.0.1", "PORT": str(port)})
        try:
            url = f"http://127.0.0.1:{port}/_next/static/{asset.relative_to(release / '.next/static')}"
            deadline = time.monotonic() + 30
            while True:
                try:
                    with urllib.request.urlopen(url, timeout=5) as response:
                        if response.read() != asset.read_bytes():
                            raise RuntimeError("installed_asset_consumer_mismatch")
                    break
                except OSError:
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise
                    time.sleep(0.2)
            event("preflight.passed", revision=revision, backend="native_bundle",
                  artifact="standalone", consumer="installed_css", activation=False)
        finally:
            process.terminate()
            process.wait(timeout=15)


def activate(release):
    link = ROOT / f".current.{os.getpid()}"
    try:
        link.symlink_to(release)
        link.replace(ROOT / "current")
    finally:
        link.unlink(missing_ok=True)
    subprocess.run(["systemctl", "restart", "chrondle.service"], check=True, timeout=30)


def healthy(base, revision):
    result = request_json(f"{base}/api/health?revision={revision}")
    if result.get("status") != "ok" or result.get("revision") != revision:
        raise RuntimeError("runtime_revision_or_health_mismatch")


def smoke(revision, source, environment):
    deadline = time.monotonic() + 60
    while True:
        try:
            healthy("http://127.0.0.1:3007", revision)
            break
        except (OSError, ValueError, RuntimeError):
            if time.monotonic() >= deadline:
                raise
            time.sleep(2)
    healthy("https://chrondle.app", revision)
    as_builder([NODE, "scripts/verify-deployment.mjs"], source, environment)
    as_builder([NODE, "scripts/verify-webhook-redirect.mjs"], source, environment)
    for path in ["/", "/archive"]:
        with urllib.request.urlopen(f"https://chrondle.app{path}", timeout=20) as response:
            if response.status != 200:
                raise RuntimeError("page_smoke_failed")


def recover_interrupted_activation():
    path = STATE / "result.json"
    if not path.exists():
        return
    result = json.loads(path.read_text())
    if result.get("status") != "activating":
        return
    previous = Path(result["previous"]).resolve(strict=True)
    if not previous.is_relative_to(ROOT / "releases") or not previous.is_dir():
        raise RuntimeError("rollback_target_escaped")
    activate(previous)
    deadline = time.monotonic() + 30
    while True:
        try:
            if request_json("http://127.0.0.1:3007/api/health").get("status") == "ok":
                break
        except OSError:
            pass
        if time.monotonic() >= deadline:
            raise RuntimeError("rollback_health_failed")
        time.sleep(2)
    write_json(path, {**result, "status": "failed", "error_class": "IncompleteHostSmoke"})
    event("release.rolled_back", revision=result["revision"], run_id=result["run_id"], restored=previous.name)


def deploy(run):
    revision = run["head_sha"]
    receipt = {"revision": revision, "run_id": run["id"], "run_attempt": run["run_attempt"],
               "run_url": run["html_url"]}
    previous = (ROOT / "current").resolve(strict=True)
    write_json(STATE / "attempted.json", receipt)
    event("release.started", **receipt, previous=previous.name)
    try:
        with tempfile.TemporaryDirectory(prefix="build-", dir=STATE) as directory:
            workspace = Path(directory)
            environment = public_build_environment(revision, workspace, host_public_environment())
            source = build_release(revision, workspace, environment)
            release = install_release(source, revision, receipt)
            write_json(STATE / "result.json", {**receipt, "status": "activating", "previous": str(previous)})
            try:
                activate(release)
                smoke(revision, source, environment)
            except Exception:
                # The same durable recovery also runs after a kill/timeout.
                recover_interrupted_activation()
                raise
            write_json(STATE / "result.json", {**receipt, "status": "healthy", "previous": previous.name})
            write_json(release / "public/deployment.json", {**receipt, "status": "healthy"})
        event("release.healthy", **receipt)
    except Exception as error:
        result_path = STATE / "result.json"
        pending = json.loads(result_path.read_text()) if result_path.exists() else {}
        # Leave an incomplete rollback recoverable by systemd ExecStopPost.
        if pending.get("status") != "activating":
            write_json(result_path, {**receipt, "status": "failed", "error_class": type(error).__name__})
        event("release.failed", **receipt, error_class=type(error).__name__)
        raise


def main():
    # At most two public API calls every three minutes: <=40/hour/IP while busy,
    # <=20/hour when idle. No token or new inbound host access is required.
    runs = request_json(f"{API}/actions/workflows/deploy.yml/runs?branch=master&status=in_progress&per_page=1")["workflow_runs"]
    if not runs:
        return
    run = runs[0]
    identity = (run["id"], run["run_attempt"])
    attempted = STATE / "attempted.json"
    if attempted.exists():
        previous_attempt = json.loads(attempted.read_text())
        if identity == (previous_attempt["run_id"], previous_attempt["run_attempt"]):
            return
    jobs = request_json(f'{API}/actions/runs/{run["id"]}/jobs?per_page=100')["jobs"]
    if candidate(run, jobs):
        deploy(run)


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--recover"]:
            recover_interrupted_activation()
        elif len(sys.argv) == 3 and sys.argv[1] == "--preflight":
            preflight(sys.argv[2])
        elif not sys.argv[1:]:
            main()
        else:
            raise RuntimeError("unknown_release_command")
    except Exception as error:
        event("reconcile.failed", error_class=type(error).__name__)
        raise SystemExit(1) from None
