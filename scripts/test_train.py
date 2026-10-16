import json
import random
import tempfile
from pathlib import Path
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest

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
                    self.assertEqual((state, event), (train.State.VERIFIED, train.Event.RELEASE))
                if effect == "rollback":
                    self.assertEqual((state, event), (train.State.PROMOTING, train.Event.SMOKE_FAILED))
                if state in (train.State.DONE, train.State.FAILED):
                    self.assertEqual((next_state, effect), (state, None))
                state = next_state

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
            config = dict(name="test", account_id="test", compatibility_date="2026-09-17",
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
            def log_message(self, *args):
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


if __name__ == "__main__":
    unittest.main()
