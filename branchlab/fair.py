"""Tarjan fair-region atlas, fair-continuation semantics and product-walk witnesses."""

import json
from collections import deque
from .fair_input import validate, LIMITS
from .core import analyze as ordinary


def analyze_fair(raw):
    data = validate(raw)
    model = data["model"]
    names = [s["name"] for s in model["states"]]
    n = len(names)
    world = set(range(n))
    adj = [[names.index(t) for t in s["next"]] for s in model["states"]]
    justice = [{names.index(s) for s in j} for j in data["justice"]]
    listed = lambda s: [names[i] for i in range(n) if i in s]

    def scc(allowed):
        seq = {}
        low = {}
        stack = []
        on = set()
        parts = []

        def visit(v):
            seq[v] = low[v] = len(seq)
            stack.append(v)
            on.add(v)
            for w in adj[v]:
                if w not in allowed:
                    continue
                if w not in seq:
                    visit(w)
                    low[v] = min(low[v], low[w])
                elif w in on:
                    low[v] = min(low[v], seq[w])
            if low[v] == seq[v]:
                b = []
                while True:
                    w = stack.pop()
                    on.remove(w)
                    b.append(w)
                    if w == v:
                        break
                parts.append(sorted(b))

        for v in sorted(allowed):
            if v not in seq:
                visit(v)
        return sorted(parts, key=lambda b: b[0])

    def lasso(root, allowed, seeds, components):
        if root not in allowed:
            return None
        queue = deque([[root]])
        seen = {root}
        prefix = None
        while queue:
            xs = queue.popleft()
            v = xs[-1]
            if v in seeds:
                prefix = xs
                break
            for w in adj[v]:
                if w in allowed and w not in seen:
                    seen.add(w)
                    queue.append(xs + [w])
        if prefix is None:
            return None
        entry = prefix[-1]
        comp = next(set(c["states"]) for c in components if entry in c["states"])
        bits = lambda v: sum(1 << k for k, j in enumerate(justice) if v in j)
        target = (1 << len(justice)) - 1
        queue = deque([(entry, bits(entry), [entry])])
        seen = {(entry, bits(entry))}
        cycle = None
        while queue and cycle is None:
            v, mask, xs = queue.popleft()
            for w in adj[v]:
                if w not in comp:
                    continue
                m = mask | bits(w)
                if w == entry and m == target:
                    cycle = xs + [w]
                    break
                if (w, m) not in seen:
                    seen.add((w, m))
                    queue.append((w, m, xs + [w]))
        assert cycle is not None
        return {
            "prefix": listed_sequence(prefix),
            "cycle": listed_sequence(cycle),
            "justice_positions": [
                next(i for i, v in enumerate(cycle[:-1]) if v in j) for j in justice
            ],
        }

    def listed_sequence(xs):
        return [names[i] for i in xs]

    atlas = []
    for mask in range(1 << n):
        allowed = {i for i in world if mask >> i & 1}
        parts = scc(allowed)
        components = []
        seed = set()
        for b in parts:
            cyclic = len(b) > 1 or b[0] in adj[b[0]]
            hits = [sorted(set(b) & j) for j in justice]
            fair = cyclic and all(hits)
            components.append(
                {"states": b, "cyclic": cyclic, "justice_hits": hits, "fair": fair}
            )
            if fair:
                seed.update(b)
        value = seed.copy()
        rounds = []
        while True:
            pre = {v for v in allowed if any(w in value for w in adj[v])}
            after = value | pre
            rounds.append(
                {
                    "before": listed(value),
                    "predecessors": listed(pre),
                    "after": listed(after),
                }
            )
            if after == value:
                break
            value = after
        witnesses = [lasso(root, allowed, seed, components) for root in range(n)]
        atlas.append(
            {
                "mask": mask,
                "allowed": listed(allowed),
                "components": [
                    {
                        "states": listed(c["states"]),
                        "cyclic": c["cyclic"],
                        "justice_hits": [listed(x) for x in c["justice_hits"]],
                        "fair": c["fair"],
                    }
                    for c in components
                ],
                "fair_seed": listed(seed),
                "backward_rounds": rounds,
                "truth": listed(value),
                "recurrent": bool(allowed)
                and len(components) == 1
                and components[0]["cyclic"],
                "fair_recurrent": bool(allowed)
                and len(components) == 1
                and components[0]["fair"],
                "witnesses": witnesses,
            }
        )
    full = (1 << n) - 1
    fair = {names.index(s) for s in atlas[full]["truth"]}
    old = ordinary(model)
    nodes = []
    values = []

    def reach(left, right):
        z = set()
        rounds = []
        while True:
            pre = {v for v in world if any(w in z for w in adj[v])}
            after = right | (left & pre)
            rounds.append(
                {
                    "before": listed(z),
                    "predecessors": listed(pre),
                    "after": listed(after),
                }
            )
            if after == z:
                return z, rounds
            z = after

    for oldnode in old["subformulas"]:
        op = oldnode["op"]
        cs = oldnode["children"]
        a = values[cs[0]] if cs else set()
        b = values[cs[1]] if len(cs) > 1 else set()
        kind = "local"
        aux = {}
        rounds = []
        region = None
        if op == "bool":
            value = world.copy() if oldnode["formula"]["value"] else set()
        elif op == "atom":
            value = {
                i
                for i, s in enumerate(model["states"])
                if oldnode["formula"]["name"] in s["labels"]
            }
        elif op == "not":
            value = world - a
        elif op == "and":
            value = a & b
        elif op == "or":
            value = a | b
        elif op in {"EX", "AX"}:
            target = (a if op == "EX" else world - a) & fair
            pre = {v for v in world if any(w in target for w in adj[v])}
            value = pre if op == "EX" else world - pre
            aux = {
                "fair_target": listed(target),
                "existential_predecessors": listed(pre),
            }
            kind = "fair_next" if op == "EX" else "complement_fair_next"
        elif op in {"EU", "EF", "AG"}:
            left = a if op == "EU" else world
            goal = b if op == "EU" else a if op == "EF" else world - a
            value, rounds = reach(left, goal & fair)
            aux = {"left": listed(left), "fair_goal": listed(goal & fair)}
            kind = "fair_until"
            if op == "AG":
                value = world - value
                kind = "complement_fair_until"
        elif op in {"EG", "AF"}:
            allowed = a if op == "EG" else world - a
            region = sum(1 << i for i in allowed)
            v = {names.index(s) for s in atlas[region]["truth"]}
            value = v if op == "EG" else world - v
            kind = "fair_global" if op == "EG" else "complement_fair_global"
        else:
            # A[a U b] excludes finite failure before b and fair infinite avoidance of b.
            finite, rounds = reach(world - b, (world - (a | b)) & fair)
            region = sum(1 << i for i in world - b)
            infinite = {names.index(s) for s in atlas[region]["truth"]}
            value = world - (finite | infinite)
            aux = {
                "finite_bad": listed(finite),
                "infinite_bad": listed(infinite),
                "left": listed(world - b),
                "fair_goal": listed((world - (a | b)) & fair),
            }
            kind = "complement_two_fair_failures"
        values.append(value)
        original = set(oldnode["truth"])
        truth = listed(value)
        nodes.append(
            {
                "id": oldnode["id"],
                "formula": oldnode["formula"],
                "op": op,
                "children": cs,
                "truth": truth,
                "false": listed(world - value),
                "ordinary_truth": oldnode["truth"],
                "changed": sorted(
                    original.symmetric_difference(truth), key=names.index
                ),
                "kind": kind,
                "region_mask": region,
                "auxiliary": aux,
                "rounds": rounds,
                "state_checks": [
                    {
                        "state": names[i],
                        "holds": i in value,
                        "ordinary_holds": names[i] in original,
                        "children_hold": [i in values[c] for c in cs],
                        "fair_continuation": i in fair,
                        "universal_without_fair_path": op.startswith("A")
                        and i not in fair,
                    }
                    for i in range(n)
                ],
            }
        )
    return {
        "schema": "branchlab-fair-v1",
        "input": data,
        "fair_states": listed(fair),
        "no_fair_states": listed(world - fair),
        "region_atlas": atlas,
        "roots": old["roots"],
        "subformulas": nodes,
        "results": [
            {
                "formula_id": i,
                "truth": nodes[i]["truth"],
                "ordinary_truth": nodes[i]["ordinary_truth"],
                "changed": nodes[i]["changed"],
            }
            for i in old["roots"]
        ],
        "limits": LIMITS[:],
    }
