import copy, json, subprocess, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from branchlab.fair import analyze_fair
from branchlab.fair_verify import verify_fair
from tools.fair_cases import controls, exhaustive, seeded, atom, unary, binary, request


class FairTests(unittest.TestCase):
    def test_complete_reports(self):
        xs = list(exhaustive()) + seeded() + [c["input"] for c in controls()]
        for x in xs:
            self.assertTrue(verify_fair(analyze_fair(x)))
        print("fair complete reports", len(xs))

    def test_repeated_hub_needed(self):
        r = analyze_fair(controls()[0]["input"])
        w = r["region_atlas"][-1]["witnesses"][0]
        self.assertEqual(
            w,
            {
                "prefix": ["s0"],
                "cycle": ["s0", "s1", "s0", "s2", "s0"],
                "justice_positions": [1, 3],
            },
        )
        self.assertEqual(r["fair_states"], ["s0", "s1", "s2"])

    def test_no_fair_path_keeps_local_atoms(self):
        r = analyze_fair(controls()[9]["input"])
        self.assertEqual([x["truth"] for x in r["results"]], [[], ["s0"], ["s0"], []])
        self.assertEqual(r["no_fair_states"], ["s0"])

    def test_separate_reachability_not_same_fair_path(self):
        r = analyze_fair(controls()[3]["input"])
        self.assertEqual(r["fair_states"], [])
        self.assertTrue(all(not x["fair_recurrent"] for x in r["region_atlas"]))

    def test_transient_justice_not_enough(self):
        self.assertEqual(analyze_fair(controls()[4]["input"])["fair_states"], [])

    def test_region_before_fairness(self):
        r = analyze_fair(controls()[5]["input"])
        self.assertEqual(r["fair_states"], ["s0", "s1"])
        self.assertEqual(r["results"][0]["ordinary_truth"], ["s0"])
        self.assertEqual(r["results"][0]["truth"], [])

    def test_no_justice_recovers_ordinary_every_subformula(self):
        for x in seeded() + [c["input"] for c in controls()]:
            x = copy.deepcopy(x)
            x["justice"] = []
            for f in analyze_fair(x)["subformulas"]:
                self.assertEqual(f["truth"], f["ordinary_truth"])

    def test_cycle_not_singleton_only(self):
        r = analyze_fair(controls()[6]["input"])
        self.assertEqual(r["fair_states"], ["s0", "s1"])
        self.assertTrue(r["region_atlas"][-1]["fair_recurrent"])
        self.assertFalse(r["region_atlas"][1]["recurrent"])

    def test_until_endpoint_fair_suffix(self):
        r = analyze_fair(controls()[7]["input"])
        self.assertEqual(r["results"][0]["truth"], [])
        self.assertEqual(r["results"][0]["ordinary_truth"], ["s0", "s1"])

    def test_all_witnesses_edges_region_and_justice(self):
        for c in controls():
            r = analyze_fair(c["input"])
            adj = {s["name"]: s["next"] for s in r["input"]["model"]["states"]}
            for t in r["region_atlas"]:
                for root, w in enumerate(t["witnesses"]):
                    if w is None:
                        continue
                    self.assertEqual(
                        w["prefix"][0], r["input"]["model"]["states"][root]["name"]
                    )
                    self.assertEqual(w["prefix"][-1], w["cycle"][0])
                    self.assertEqual(w["cycle"][0], w["cycle"][-1])
                    self.assertGreater(len(w["cycle"]), 1)
                    for p in [w["prefix"], w["cycle"]]:
                        self.assertTrue(all(v in t["allowed"] for v in p))
                        self.assertTrue(all(b in adj[a] for a, b in zip(p, p[1:])))
                    for j, p in zip(r["input"]["justice"], w["justice_positions"]):
                        self.assertIn(w["cycle"][p], j)

    def test_no_mutation_permutation(self):
        x = controls()[0]["input"]
        before = copy.deepcopy(x)
        r = analyze_fair(x)
        verify_fair(r)
        self.assertEqual(x, before)
        x = copy.deepcopy(x)
        x["model"]["states"].reverse()
        for s in x["model"]["states"]:
            s["next"].reverse()
            s["labels"].reverse()
        for j in x["justice"]:
            j.reverse()
        z = analyze_fair(x)
        self.assertEqual(set(z["fair_states"]), set(r["fair_states"]))
        self.assertEqual(
            [set(a["truth"]) for a in z["results"]],
            [set(a["truth"]) for a in r["results"]],
        )
        verify_fair(z)

    def test_generator_isolation(self):
        r = analyze_fair(controls()[0]["input"])
        with patch(
            "branchlab.fair.analyze_fair",
            side_effect=AssertionError("generator called"),
        ):
            self.assertTrue(verify_fair(r))

    def test_primitive_corruptions(self):
        r = analyze_fair(controls()[6]["input"])
        leaves = []

        def visit(v, path):
            if type(v) is dict:
                for k, x in v.items():
                    if path or k != "input":
                        visit(x, path + [k])
            elif type(v) is list:
                for k, x in enumerate(v):
                    visit(x, path + [k])
            else:
                leaves.append((path, v))

        visit(r, [])
        for path, v in leaves:
            x = copy.deepcopy(r)
            p = x
            for k in path[:-1]:
                p = p[k]
            p[path[-1]] = (
                not v
                if type(v) is bool
                else v + 1 if type(v) is int else "changed" if type(v) is str else 0
            )
            with self.assertRaises(ValueError, msg=str(path)):
                verify_fair(x)
        print("fair mutated noninput primitive leaves", len(leaves))

    def test_schema_cli_atomic(self):
        base = controls()[0]["input"]
        for change in [
            dict(base, extra=0),
            dict(base, justice=[["absent"]]),
            dict(base, justice=[["s0", "s0"]]),
            dict(base, justice=[[]] * 5),
            dict(base, justice="x"),
        ]:
            with self.assertRaises(ValueError):
                analyze_fair(change)
        with tempfile.TemporaryDirectory() as d:
            cmd = [sys.executable, "-m", "branchlab.fair_cli"]
            p = subprocess.run(
                cmd + ["-"], input=json.dumps(base), text=True, capture_output=True
            )
            self.assertEqual(p.returncode, 0, p.stderr)
            report = json.loads(p.stdout)
            self.assertTrue(verify_fair(report))
            p = subprocess.run(
                cmd + ["-", "--verify"],
                input=json.dumps(report),
                text=True,
                capture_output=True,
            )
            self.assertEqual(
                json.loads(p.stdout), {"valid": True, "schema": "branchlab-fair-v1"}
            )
            dest = Path(d) / "keep.json"
            dest.write_bytes(b"keep")
            report["fair_states"] = []
            for bad in [
                json.dumps(report),
                "{}",
                '{"model":{},"model":{},"justice":[]}',
                '{"model":NaN,"justice":[]}',
                "x" * 65537,
            ]:
                p = subprocess.run(
                    cmd + ["-", "--verify", "--output", str(dest)],
                    input=bad,
                    text=True,
                    capture_output=True,
                )
                self.assertEqual(p.returncode, 2)
                self.assertEqual(p.stdout, "")
                self.assertNotIn("Traceback", p.stderr)
                self.assertEqual(dest.read_bytes(), b"keep")
                self.assertEqual(list(Path(d).iterdir()), [dest])
            p = subprocess.run(
                cmd + ["-"], input="x" * 65537, text=True, capture_output=True
            )
            self.assertEqual(p.returncode, 2)


if __name__ == "__main__":
    unittest.main()
