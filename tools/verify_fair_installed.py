"""Outside-checkout wheel reproduction for the fair extension."""

import copy, importlib, json, subprocess, sys, tempfile
from pathlib import Path

expected = json.load(open(sys.argv[1]))
origins = []
for name in [
    "branchlab",
    "branchlab.input",
    "branchlab.core",
    "branchlab.verify",
    "branchlab.__main__",
    "branchlab.fair_input",
    "branchlab.fair",
    "branchlab.fair_verify",
    "branchlab.fair_cli",
]:
    p = Path(importlib.import_module(name).__file__).resolve()
    assert "site-packages" in p.parts
    origins.append(str(p))
from branchlab.fair import analyze_fair
from branchlab.fair_verify import verify_fair

entry = [str(Path(sys.executable).with_name("branchlab-fair"))]
with tempfile.TemporaryDirectory() as d:
    for e in expected:
        assert analyze_fair(e["input"]) == e["report"]
        assert verify_fair(e["report"])
    for command in [entry, [sys.executable, "-m", "branchlab.fair_cli"]]:
        for e in expected:
            p = subprocess.run(
                command + ["-"],
                input=json.dumps(e["input"]),
                text=True,
                capture_output=True,
                cwd=d,
            )
            assert p.returncode == 0, p.stderr
            assert json.loads(p.stdout) == e["report"]
            p = subprocess.run(
                command + ["-", "--verify"],
                input=json.dumps(e["report"]),
                text=True,
                capture_output=True,
                cwd=d,
            )
            assert p.returncode == 0, p.stderr
            assert json.loads(p.stdout) == {
                "valid": True,
                "schema": "branchlab-fair-v1",
            }
    for i in range(24):
        report = copy.deepcopy(expected[i % len(expected)]["report"])
        report["fair_states"] = ["forged"]
        try:
            verify_fair(report)
        except ValueError:
            pass
        else:
            raise AssertionError("checker accepted forgery")
        dest = Path(d) / "preserve.json"
        dest.write_bytes(b"existing output\n")
        p = subprocess.run(
            entry + ["-", "--verify", "--output", str(dest)],
            input=json.dumps(report),
            text=True,
            capture_output=True,
            cwd=d,
        )
        assert p.returncode == 2 and p.stdout == "" and "Traceback" not in p.stderr
        assert dest.read_bytes() == b"existing output\n"
        assert sorted(x.name for x in Path(d).iterdir()) == ["preserve.json"]
print(
    json.dumps(
        {
            "fair_reports": len(expected),
            "entrypoints": 2,
            "installed_origins": origins,
            "forged_cli_rejections_and_atomic_preservation": 24,
            "direct_checker_forgeries": 24,
        }
    )
)
