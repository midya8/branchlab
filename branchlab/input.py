"""Bounded, explicit CTL AST and total finite Kripke contract."""

import re
from json import loads

LIMITS = [
    "One to six supplied finite Kripke states; every state has at least one successor. Deadlocks are rejected, never silently totalized.",
    "All paths are infinite. No fairness constraints, probabilities, actions, controller or adversary are supplied.",
    "CTL path quantifiers restart at every state subformula; this is not arbitrary LTL or CTL*.",
    "Until is strong: the right operand must eventually hold, including at time zero.",
    "A single execution does not in general prove a universal formula or refute an existential formula. Branching obligations and fixed-point extrema remain part of the evidence.",
    "One to eight formula roots; at most32 AST nodes and depth6 per root, at most128 AST nodes in total; at most four declared atomic propositions.",
    "Classical finite CTL model checking; bounded examples and independent agreement are not new theory, a scalable solver or a guarantee about actual software or AI agents.",
]
UNARY = {"not", "EX", "AX", "EF", "AF", "EG", "AG"}
BINARY = {"and", "or", "EU", "AU"}
FIX = {"EF", "AF", "EG", "AG", "EU", "AU"}


def identifier(n):
    return (
        type(n) is str and re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]{0,23}", n) is not None
    )


def validate(data):
    if type(data) is not dict or set(data) != {"states", "atoms", "formulas"}:
        raise ValueError("request requires exactly states, atoms and formulas")
    atoms = data["atoms"]
    states = data["states"]
    fs = data["formulas"]
    if (
        type(atoms) is not list
        or len(atoms) > 4
        or any(not identifier(a) for a in atoms)
        or len(atoms) != len(set(atoms))
    ):
        raise ValueError("atoms must be at most four unique short ASCII identifiers")
    if type(states) is not list or not 1 <= len(states) <= 6:
        raise ValueError("states must have length1..6")
    names = []
    for s in states:
        if (
            type(s) is not dict
            or set(s) != {"name", "labels", "next"}
            or not identifier(s["name"])
            or s["name"] in names
        ):
            raise ValueError("states need unique name, labels and next")
        names.append(s["name"])
    normalized = []
    for s in states:
        ls = s["labels"]
        ns = s["next"]
        if (
            type(ls) is not list
            or any(type(a) is not str or a not in atoms for a in ls)
            or len(ls) != len(set(ls))
        ):
            raise ValueError("labels must be unique declared atoms")
        if (
            type(ns) is not list
            or not 1 <= len(ns) <= 6
            or any(type(n) is not str or n not in names for n in ns)
            or len(ns) != len(set(ns))
        ):
            raise ValueError("every state needs1..6 unique declared successors")
        normalized.append(
            {
                "name": s["name"],
                "labels": [a for a in atoms if a in ls],
                "next": [n for n in names if n in ns],
            }
        )
    if type(fs) is not list or not 1 <= len(fs) <= 8:
        raise ValueError("formulas must have length1..8")
    total = 0

    def ast(x, depth, count):
        nonlocal total
        count[0] += 1
        total += 1
        if depth > 6 or count[0] > 32 or total > 128:
            raise ValueError("formula AST limit exceeded")
        if type(x) is not dict or type(x.get("op")) is not str:
            raise ValueError("formula node needs op")
        op = x["op"]
        if op == "bool" and set(x) == {"op", "value"} and type(x["value"]) is bool:
            return {"op": op, "value": x["value"]}
        if (
            op == "atom"
            and set(x) == {"op", "name"}
            and type(x["name"]) is str
            and x["name"] in atoms
        ):
            return {"op": op, "name": x["name"]}
        if op in UNARY and set(x) == {"op", "arg"}:
            return {"op": op, "arg": ast(x["arg"], depth + 1, count)}
        if op in BINARY and set(x) == {"op", "left", "right"}:
            return {
                "op": op,
                "left": ast(x["left"], depth + 1, count),
                "right": ast(x["right"], depth + 1, count),
            }
        raise ValueError("invalid formula operator, arity, atom or value")

    return {
        "states": normalized,
        "atoms": atoms[:],
        "formulas": [ast(f, 1, [0]) for f in fs],
    }


def load(raw):
    def obj(pairs):
        d = {}
        for k, v in pairs:
            if k in d:
                raise ValueError("duplicate JSON key")
            d[k] = v
        return d

    def bad(x):
        raise ValueError("nonfinite JSON number")

    return loads(raw, object_pairs_hook=obj, parse_constant=bad)


def equal(a, b, path="$"):
    if type(a) is not type(b):
        raise ValueError("type mismatch at " + path)
    if type(a) is dict:
        if set(a) != set(b):
            raise ValueError("key mismatch at " + path)
        for k in a:
            equal(a[k], b[k], path + "." + k)
    elif type(a) is list:
        if len(a) != len(b):
            raise ValueError("length mismatch at " + path)
        for i, (v, w) in enumerate(zip(a, b)):
            equal(v, w, path + "[" + str(i) + "]")
    elif a != b:
        raise ValueError("value mismatch at " + path)
