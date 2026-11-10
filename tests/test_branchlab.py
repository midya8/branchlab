import copy, itertools, json, random, unittest
from branchlab import analyze
from branchlab.verify import verify, replay
from branchlab.input import validate, load
from tools.make_controls import controls, model, atom, unary, binary


class BranchLabTests(unittest.TestCase):
    def test_controls(self):
        for c in controls():
            self.assertTrue(verify(analyze(c["input"])))

    def test_independence(self):
        import ast, pathlib

        tree = ast.parse(pathlib.Path("branchlab/verify.py").read_text())
        self.assertNotIn(
            "core", [a.module for a in ast.walk(tree) if isinstance(a, ast.ImportFrom)]
        )

    def test_default(self):
        r = analyze(controls()[0]["input"])
        self.assertEqual(
            [x["truth"] for x in r["results"]], [["s0", "s1"], ["s1"], ["s0"]]
        )
        self.assertEqual(r["subformulas"][3]["examples"][0]["nodes"], ["s0", "s0"])

    def test_arbitrary_fixed_point_is_not_truth(self):
        r = analyze(controls()[2]["input"])
        eg = r["subformulas"][1]
        eu = r["subformulas"][3]
        self.assertEqual(sum(x["fixed"] for x in eg["subset_atlas"]), 2)
        self.assertEqual(sum(x["fixed"] for x in eu["subset_atlas"]), 2)
        self.assertEqual(eg["truth"], ["s0"])
        self.assertEqual(eu["truth"], [])

    def test_every_two_state_total_graph_and_labeling(self):
        p = atom("p")
        q = atom("q")
        count = 0
        fs = [unary(op, p) for op in ["EX", "AX", "EF", "AF", "EG", "AG"]] + [
            binary(op, p, q) for op in ["EU", "AU"]
        ]
        for rows in itertools.product([[0], [1], [0, 1]], repeat=2):
            for masks in itertools.product(range(4), repeat=2):
                labels = [
                    [a for k, a in enumerate(["p", "q"]) if m >> k & 1] for m in masks
                ]
                r = model(rows, labels, fs)
                self.assertTrue(verify(analyze(r)))
                count += 1
        self.assertEqual(count, 144)

    def test_all_three_state_graphs_with_path_oracle(self):
        # Direct finite-prefix and lasso semantics, not either fixed-point engine.
        p = atom("p")
        q = atom("q")
        fs = [unary(op, p) for op in ["EX", "AX", "EF", "AF", "EG", "AG"]] + [
            binary(op, p, q) for op in ["EU", "AU"]
        ]
        count = 0
        for masks in itertools.product(range(1, 8), repeat=3):
            rows = [[j for j in range(3) if m >> j & 1] for m in masks]
            for lab in range(8):
                labels = [
                    (["p"] if lab >> i & 1 else []) + (["q"] if i == 2 else [])
                    for i in range(3)
                ]
                r = analyze(model(rows, labels, fs))
                pstates = {i for i in range(3) if lab >> i & 1}
                qstates = {2}
                for start in range(3):
                    prefixes = []
                    lassos = []

                    def walk(xs):
                        prefixes.append(xs)
                        for j in rows[xs[-1]]:
                            if j in xs:
                                lassos.append(xs + [j])
                            else:
                                walk(xs + [j])

                    walk([start])
                    ef = any(xs[-1] in pstates for xs in prefixes)
                    af = not any(all(i not in pstates for i in xs) for xs in lassos)
                    eg = any(all(i in pstates for i in xs) for xs in lassos)
                    ag = all(xs[-1] in pstates for xs in prefixes)
                    eu = any(
                        xs[-1] in qstates and all(i in pstates for i in xs[:-1])
                        for xs in prefixes
                    )
                    au = not (
                        any(all(i not in qstates for i in xs) for xs in lassos)
                        or any(
                            xs[-1] not in (pstates | qstates)
                            and all(i not in qstates for i in xs)
                            for xs in prefixes
                        )
                    )
                    expected = [
                        any(j in pstates for j in rows[start]),
                        all(j in pstates for j in rows[start]),
                        ef,
                        af,
                        eg,
                        ag,
                        eu,
                        au,
                    ]
                    self.assertEqual(
                        [f"s{start}" in x["truth"] for x in r["results"]], expected
                    )
                count += 1
        self.assertEqual(count, 2744)

    def test_seeded_nested(self):
        rng = random.Random(7231)

        def formula(depth):
            if depth == 0:
                return atom(rng.choice(["p", "q"]))
            op = rng.choice(
                ["not", "and", "or", "EX", "AX", "EF", "AF", "EG", "AG", "EU", "AU"]
            )
            return (
                binary(op, formula(depth - 1), formula(depth - 1))
                if op in {"and", "or", "EU", "AU"}
                else unary(op, formula(depth - 1))
            )

        for _ in range(120):
            n = rng.randrange(1, 7)
            rows = [
                sorted(
                    set(
                        [rng.randrange(n)]
                        + [j for j in range(n) if rng.random() < 0.35]
                    )
                )
                for i in range(n)
            ]
            labels = [[a for a in ["p", "q"] if rng.random() < 0.5] for _ in range(n)]
            self.assertTrue(
                verify(analyze(model(rows, labels, [formula(3) for _ in range(4)])))
            )

    def test_dualities(self):
        rng = random.Random(91)
        p = atom("p")
        q = atom("q")
        fs = [
            unary("AF", p),
            unary("not", unary("EG", unary("not", p))),
            unary("AG", p),
            unary("not", unary("EF", unary("not", p))),
            unary("AX", p),
            unary("not", unary("EX", unary("not", p))),
            unary("EF", p),
            binary("EU", {"op": "bool", "value": True}, p),
        ]
        for _ in range(60):
            n = 4
            rows = [
                sorted(
                    set(
                        [rng.randrange(n)] + [j for j in range(n) if rng.random() < 0.4]
                    )
                )
                for i in range(n)
            ]
            r = analyze(
                model(
                    rows,
                    [[a for a in ["p", "q"] if rng.random() < 0.5] for _ in range(n)],
                    fs,
                )
            )
            for k in range(0, 8, 2):
                self.assertEqual(r["results"][k]["truth"], r["results"][k + 1]["truth"])

    def test_all_fields_tamper(self):
        r = analyze(controls()[0]["input"])
        count = 0

        def leaves(x, path=[]):
            if type(x) is dict:
                for k, v in x.items():
                    yield from leaves(v, path + [k])
            elif type(x) is list:
                for k, v in enumerate(x):
                    yield from leaves(v, path + [k])
            else:
                yield path, x

        for path, v in leaves(r):
            if path[0] == "input":
                continue
            bad = copy.deepcopy(r)
            d = bad
            for k in path[:-1]:
                d = d[k]
            d[path[-1]] = (
                not v
                if type(v) is bool
                else v + 1 if type(v) is int else "tampered" if type(v) is str else 0
            )
            with self.assertRaises(ValueError):
                verify(bad)
            count += 1
        self.assertEqual(count, 445)

    def test_bool_is_not_int(self):
        r = analyze(controls()[0]["input"])
        r["roots"][0] = True
        with self.assertRaises(ValueError):
            verify(r)

    def test_duplicate_json(self):
        with self.assertRaises(ValueError):
            load('{"a":1,"a":2}')
        with self.assertRaises(ValueError):
            load('{"a":NaN}')

    def test_schema_rejections(self):
        base = controls()[0]["input"]
        bad = []
        for value in [None, [], {}, True, {"states": []}]:
            bad.append(value)
        for change in [
            lambda r: r["states"][0].update(next=[]),
            lambda r: r["states"][0].update(next=["missing"]),
            lambda r: r["states"][0].update(next=["s0", "s0"]),
            lambda r: r["states"][0].update(labels=["missing"]),
            lambda r: r["atoms"].append("p"),
            lambda r: r["states"][0].update(name="a b"),
            lambda r: r.update(extra=1),
            lambda r: r["formulas"][0].update(op="fair"),
            lambda r: r["formulas"][0].update(extra=1),
            lambda r: r.update(formulas=[{"op": "bool", "value": 1}]),
            lambda r: r.update(formulas=[{"op": "atom", "name": 3}]),
            lambda r: r.update(formulas=[]),
            lambda r: r.update(formulas=[{"op": "EX"}]),
        ]:
            r = copy.deepcopy(base)
            change(r)
            bad.append(r)
        for r in bad:
            with self.assertRaises(ValueError):
                analyze(r)

    def test_limits(self):
        r = copy.deepcopy(controls()[0]["input"])
        f = atom("p")
        for _ in range(6):
            f = unary("EX", f)
        r["formulas"] = [f]
        with self.assertRaises(ValueError):
            analyze(r)
        r = copy.deepcopy(controls()[0]["input"])
        r["states"] *= 4
        with self.assertRaises(ValueError):
            analyze(r)

    def test_normalization(self):
        r = copy.deepcopy(controls()[0]["input"])
        r["states"][0]["next"].reverse()
        a = analyze(r)
        self.assertTrue(verify(a))
        self.assertEqual(a["input"]["states"][0]["next"], ["s0", "s1"])

    def test_verifier_standalone(self):
        import subprocess, sys

        code = (
            'import sys;from branchlab.verify import replay;assert "branchlab.core" not in sys.modules;print(replay('
            + repr(controls()[0]["input"])
            + ')["schema"])'
        )
        self.assertIn(
            "branchlab-v1",
            subprocess.check_output([sys.executable, "-c", code], text=True),
        )


if __name__ == "__main__":
    unittest.main()
