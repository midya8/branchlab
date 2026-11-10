"""Original bounded thought experiments, not copied textbook diagrams."""

from pathlib import Path
import json


def atom(name):
    return {"op": "atom", "name": name}


def unary(op, a):
    return {"op": op, "arg": a}


def binary(op, a, b):
    return {"op": op, "left": a, "right": b}


def model(rows, labels, formulas, atoms=None):
    return {
        "atoms": atoms if atoms is not None else ["p", "q"],
        "states": [
            {"name": f"s{i}", "labels": label, "next": [f"s{j}" for j in row]}
            for i, (row, label) in enumerate(zip(rows, labels))
        ],
        "formulas": formulas,
    }


def controls():
    p = atom("p")
    q = atom("q")
    true = {"op": "bool", "value": True}
    false = {"op": "bool", "value": False}
    return [
        {
            "id": "always-possible",
            "title": "Always possible is not inevitable",
            "why": "The waiting self-loop can postpone p forever, yet p remains reachable at every visited state. AG EF p holds at s0 while AF p does not. No fairness assumption removes the waiting path.",
            "input": model(
                [[0, 1], [1]],
                [[], ["p"]],
                [
                    unary("AG", unary("EF", p)),
                    unary("AF", p),
                    unary("EG", unary("not", p)),
                ],
            ),
        },
        {
            "id": "separate-branches",
            "title": "Two witnesses need not be one witness",
            "why": "EX p and EX q can both hold using different successors, while EX (p and q) fails. The two next-step claims do not share an existential witness.",
            "input": model(
                [[1, 2], [1], [2]],
                [[], ["p"], ["q"]],
                [
                    binary("and", unary("EX", p), unary("EX", q)),
                    unary("EX", binary("and", p, q)),
                ],
            ),
        },
        {
            "id": "strong-until",
            "title": "Waiting forever does not satisfy strong until",
            "why": "A closed p-loop never reaches q. EG p holds, but E[p U q] and A[p U q] both fail, even though p stays true.",
            "input": model(
                [[0]], [["p"]], [unary("EG", p), binary("EU", p, q), binary("AU", p, q)]
            ),
        },
        {
            "id": "zero-step",
            "title": "Until can finish at time zero",
            "why": "q already holds. Both until formulas hold immediately even though p is false and the next state loses q. A globally-q claim still fails.",
            "input": model(
                [[1], [1]],
                [["q"], []],
                [binary("EU", p, q), binary("AU", p, q), unary("AG", q)],
            ),
        },
        {
            "id": "next-vs-global",
            "title": "Next is not always",
            "why": "Every immediate successor has p, but the later tail loses it. AX p holds while AG p fails.",
            "input": model(
                [[1], [2], [2]],
                [[], ["p"], []],
                [unary("AX", p), unary("AG", p), unary("AF", p)],
            ),
        },
        {
            "id": "recovery-choice",
            "title": "One good path is not every path",
            "why": "The start can choose a permanently-p branch or a permanently-not-p branch. EG p and AG p differ at the p-labelled start.",
            "input": model(
                [[1, 2], [1], [2]],
                [["p"], ["p"], []],
                [unary("EG", p), unary("AG", p), unary("EF", unary("not", p))],
            ),
        },
        {
            "id": "branching-rank",
            "title": "Universal until needs every branch",
            "why": "Both branches reach q after different numbers of p states. A[p U q] holds at the root, and its least-fixed-point entry round gives a common finite bound.",
            "input": model(
                [[1, 2], [3], [1], [3]],
                [["p"], ["p"], ["p"], ["q"]],
                [binary("AU", p, q), binary("EU", p, q)],
            ),
        },
        {
            "id": "finite-until-failure",
            "title": "A failed prefix is not only a lasso",
            "why": "One path loses p before reaching q. The AU counterexample can be finite, while another branch still witnesses EU.",
            "input": model(
                [[1, 2], [3], [2], [3]],
                [["p"], [], ["q"], ["q"]],
                [binary("AU", p, q), binary("EU", p, q)],
            ),
        },
        {
            "id": "nested-next",
            "title": "Quantifier order changes the question",
            "why": "Each successor can choose a p successor, but one successor also has a non-p choice. AX EX p holds while EX AX p fails at the root.",
            "input": model(
                [[1, 2], [3, 4], [3, 4], [3], [4]],
                [[], [], [], ["p"], []],
                [unary("AX", unary("EX", p)), unary("EX", unary("AX", p))],
            ),
        },
        {
            "id": "six-state-chain",
            "title": "Five transitions, six states",
            "why": "A forced chain reaches p in exactly five transitions. The eventuality is not bounded by the number of shown sample traces.",
            "input": model(
                [[1], [2], [3], [4], [5], [5]],
                [[], [], [], [], [], ["p"]],
                [unary("AF", p), unary("EF", p), unary("AG", unary("EF", p))],
            ),
        },
        {
            "id": "constant-boundaries",
            "title": "Empty and full truth sets stay explicit",
            "why": "False eventualities never arrive; true global formulas hold on every path. All subset fixed points remain inspectable rather than accepting an arbitrary self-consistent set.",
            "input": model(
                [[0, 1], [0, 1]],
                [[], []],
                [
                    unary("EF", false),
                    unary("AF", false),
                    unary("EG", true),
                    unary("AG", true),
                    unary("not", unary("AF", false)),
                ],
                [],
            ),
        },
        {
            "id": "alternating",
            "title": "Nested state formulas restart path choice",
            "why": "Both states inevitably see p and inevitably see not-p on the forced alternating cycle. No single state label is globally constant.",
            "input": model(
                [[1], [0]],
                [["p"], []],
                [
                    unary("AG", unary("AF", p)),
                    unary("AG", unary("AF", unary("not", p))),
                    unary("EG", p),
                    unary("AG", p),
                ],
            ),
        },
    ]


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    (root / "docs/controls.json").write_text(json.dumps(controls(), indent=2) + "\n")
    (root / "examples/always-possible.json").write_text(
        json.dumps(controls()[0]["input"], indent=2) + "\n"
    )
