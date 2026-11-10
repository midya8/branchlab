"""Optional GPL package used as separate installed test reference, never vendored."""

import json, random, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from branchlab import analyze
from tools.make_controls import controls, model, atom, unary, binary
from pyModelChecking import Kripke
import pyModelChecking.CTL as CTL


def translate(f):
    op = f["op"]
    if op == "atom":
        return CTL.AtomicProposition(f["name"])
    if op == "bool":
        return CTL.Bool(f["value"])
    constructors = {
        "not": CTL.Not,
        "and": CTL.And,
        "or": CTL.Or,
        **{
            k: getattr(CTL, k) for k in ["EX", "AX", "EF", "AF", "EG", "AG", "EU", "AU"]
        },
    }
    return constructors[op](
        *[translate(f[k]) for k in ["arg", "left", "right"] if k in f]
    )


def check(request):
    r = analyze(request)
    ss = r["input"]["states"]
    k = Kripke(
        S=[s["name"] for s in ss],
        R=[(s["name"], j) for s in ss for j in s["next"]],
        L={s["name"]: set(s["labels"]) for s in ss},
    )
    for f in r["subformulas"]:
        got = CTL.modelcheck(k, translate(f["formula"]))
        expected = set(f["truth"])
        if got != expected:
            raise AssertionError((request, f, got))
    return len(r["subformulas"])


def run():
    rng = random.Random(4107)
    requests = [c["input"] for c in controls()]

    def formula(d):
        if d == 0:
            return atom(rng.choice(["p", "q"]))
        op = rng.choice(
            ["not", "and", "or", "EX", "AX", "EF", "AF", "EG", "AG", "EU", "AU"]
        )
        return (
            binary(op, formula(d - 1), formula(d - 1))
            if op in {"and", "or", "EU", "AU"}
            else unary(op, formula(d - 1))
        )

    for _ in range(200):
        n = rng.randrange(1, 7)
        rows = [
            sorted(
                set([rng.randrange(n)] + [j for j in range(n) if rng.random() < 0.4])
            )
            for i in range(n)
        ]
        requests.append(
            model(
                rows,
                [[a for a in ["p", "q"] if rng.random() < 0.5] for _ in range(n)],
                [formula(3) for _ in range(4)],
            )
        )
    subformulas = sum(check(r) for r in requests)
    import importlib.metadata

    print(
        json.dumps(
            {
                "package": "pyModelChecking",
                "version": importlib.metadata.version("pyModelChecking"),
                "requests": len(requests),
                "all_subformula_truth_sets": subformulas,
                "agreement": True,
            }
        )
    )


if __name__ == "__main__":
    run()
