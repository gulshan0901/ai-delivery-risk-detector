def codex_remediation() -> dict[str, object]:
    return {
        "suspectedRootCause": "Dependency or environment mismatch is causing the build pipeline to fail before QA validation.",
        "fixPlan": [
            "Reproduce the failing command locally with the same Node/runtime version as CI.",
            "Check lockfile drift and dependency version mismatches.",
            "Add a regression test around the failing module after the dependency fix.",
            "Re-run CI and attach the remediation note to the release ticket.",
        ],
        "patchPrompt": (
            "Use Codex to inspect the failing module, dependency lockfile, and test output. Generate the smallest "
            "patch that restores the build and adds a regression test."
        ),
    }
