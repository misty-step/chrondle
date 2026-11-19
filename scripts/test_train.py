import json
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
            (train.State.VERIFIED, train.Event.VERIFY_ONLY, train.State.DONE, None),
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

    def test_custody_file_read_only_after_build_and_checkout_removal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            argv = ["train.py", "--repo", str(root / "repo"), "--home", str(state),
                    "--node", "/opt/node", "--bun", "/opt/bun", "--rustup", "/opt/rustup",
                    "--cargo-bin", "/opt/cargo", "--worker-bin", "/opt/worker",
                    "--wrangler", "/opt/wrangler/bin/wrangler.js", "--image", "sha256:" + "a" * 64,
                    "--credentials", str(root / "operator.env"), "--promote"]
            built = []
            def build(args, source, *rest):
                built.append(source)
            def read(path):
                self.assertTrue(built)
                self.assertFalse(built[0].exists())
                return {"CLOUDFLARE_API_TOKEN": "test"}
            with patch("sys.argv", argv), patch.object(train, "command", return_value="a" * 40), patch.object(train, "config_at", return_value={}), patch.object(train, "public_at", return_value={}), patch.object(train, "build", side_effect=build) as builder, patch.object(train, "stage", return_value={}), patch.object(train, "stage_backend", return_value={}), patch.object(train, "deployment_tool"), patch.object(train, "credentials", side_effect=read) as creds, patch.object(train, "preflight", return_value=("old", "b" * 40)), patch.object(train, "activate", return_value=train.State.DONE):
                self.assertEqual(train.main(), 0)
                creds.assert_called_once()
                creds.reset_mock()
                builder.side_effect = RuntimeError("build failed")
                with patch("sys.stderr"):
                    self.assertEqual(train.main(), 0)  # unchanged successful source coalesces
                # Remove only the test receipt so this tick exercises a failing build.
                (state / "events.jsonl").unlink()
                with patch("sys.stderr"):
                    self.assertEqual(train.main(), 1)
                creds.assert_not_called()

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

    def test_receipt_projection_retains_success_after_failed_later_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            train.receipt(path, sha="first", state="DONE", promoted=True)
            first = path.read_bytes()
            train.receipt(path, sha="second", state="FAILED", promoted=False)
            train.receipt(path, sha="third", state="DONE", promoted=False)
            self.assertTrue(path.read_bytes().startswith(first))
            self.assertEqual(train.last_promoted(path), "first")

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
