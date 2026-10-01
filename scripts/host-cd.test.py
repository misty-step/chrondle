#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("host_cd", Path(__file__).with_name("host-cd.py"))
cd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cd)


class DeploymentBoundary(unittest.TestCase):
    def setUp(self):
        self.run = {"head_branch": "master", "head_repository": {"full_name": "misty-step/chrondle"},
                    "event": "push", "status": "in_progress", "head_sha": "a" * 40}
        self.jobs = [{"name": "Deploy compatible backend", "status": "completed", "conclusion": "success"},
                     {"name": "Deploy native host", "status": "in_progress"}]

    def test_green_backend_with_live_observer_can_deploy(self):
        self.assertEqual(cd.candidate(self.run, self.jobs)["head_sha"], "a" * 40)

    def test_failed_backend_or_absent_observer_cannot_activate(self):
        for change in [{"conclusion": "failure"}, {"status": "in_progress"}]:
            with self.subTest(change=change):
                self.assertIsNone(cd.candidate(self.run, [{**self.jobs[0], **change}, self.jobs[1]]))
        for status in ["queued", "completed"]:
            with self.subTest(status=status):
                self.assertIsNone(cd.candidate(self.run, [self.jobs[0], {**self.jobs[1], "status": status}]))

    def test_untrusted_source_or_ref_cannot_deploy(self):
        for change in [{"head_branch": "feature"}, {"event": "pull_request"},
                       {"head_repository": {"full_name": "attacker/chrondle"}},
                       {"head_sha": "../../etc"}, {"status": "completed"}]:
            with self.subTest(change=change):
                self.assertIsNone(cd.candidate({**self.run, **change}, self.jobs))

    def test_build_receives_public_configuration_not_runtime_credentials(self):
        environment = cd.public_build_environment("a" * 40, Path("/build"), {
            "NEXT_PUBLIC_CONVEX_URL": "https://fleet-goldfish-183.convex.cloud",
            "CLERK_SECRET_KEY": "synthetic-private-clerk",
            "CONVEX_DEPLOY_KEY": "synthetic-private-deploy",
            "NEXT_PUBLIC_CLERK_SECRET_KEY": "synthetic-private-misnamed",
            "STRIPE_SECRET_KEY": "synthetic-private-stripe",
        })
        self.assertEqual(environment["NEXT_PUBLIC_CONVEX_URL"], "https://fleet-goldfish-183.convex.cloud")
        self.assertFalse(any(value.startswith("synthetic-private") for value in environment.values()))

    def test_native_release_cannot_embed_a_nonproduction_backend(self):
        with self.assertRaisesRegex(RuntimeError, "native_backend_is_not_production"):
            cd.public_build_environment("a" * 40, Path("/build"), {
                "NEXT_PUBLIC_CONVEX_URL": "https://handsome-raccoon-955.convex.cloud",
            })

    def test_artifact_links_cannot_make_root_copy_host_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            tree = source / "standalone"
            tree.mkdir()
            (tree / "module.js").write_text("export default 1")
            (tree / "local.js").symlink_to("module.js")
            cd.validate_artifact_tree(tree, source)
            (source / "private.env").write_text("synthetic-secret")
            (tree / "leak.env").symlink_to("../private.env")
            with self.assertRaisesRegex(RuntimeError, "artifact_link_escaped"):
                cd.validate_artifact_tree(tree, source)


if __name__ == "__main__":
    unittest.main()
