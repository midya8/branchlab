"""Independent bitmask subset-extremum replay; no generator import."""

import json
from .input import validate, equal, FIX, LIMITS


def replay(request):
    data = validate(request)
    states = data["states"]
    names = [s["name"] for s in states]
    n = len(names)
    full = (1 << n) - 1
    successors = [sum(1 << names.index(v) for v in s["next"]) for s in states]
    out = []
    lookup = {}
    values = []

    def listed(mask):
        return [names[i] for i in range(n) if mask & (1 << i)]

    # Enumerate all vertex-simple finite prefixes and first-repeat lassos, separately
    # from the generator's breadth-first witness discovery.
    paths = [[] for _ in names]
    lassos = [[] for _ in names]

    def walk(root, xs):
        paths[root].append(tuple(xs))
        for j in range(n):
            if not (successors[xs[-1]] >> j & 1):
                continue
            if j in xs:
                lassos[root].append((tuple(xs + [j]), xs.index(j)))
            else:
                walk(root, xs + [j])

    for i in range(n):
        walk(i, [i])
        paths[i].sort(key=lambda p: (len(p), p))
        lassos[i].sort(key=lambda p: (len(p[0]), p[0]))

    def check(ast):
        key = json.dumps(ast, sort_keys=True, separators=(",", ":"))
        if key in lookup:
            return lookup[key]
        op = ast["op"]
        cs = [check(ast[k]) for k in ["arg"] if k in ast] or [
            check(ast[k]) for k in ["left", "right"] if k in ast
        ]
        a = values[cs[0]] if cs else 0
        b = values[cs[1]] if len(cs) > 1 else 0

        def image(z):
            pre = 0
            for i, s in enumerate(successors):
                ok = (s & z) == s if op[0] == "A" else bool(s & z)
                if ok:
                    pre |= 1 << i
            if op in {"EF", "AF"}:
                return a | pre
            if op in {"EG", "AG"}:
                return a & pre
            return b | (a & pre)

        atlas = []
        rounds = []
        if op == "bool":
            v = full if ast["value"] else 0
        elif op == "atom":
            v = sum(1 << i for i, s in enumerate(states) if ast["name"] in s["labels"])
        elif op == "not":
            v = full ^ a
        elif op == "and":
            v = a & b
        elif op == "or":
            v = a | b
        elif op == "EX":
            v = sum(1 << i for i, s in enumerate(successors) if s & a)
        elif op == "AX":
            v = sum(1 << i for i, s in enumerate(successors) if s & a == s)
        else:
            fixed = []
            for mask in range(1 << n):
                im = image(mask)
                atlas.append(
                    {
                        "mask": mask,
                        "candidate": listed(mask),
                        "image": listed(im),
                        "fixed": mask == im,
                        "pre_fixed": im & mask == im,
                        "post_fixed": im & mask == mask,
                    }
                )
                if im == mask:
                    fixed.append(mask)
            if not fixed:
                raise ValueError("monotone finite system has no fixed point")
            if op in {"EG", "AG"}:
                v = 0
                for m in fixed:
                    v |= m
            else:
                v = full
                for m in fixed:
                    v &= m
            if image(v) != v:
                raise ValueError("extremal fixed point invalid")
            # The truth value above did not come from these iterations. Reconstruct
            # every displayed operation independently for the canonical evidence.
            before = full if op in {"EG", "AG"} else 0
            for k in range(n + 2):
                after = image(before)
                checks = []
                for i, s in enumerate(successors):
                    targets = [bool(before >> j & 1) for j in range(n) if s >> j & 1]
                    pre = (s & before) == s if op[0] == "A" else bool(s & before)
                    checks.append(
                        {
                            "state": names[i],
                            "left_holds": bool(a >> i & 1),
                            "right_holds": bool(b >> i & 1) if len(cs) > 1 else None,
                            "successors": listed(s),
                            "successor_in_before": targets,
                            "operator": "all" if op[0] == "A" else "any",
                            "predecessor_test": pre,
                            "admitted": bool(after >> i & 1),
                        }
                    )
                rounds.append(
                    {
                        "index": k,
                        "before": listed(before),
                        "checks": checks,
                        "after": listed(after),
                        "added": listed(after & ~before),
                        "removed": listed(before & ~after),
                    }
                )
                if before == after:
                    break
                before = after
            if before != v:
                raise ValueError("iteration and subset extrema disagree")
        ident = len(out)
        lookup[key] = ident
        values.append(v)
        examples = []
        for root in range(n):
            holds = bool(v >> root & 1)
            chosen = None
            cycle = None
            kind = "branching_certificate"
            target = None
            allowed = full
            if op in {"EF", "EU"} and holds:
                target = a if op == "EF" else b
                allowed = full if op == "EF" else a
            elif op == "AG" and not holds:
                target = full ^ a
            elif op == "AU" and not holds:
                target = full ^ (a | b)
                allowed = full ^ b
            if target is not None:
                chosen = next(
                    (
                        p
                        for p in paths[root]
                        if target >> p[-1] & 1 and all(allowed >> j & 1 for j in p[:-1])
                    ),
                    None,
                )
                if chosen is not None:
                    kind = "finite_path"
            if (op == "EG" and holds) or (
                op in {"AF", "AU"} and not holds and chosen is None
            ):
                allowed = a if op == "EG" else full ^ (a if op == "AF" else b)
                candidate = next(
                    (
                        (p, k)
                        for p, k in lassos[root]
                        if all(allowed >> j & 1 for j in p)
                    ),
                    None,
                )
                if candidate is None:
                    raise ValueError("required lasso missing")
                chosen, cycle = candidate
                kind = "lasso"
            if op == "EX" and holds:
                chosen = (
                    root,
                    next(
                        j
                        for j in range(n)
                        if (successors[root] >> j & 1) and (a >> j & 1)
                    ),
                )
                kind = "finite_path"
            if op == "AX" and not holds:
                chosen = (
                    root,
                    next(
                        j
                        for j in range(n)
                        if (successors[root] >> j & 1) and not (a >> j & 1)
                    ),
                )
                kind = "finite_path"
            examples.append(
                {
                    "start": names[root],
                    "holds": holds,
                    "kind": kind,
                    "nodes": None if chosen is None else [names[j] for j in chosen],
                    "cycle_start": cycle,
                }
            )
        record = {
            "id": ident,
            "formula": ast,
            "op": op,
            "children": cs,
            "truth": listed(v),
            "false": listed(full ^ v),
            "fixed_point": (
                "greatest" if op in {"EG", "AG"} else "least" if op in FIX else None
            ),
            "rounds": rounds,
            "subset_atlas": atlas,
            "state_checks": [
                {
                    "state": names[i],
                    "holds": bool(v >> i & 1),
                    "children_hold": [bool(values[c] >> i & 1) for c in cs],
                    "successors": (
                        [
                            {"to": names[j], "child_holds": bool(a >> j & 1)}
                            for j in range(n)
                            if successors[i] >> j & 1
                        ]
                        if op in {"EX", "AX"}
                        else []
                    ),
                }
                for i in range(n)
            ],
            "examples": examples,
        }
        out.append(record)
        return ident

    roots = [check(f) for f in data["formulas"]]
    return {
        "schema": "branchlab-v1",
        "input": data,
        "roots": roots,
        "subformulas": out,
        "results": [
            {"formula_id": i, "truth": out[i]["truth"], "false": out[i]["false"]}
            for i in roots
        ],
        "limits": LIMITS[:],
    }


def verify(report):
    if type(report) is not dict or "input" not in report:
        raise ValueError("certificate requires input")
    equal(replay(report["input"]), report)
    return True
