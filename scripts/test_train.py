import json
import os
import subprocess
import shutil
import random
import tempfile
from pathlib import Path
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest
from unittest.mock import patch, Mock
from types import SimpleNamespace

import train


class TrainTests(unittest.TestCase):
    def test_transition_table(self):
        cases = [
            (train.State.SELECTED, train.Event.BUILD_OK, train.State.VERIFIED, None),
            (train.State.VERIFIED, train.Event.RELEASE, train.State.PROMOTING, "promote"),
            (train.State.PROMOTING, train.Event.SMOKE_FAILED, train.State.RECOVERING, "rollback"),
            (train.State.RECOVERING, train.Event.RECOVERED, train.State.FAILED, None),
            (train.State.PROMOTING, train.Event.SMOKE_OK, train.State.DONE, None),
        ]
        cases += [
            (train.State.VERIFIED, train.Event.BACKEND_RELEASE, train.State.BACKING_UP, "backup"),
            (train.State.BACKING_UP, train.Event.BACKUP_OK, train.State.BACKEND_DEPLOYING, "deploy_backend"),
            (train.State.BACKEND_DEPLOYING, train.Event.BACKEND_OK, train.State.BACKEND_VERIFIED, None),
            (train.State.BACKEND_VERIFIED, train.Event.RELEASE, train.State.PROMOTING, "promote"),
        ]
        for state in train.State:
            expected = train.State.RECOVERING if state in (train.State.BACKEND_DEPLOYING, train.State.BACKEND_VERIFIED, train.State.PROMOTING) else (state if state in (train.State.DONE, train.State.FAILED) else train.State.FAILED)
            self.assertEqual(train.step(state, train.Event.ERROR), (expected, "rollback" if expected == train.State.RECOVERING else None))
        for state in (train.State.BACKEND_DEPLOYING, train.State.BACKEND_VERIFIED):
            self.assertEqual(train.step(state, train.Event.SMOKE_FAILED), (train.State.RECOVERING, "rollback"))
        for state, event, next_state, effect in cases:
            self.assertEqual(train.step(state, event), (next_state, effect))

    def test_random_sequences_never_promote_without_verification(self):
        randomizer = random.Random(7034)
        for _ in range(512):
            state = train.State.SELECTED
            for _ in range(128):
                event = randomizer.choice(list(train.Event))
                next_state, effect = train.step(state, event)
                if effect == "promote":
                    self.assertIn(state, (train.State.VERIFIED, train.State.BACKEND_VERIFIED))
                    self.assertEqual(event, train.Event.RELEASE)
                if effect == "rollback":
                    self.assertIn(state, (train.State.PROMOTING, train.State.BACKEND_DEPLOYING, train.State.BACKEND_VERIFIED))
                    self.assertIn(event, (train.Event.SMOKE_FAILED, train.Event.ERROR))
                if state in (train.State.DONE, train.State.FAILED):
                    self.assertEqual((next_state, effect), (state, None))
                state = next_state

    def test_credentials_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credentials"
            path.write_text("CLOUDFLARE_API_TOKEN=test\nCF_ACCESS_CLIENT_ID=id\nCF_ACCESS_CLIENT_SECRET=secret\n")
            path.chmod(0o644)
            with self.assertRaisesRegex(RuntimeError, "0600"):
                train.credentials(path)
            path.chmod(0o600)
            self.assertEqual(len(train.credentials(path)), 3)
            path.write_text("CLOUDFLARE_API_TOKEN=test\n")
            with self.assertRaisesRegex(RuntimeError, "Missing"):
                train.credentials(path)
            link = path.with_name("link")
            link.symlink_to(path)
            with self.assertRaises(OSError):
                train.credentials(link)

    def test_backend_release_and_recovery(self):
        # Failure at every post-deploy boundary, including an ambiguous deploy error.
        for failure in (None, "backend deploy", "backend readback", "web deploy", "web readback", "final backend readback", "rollback backend"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                home = Path(directory)
                artifact = home / "artifact"
                artifact.mkdir()
                (home / "backend").mkdir()
                web, backend = {"name": "web"}, {"name": "backend"}
                pointers = {"web": "old-web", "backend": "old-backend"}
                operations = []
                reads = []
                def deploy(args, path, token, *action, log):
                    family = "backend" if path.name == "backend" else "web"
                    operations.append("deploy " + family)
                    pointers[family] = "new-" + family
                    if failure == family + " deploy":
                        raise RuntimeError("ambiguous deploy failure")
                def restore(config, token, version):
                    operations.append("restore " + config["name"])
                    if failure == "rollback backend" and config == backend:
                        raise RuntimeError("provider unavailable")
                    pointers[config["name"]] = version
                def backend_read(sha):
                    reads.append(sha)
                    if sha == "candidate" and (failure == "backend readback" or (failure == "final backend readback" and len(reads) == 2)):
                        raise RuntimeError("bad backend")
                def web_read(sha, **kwargs):
                    if sha == "candidate" and failure in ("web readback", "rollback backend"):
                        raise RuntimeError("bad web")
                events = home / "events.jsonl"
                with patch.object(train, "request", return_value=(200, {}, b'{"key":"backups/recovery"}')) as request, patch.object(train, "deployed", side_effect=lambda c, t: pointers[c["name"]]), patch.object(train, "serving_source", side_effect=lambda c,t,v: "prior-backend" if v == "old-backend" else "candidate"), patch.object(train, "run_wrangler", side_effect=deploy), patch.object(train, "restore", side_effect=restore), patch.object(train, "backend_smoke", side_effect=backend_read), patch.object(train, "settled_smoke", side_effect=web_read):
                    call = lambda: train.activate(SimpleNamespace(home=home), artifact, "candidate", web, "token", "old-web", "prior-web", None, backend_config=backend, secrets={"CF_ACCESS_CLIENT_ID": "id", "CF_ACCESS_CLIENT_SECRET": "secret"}, events=events)
                    if failure:
                        with self.assertRaisesRegex(RuntimeError, "backup_key=backups/recovery"):
                            call()
                        self.assertIn("restore backend", operations)
                        if "deploy web" in operations:
                            self.assertIn("restore web", operations)
                        self.assertIn("prior-backend", reads)
                    else:
                        self.assertEqual(call(), train.State.DONE)
                        self.assertEqual(operations, ["deploy backend", "deploy web"])
                    self.assertEqual(request.call_args.kwargs["headers"]["CF-Access-Client-Id"], "id")
                    self.assertIn('"backup_key": "backups/recovery"', events.read_text())

    def test_web_only_release_never_touches_backend(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory)
            with patch.object(train, "run_wrangler"), patch.object(train, "deployed", return_value="new"), patch.object(train, "serving_source", return_value="candidate"), patch.object(train, "settled_smoke"), patch.object(train, "backend_smoke") as backend, patch.object(train, "request") as request:
                self.assertEqual(train.activate(SimpleNamespace(), artifact, "candidate", {}, "test", "old", "prior", None), train.State.DONE)
                backend.assert_not_called()
                request.assert_not_called()

    def test_split_phases_custody_and_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            home, repo = root / "state", root / "repo"
            repo.mkdir()
            sha = "a" * 40
            argv = ["train.py", "--repo", str(repo), "--home", str(home), "--sha", sha]
            def staged(source, target, *rest):
                target.mkdir()
                (target / "worker.js").write_text("verified")
                return train.hashes(target)
            with patch.object(train, "command", return_value=sha), patch.object(train, "config_at", return_value={}), patch.object(train, "public_at", return_value={}), patch.object(train, "build") as build, patch.object(train, "stage", side_effect=staged), patch.object(train, "stage_backend", side_effect=staged), patch.object(train, "trusted_wrangler", return_value=Path("/opt/wrangler")), patch.object(train, "credentials", return_value={"CLOUDFLARE_API_TOKEN": "test"}) as creds, patch.object(train, "preflight", return_value=("old", "b" * 40)), patch.object(train, "activate", return_value=train.State.DONE) as activate:
                with patch("sys.argv", argv + ["--phase", "verify"]):
                    self.assertEqual(train.main(), 0)
                creds.assert_not_called()
                build.assert_called_once()
                with patch("sys.argv", argv + ["--phase", "promote", "--credentials", str(root / "key")]):
                    self.assertEqual(train.main(), 0)
                creds.assert_called_once()
                build.assert_called_once()  # Promote never rebuilds.
                activate.assert_called_once()
                with patch("sys.argv", argv + ["--phase", "promote", "--credentials", str(root / "key")]):
                    self.assertEqual(train.main(), 1)  # Consumed receipt cannot replay.
                self.assertEqual(creds.call_count, 1)

    def test_failed_verify_never_reads_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch("sys.argv", ["train.py", "--repo", str(root / "repo"), "--home", str(root / "state"), "--sha", "a" * 40, "--phase", "verify"]), patch.object(train, "command", return_value="a" * 40), patch.object(train, "config_at", return_value={}), patch.object(train, "public_at", return_value={}), patch.object(train, "build", side_effect=RuntimeError("bad build")), patch.object(train, "credentials") as creds:
                self.assertEqual(train.main(), 1)
                creds.assert_not_called()

    def test_verified_rejects_tampering_and_full_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            for name in ("artifact", "backend"):
                (home / name).mkdir()
                (home / name / "worker.js").write_text("verified")
            events = home / "events.jsonl"
            train.receipt(events, state="VERIFIED", sha="sha", mode="fast", hashes=train.hashes(home / "artifact"), backend_hashes=train.hashes(home / "backend"))
            train.verified(events, "sha", "fast", home)
            with self.assertRaises(RuntimeError):
                train.verified(events, "sha", "full", home)
            (home / "backend/worker.js").write_text("changed")
            with self.assertRaisesRegex(RuntimeError, "bytes differ"):
                train.verified(events, "sha", "fast", home)

    def test_build_direct_and_sanitized(self):
        with patch.dict("os.environ", {"CLOUDFLARE_API_TOKEN": "never-forward", "CF_ACCESS_CLIENT_SECRET": "never-forward"}), patch.object(train.subprocess, "run") as run:
            train.build(SimpleNamespace(mode="fast"), Path("/repo"), {}, "a" * 40, None)
            argv = run.call_args.args[0]
            self.assertEqual(argv[:2], ["bash", "-c"])
            self.assertIn("--dry-run", argv[2])
            self.assertNotIn("docker", argv[2])
            self.assertNotIn("CLOUDFLARE_API_TOKEN", run.call_args.kwargs["env"])
            self.assertNotIn("CF_ACCESS_CLIENT_SECRET", run.call_args.kwargs["env"])

    def test_status_uses_serving_annotation(self):
        with patch("sys.argv", ["train.py", "--phase", "status", "--repo", "/repo", "--sha", "a" * 40, "--credentials", "/key"]), patch.object(train, "config_at", return_value={}), patch.object(train, "credentials", return_value={"CLOUDFLARE_API_TOKEN": "test"}), patch.object(train, "deployed", return_value="production-version"), patch.object(train, "serving_source", return_value="b" * 40) as source, patch("builtins.print") as output:
            self.assertEqual(train.main(), 0)
            source.assert_called_once_with({}, "test", "production-version")
            output.assert_called_once_with("b" * 40)

    def test_backend_stage_removes_build_hooks_and_rejects_tool_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, target = root / "source", root / "backend"
            source.mkdir()
            (source / "worker.js").write_text("export default {}")
            config = {"name": "chrondle-backend", "account_id": "account", "build": {"command": "unsafe"}, "main": "src/worker.ts", "vars": {"ENVIRONMENT": "production"}}
            train.stage_backend(source, target, config)
            staged = json.loads((target / "wrangler.json").read_text())
            self.assertNotIn("build", staged["env"]["production"])
            self.assertTrue(staged["no_bundle"])
            (source / "package.json").write_text("{}")
            with self.assertRaisesRegex(RuntimeError, "bundled backend"):
                train.stage_backend(source, target, config)

    def test_restore_uses_version_pointer_api(self):
        with patch.object(train, "request", return_value=(200, {}, b'{"success":true}')) as request, patch.object(train, "deployed", return_value="prior"):
            train.restore({"account_id": "account", "name": "backend"}, "test", "prior")
            self.assertTrue(request.call_args.args[0].endswith("/workers/scripts/backend/deployments"))
            self.assertEqual(json.loads(request.call_args.args[2])["versions"], [{"version_id": "prior", "percentage": 100}])

    def test_backup_failure_never_deploys(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            (home / "backend").mkdir()
            with patch.object(train, "request", return_value=(403, {}, b"")), patch.object(train, "run_wrangler") as deploy:
                with self.assertRaisesRegex(RuntimeError, "no deployment attempted"):
                    train.activate(SimpleNamespace(home=home), home, "sha", {}, "token", "old", "prior", None, backend_config={"name": "backend"}, secrets={"CF_ACCESS_CLIENT_ID": "id", "CF_ACCESS_CLIENT_SECRET": "secret"})
                deploy.assert_not_called()

    def test_launcher_with_fake_boat(self):
        # Real launcher subprocess, fake git/provider/Boat; no credentials or network.
        for failure in ("", "unchanged", "status", "create", "clone", "verify", "promote", "collect", "delete", "credentials", "full", "signal"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                scripts, binaries = root / "scripts", root / "bin"
                scripts.mkdir()
                binaries.mkdir()
                shutil.copyfile(Path(__file__).with_name("release-on-boat"), scripts / "release-on-boat")
                (scripts / "train.py").write_text('''import os
import sys
def credentials(path):
    return {"CLOUDFLARE_API_TOKEN": "test-fixture", "CF_ACCESS_CLIENT_ID": "test-id", "CF_ACCESS_CLIENT_SECRET": "test-secret"}
if __name__ == "__main__":
    if os.environ.get("FAIL") == "status": sys.exit(1)
    print(("a" if os.environ.get("FAIL") == "unchanged" else "b") * 40)
''')
                (binaries / "git").write_text("#!/bin/sh\nif [ \"$1\" = ls-remote ]; then printf '%040d\\trefs/heads/master\\n' 0 | tr 0 a; fi\n".replace('\"', '"'))
                (binaries / "boat").write_text(r'''#!/usr/bin/env python3
import json, os, pathlib, signal, sys
args = sys.argv[2:]
with open(os.environ["CALLS"], "a") as out: out.write(json.dumps(args) + "\n")
fail = os.environ.get("FAIL")
if args[0] == "new":
    if fail == "create": sys.exit(1)
    print(json.dumps({"sandbox": {"id": "bx_fixture"}}))
elif args[0] == "ssh":
    command = args[-1]
    if "cat >" in command:
        payload = sys.stdin.buffer.read()
        assert b"test-fixture" in payload
        if fail == "credentials": sys.exit(1)
    if fail == "signal" and "--phase verify" in command:
        os.kill(os.getppid(), signal.SIGTERM)
    if (fail == "clone" and "git clone" in command) or (fail in ("verify", "promote") and "--phase " + fail in command): sys.exit(1)
elif args[0] == "scp":
    if fail == "collect": sys.exit(1)
    pathlib.Path(args[-1]).write_text('{"state":"BACKING_UP","backup_key":"backups/fixture"}\n' if "events.jsonl" in args[1] else "fixture log\n")
elif args[0] == "delete" and fail == "delete": sys.exit(1)
''')
                for binary in binaries.iterdir():
                    binary.chmod(0o755)
                calls = root / "calls"
                result = subprocess.run(["python3", str(scripts / "release-on-boat"), "--credentials", str(root / "not-a-real-key"), "--evidence", str(root / "evidence"), "--mode", "full" if failure == "full" else "fast"], env={**os.environ, "PATH": str(binaries) + ":" + os.environ["PATH"], "CALLS": str(calls), "FAIL": failure}, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0 if failure in ("", "unchanged", "full") else 1, result.stderr)
                self.assertEqual(result.stdout, "")
                entries = [json.loads(line) for line in calls.read_text().splitlines()] if calls.exists() else []
                actions = [entry[0] for entry in entries]
                if failure in ("unchanged", "status"):
                    self.assertEqual(entries, [])
                elif failure == "create":
                    self.assertEqual(actions, ["new"])
                else:
                    self.assertEqual(actions[-1], "delete")
                    self.assertEqual(actions.count("scp"), 2)
                    self.assertEqual(entries[0], ["new", "--environment", "mis-factory-worker", "--json"])
                remote = [entry[-1] for entry in entries if entry[0] == "ssh"]
                if failure in ("", "promote", "collect", "delete"):
                    self.assertIn("--phase verify", remote[1])
                    self.assertIn("cat >", remote[2])
                    self.assertIn("--phase promote", remote[3])
                elif failure == "credentials":
                    self.assertIn("--phase verify", remote[1])
                    self.assertIn("cat >", remote[2])
                    self.assertFalse(any("--phase promote" in command for command in remote))
                else:
                    self.assertFalse(any("cat >" in command for command in remote))
                if result.returncode:
                    self.assertEqual(len(result.stderr.splitlines()), 1)
                    self.assertIn('"repo": "misty-step/chrondle"', result.stderr)
                self.assertNotIn("test-secret", result.stderr)
                self.assertNotIn("test-fixture", calls.read_text() if calls.exists() else "")

    def test_artifact_hashes_reject_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "worker.js").write_text("export default {}")
            before = train.hashes(root)
            (root / "link").symlink_to(root / "worker.js")
            with self.assertRaisesRegex(RuntimeError, "links"):
                train.hashes(root)
            (root / "link").unlink()
            self.assertEqual(train.hashes(root), before)

    def test_staging_checks_trusted_contract_and_copies_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source"
            source.mkdir()
            (source / "worker").mkdir()
            (source / "worker/entry.js").write_text("export default {}")
            config: dict = dict(name="test", account_id="test", compatibility_date="2026-09-17",
                          compatibility_flags=[], workers_dev=False, preview_urls=False,
                          routes=[], observability={"enabled": True}, assets={"binding": "ASSETS"})
            packaged = {**config, "assets": {**config["assets"], "directory": "assets"},
                        "main": "worker/entry.js", "no_bundle": True, "find_additional_modules": True,
                        "rules": [{"type": "CompiledWasm", "globs": ["**/*.wasm"], "fallthrough": True}],
                        "send_metrics": False, "vars": {"NEXT_PUBLIC_CONVEX_URL": "https://backend.invalid"}}
            (source / "wrangler.json").write_text(json.dumps(packaged))
            manifest = train.stage(source, root / "staged", config, packaged["vars"])
            self.assertEqual(manifest, train.hashes(root / "staged"))
            packaged["build"] = {"command": "do-not-run"}
            (source / "wrangler.json").write_text(json.dumps(packaged))
            with self.assertRaisesRegex(RuntimeError, "trusted source"):
                train.stage(source, root / "staged", config, packaged["vars"])

    def test_real_http_redirects_are_not_followed(self):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def do_GET(self):
                self.send_response(302)
                self.send_header("Location", "/must-not-follow")
                self.end_headers()

            def do_POST(self):
                self.send_response(401)
                self.end_headers()
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            url = "http://127.0.0.1:" + str(server.server_port)
            self.assertEqual(train.request(url)[0], 302)
            self.assertEqual(train.request(url, data=b"{}")[0], 401)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_smoke_real_http_success_unhealthy_rejection_and_recovery(self):
        sha = "a" * 40
        mode = ["healthy"]

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def do_GET(self):
                if self.path.startswith("/api/health"):
                    self.send_response(503 if mode[0] == "unhealthy" else 200)
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "ok", "revision": sha, "checks": {"convex": "ok"}}).encode())
                elif self.path == "/robots.txt":
                    self.send_response(200)
                    self.send_header("X-Chrondle-Runtime", "rust")
                    self.send_header("X-Chrondle-Revision", sha)
                    self.end_headers()
                    self.wfile.write(b"Sitemap: https://chrondle.app/sitemap.xml")
                else:
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"Chrondle</html>")

            def do_POST(self):
                self.send_response(401 if self.path.endswith("checkout") else 400)
                self.end_headers()

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        origins = ("http://127.0.0.1:" + str(server.server_port),)
        try:
            train.settled_smoke(sha, origins=origins)
            mode[0] = "unhealthy"
            with self.assertRaisesRegex(RuntimeError, "health failed"):
                train.settled_smoke(sha, origins=origins)
            mode[0] = "healthy"
            train.settled_smoke(sha, origins=origins)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
