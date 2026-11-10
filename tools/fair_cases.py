"""Original state-justice controls and bounded full-report corpus."""

import random
from itertools import product


def atom(x):
    return {"op": "atom", "name": x}


def unary(op, arg):
    return {"op": op, "arg": arg}


def binary(op, left, right):
    return {"op": op, "left": left, "right": right}


def formulas():
    p = atom("p")
    q = atom("q")
    yes = {"op": "bool", "value": True}
    no = {"op": "bool", "value": False}
    return [
        unary("AF", p),
        unary("EG", unary("not", p)),
        unary("AG", unary("EF", p)),
        binary("AU", q, p),
        binary("EU", q, p),
        unary("AX", no),
        unary("EX", yes),
        binary("and", p, unary("not", unary("EG", yes))),
    ]


def request(adj, labels, justice, fs=None):
    return {
        "model": {
            "states": [
                {
                    "name": "s" + str(i),
                    "labels": x,
                    "next": ["s" + str(j) for j in adj[i]],
                }
                for i, x in enumerate(labels)
            ],
            "atoms": ["p", "q"],
            "formulas": fs or formulas(),
        },
        "justice": [["s" + str(i) for i in j] for j in justice],
    }


def controls():
    def c(title, why, adj, labels, js, fs=None):
        return {"title": title, "why": why, "input": request(adj, labels, js, fs)}

    p = atom("p")
    q = atom("q")
    truth = {"op": "bool", "value": True}
    return [
        c(
            "One walk must visit both",
            "A fair cycle must revisit the hub to see both justice sets. A first-repeat simple cycle cannot do it. The trap keeps local truth but has no fair continuation.",
            [[1, 2, 3], [0], [0], [3]],
            [["q"], ["p", "q"], ["q"], ["p", "q"]],
            [[1], [2]],
        ),
        c(
            "Waiting is excluded, not repaired",
            "Requiring goal visits removes the infinite wait from quantified paths. It does not change any edge or enforce a scheduler.",
            [[0, 1], [1]],
            [["q"], ["p", "q"]],
            [[1]],
        ),
        c(
            "No fair path, no liveness success",
            "An empty justice set makes every fair temporal universal vacuous. Local atoms still follow their labels and existential temporal claims fail.",
            [[0]],
            [["p"]],
            [[]],
        ),
        c(
            "Reachable separately is insufficient",
            "Both justice sets are reachable, but different absorbing branches cannot visit both infinitely often on one path.",
            [[1, 2], [1], [2]],
            [["q"], ["p"], ["q"]],
            [[1], [2]],
        ),
        c(
            "One visit is not infinitely often",
            "The first state meets justice only once, then the system remains elsewhere forever.",
            [[1], [1]],
            [["p", "q"], ["q"]],
            [[0]],
        ),
        c(
            "Global fair reachability is not fair EG",
            "A state has a fair continuation, but every fair continuation leaves p. EG p must use the induced p region, not ordinary EG p intersect global fair states.",
            [[0, 1], [1]],
            [["p", "q"], ["q"]],
            [[1]],
            [
                unary("EG", p),
                unary("EX", p),
                unary("AF", unary("not", p)),
                unary("AG", p),
            ],
        ),
        c(
            "A real two-state recurrent class",
            "A two-state cycle is fair without self-loops. Singleton self-loops count too; singleton vertices without loops do not.",
            [[1], [0]],
            [["p", "q"], ["q"]],
            [[0], [1]],
        ),
        c(
            "Until needs a fair suffix",
            "A reachable right operand at an unfair terminal branch cannot finish an existential fair-until witness.",
            [[1, 2], [1], [2]],
            [["q"], ["p"], ["q"]],
            [[2]],
            [
                unary("EF", p),
                binary("EU", q, p),
                unary("AG", unary("not", p)),
                unary("AX", q),
            ],
        ),
        c(
            "No assumption recovers ordinary CTL",
            "With no justice constraints, every infinite path is admitted in this supplied total model.",
            [[0, 1], [1]],
            [["q"], ["p", "q"]],
            [],
        ),
        c(
            "Time zero still needs continuation",
            "The until goal is true now, but existential until still needs an infinite fair path. Without one it fails; universal until is vacuous.",
            [[0]],
            [["p", "q"]],
            [[]],
            [binary("EU", q, p), binary("AU", q, p), p, unary("not", p)],
        ),
        c(
            "Justice may overlap",
            "One recurrent state can satisfy several justice sets; each cycle records an actual occurrence for every set.",
            [[1], [0, 2], [2]],
            [["q"], ["p", "q"], ["q"]],
            [[0, 1], [1]],
        ),
        c(
            "Nested quantifiers restart",
            "Always having a fair route to p does not mean one path can stay in p. Every nested temporal operator gets its own fair path quantifier.",
            [[1, 2], [0], [0]],
            [["q"], ["p", "q"], ["q"]],
            [[1], [2]],
            [
                unary("AG", unary("EF", p)),
                unary("EG", p),
                unary("AF", p),
                binary("or", unary("AX", p), unary("EX", q)),
            ],
        ),
    ]


def exhaustive():
    for n in [1, 2]:
        rows = [[j for j in range(n) if mask >> j & 1] for mask in range(1, 1 << n)]
        js = [[], [[]], [[0]]] if n == 1 else [[], [[]], [[0]], [[1]], [[0], [1]]]
        for adj in product(rows, repeat=n):
            for label in product(range(2), repeat=n):
                for justice in js:
                    yield request(
                        adj, [["q"] + (["p"] if x else []) for x in label], justice
                    )


def seeded():
    rng = random.Random(37429)
    out = []
    ops = ["not", "EX", "AX", "EF", "AF", "EG", "AG"]

    def formula(depth):
        if depth == 0:
            return rng.choice(
                [
                    atom("p"),
                    atom("q"),
                    {"op": "bool", "value": False},
                    {"op": "bool", "value": True},
                ]
            )
        if rng.randrange(3):
            return unary(rng.choice(ops), formula(depth - 1))
        return binary(
            rng.choice(["EU", "AU", "and", "or"]),
            formula(depth - 1),
            formula(depth - 1),
        )

    for _ in range(80):
        n = rng.randint(1, 6)
        adj = [
            sorted({rng.randrange(n) for _ in range(rng.randint(1, n))})
            for i in range(n)
        ]
        labels = [[x for x in ["p", "q"] if rng.randrange(2)] for i in range(n)]
        js = [
            [i for i in range(n) if rng.randrange(2)] for _ in range(rng.randrange(5))
        ]
        out.append(
            request(adj, labels, js, [formula(rng.randrange(1, 4)) for _ in range(4)])
        )
    return out


if __name__ == "__main__":
    from pathlib import Path
    import json

    Path("docs/fair-controls.json").write_text(json.dumps(controls(), indent=2) + "\n")
    Path("examples/fairness.json").write_text(
        json.dumps(controls()[0]["input"], indent=2) + "\n"
    )
