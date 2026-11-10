"""Classical synchronous CTL fixed points, exposing every subset image."""

from collections import deque
import json
from .input import validate, FIX, LIMITS


def analyze(request):
    data = validate(request)
    ss = data["states"]
    names = [s["name"] for s in ss]
    n = len(ss)
    world = set(range(n))
    adj = [[names.index(v) for v in s["next"]] for s in ss]
    nodes = []
    ids = {}
    truths = []
    order = lambda xs: [names[i] for i in range(n) if i in xs]

    def build(ast):
        key = json.dumps(ast, sort_keys=True, separators=(",", ":"))
        if key in ids:
            return ids[key]
        op = ast["op"]
        children = [
            build(ast[k])
            for k in (
                ["arg"] if "arg" in ast else ["left", "right"] if "left" in ast else []
            )
        ]
        a = truths[children[0]] if children else set()
        b = truths[children[1]] if len(children) > 1 else set()

        def obligations(z):
            out = []
            for i in range(n):
                targets = [j in z for j in adj[i]]
                pre = all(targets) if op.startswith("A") else any(targets)
                if op in {"EF", "AF"}:
                    local = i in a
                    admitted = local or pre
                elif op in {"EG", "AG"}:
                    local = i in a
                    admitted = local and pre
                else:
                    local = i in b
                    admitted = local or (i in a and pre)
                out.append(
                    {
                        "state": names[i],
                        "left_holds": i in a,
                        "right_holds": i in b if len(children) > 1 else None,
                        "successors": names and [names[j] for j in adj[i]],
                        "successor_in_before": targets,
                        "operator": "all" if op.startswith("A") else "any",
                        "predecessor_test": pre,
                        "admitted": admitted,
                    }
                )
            return out

        if op == "bool":
            value = world.copy() if ast["value"] else set()
        elif op == "atom":
            value = {i for i, s in enumerate(ss) if ast["name"] in s["labels"]}
        elif op == "not":
            value = world - a
        elif op == "and":
            value = a & b
        elif op == "or":
            value = a | b
        elif op == "EX":
            value = {i for i in range(n) if any(j in a for j in adj[i])}
        elif op == "AX":
            value = {i for i in range(n) if all(j in a for j in adj[i])}
        else:
            greatest = op in {"EG", "AG"}
            value = world.copy() if greatest else set()
            rounds = []
            while True:
                checks = obligations(value)
                after = {i for i, c in enumerate(checks) if c["admitted"]}
                rounds.append(
                    {
                        "index": len(rounds),
                        "before": order(value),
                        "checks": checks,
                        "after": order(after),
                        "added": order(after - value),
                        "removed": order(value - after),
                    }
                )
                if after == value:
                    break
                value = after
        ident = len(nodes)
        ids[key] = ident
        truths.append(value)
        atlas = []
        if op in FIX:
            for mask in range(1 << n):
                z = {i for i in range(n) if mask >> i & 1}
                image = {i for i, c in enumerate(obligations(z)) if c["admitted"]}
                atlas.append(
                    {
                        "mask": mask,
                        "candidate": order(z),
                        "image": order(image),
                        "fixed": z == image,
                        "pre_fixed": image <= z,
                        "post_fixed": z <= image,
                    }
                )
        entry = {
            "id": ident,
            "formula": ast,
            "op": op,
            "children": children,
            "truth": order(value),
            "false": order(world - value),
            "fixed_point": (
                "greatest" if op in {"EG", "AG"} else "least" if op in FIX else None
            ),
            "rounds": rounds if op in FIX else [],
            "subset_atlas": atlas,
            "state_checks": [],
            "examples": [],
        }
        for i in range(n):
            entry["state_checks"].append(
                {
                    "state": names[i],
                    "holds": i in value,
                    "children_hold": [i in truths[c] for c in children],
                    "successors": (
                        [{"to": names[j], "child_holds": j in a} for j in adj[i]]
                        if op in {"EX", "AX"}
                        else []
                    ),
                }
            )
        # Examples for path-shaped truth/falsity only; other claims need branching evidence.
        for root in range(n):
            holds = root in value
            kind = "branching_certificate"
            path = None
            cycle = None
            goal = None
            allowed = world
            if op in {"EF", "EU"} and holds:
                goal = a if op == "EF" else b
                allowed = world if op == "EF" else a
            elif op == "AG" and not holds:
                goal = world - a
            elif op == "AU" and not holds:
                goal = world - (a | b)
                allowed = world - b
            if goal is not None:
                queue = deque([[root]])
                while queue:
                    xs = queue.popleft()
                    i = xs[-1]
                    if i in goal:
                        path = xs
                        kind = "finite_path"
                        break
                    if i not in allowed:
                        continue
                    for j in adj[i]:
                        if j not in xs:
                            queue.append(xs + [j])
            lasso = (op == "EG" and holds) or (
                op in {"AF", "AU"} and not holds and path is None
            )
            if lasso:
                allowed = a if op == "EG" else world - (a if op == "AF" else b)
                queue = deque([[root]])
                while queue:
                    xs = queue.popleft()
                    i = xs[-1]
                    if i not in allowed:
                        continue
                    for j in adj[i]:
                        if j not in allowed:
                            continue
                        if j in xs:
                            path = xs + [j]
                            cycle = xs.index(j)
                            kind = "lasso"
                            break
                        queue.append(xs + [j])
                    if path is not None:
                        break
            if op == "EX" and holds:
                path = [root, next(j for j in adj[root] if j in a)]
                kind = "finite_path"
            if op == "AX" and not holds:
                path = [root, next(j for j in adj[root] if j not in a)]
                kind = "finite_path"
            entry["examples"].append(
                {
                    "start": names[root],
                    "holds": holds,
                    "kind": kind,
                    "nodes": None if path is None else [names[j] for j in path],
                    "cycle_start": cycle,
                }
            )
        nodes.append(entry)
        return ident

    roots = [build(f) for f in data["formulas"]]
    return {
        "schema": "branchlab-v1",
        "input": data,
        "roots": roots,
        "subformulas": nodes,
        "results": [
            {"formula_id": i, "truth": nodes[i]["truth"], "false": nodes[i]["false"]}
            for i in roots
        ],
        "limits": LIMITS[:],
    }
