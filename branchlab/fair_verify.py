"""Independent closure/recurrent-subset and simple-prefix fair CTL replay.

No Tarjan, native fair generator, native graph search or iteration imports.
The prior ordinary subset-extremum checker supplies ordinary comparison only.
"""

import heapq
from .fair_input import validate, LIMITS
from .input import equal
from .verify import replay as ordinary_replay


def expected(raw):
    data = validate(raw)
    model = data["model"]
    names = [s["name"] for s in model["states"]]
    n = len(names)
    full = (1 << n) - 1
    edges = [{names.index(s) for s in x["next"]} for x in model["states"]]
    justice = [{names.index(s) for s in j} for j in data["justice"]]
    listed = lambda mask: [names[i] for i in range(n) if mask >> i & 1]
    bits = lambda xs: sum(1 << i for i in xs)
    closures = []
    parts = []
    recurrent = []
    fairrec = []
    for region in range(1 << n):
        r = [
            [
                bool(region >> i & 1 and region >> j & 1 and (i == j or j in edges[i]))
                for j in range(n)
            ]
            for i in range(n)
        ]
        for k in range(n):
            for i in range(n):
                for j in range(n):
                    r[i][j] = r[i][j] or (r[i][k] and r[k][j])
        closures.append(r)
        seen = set()
        components = []
        for i in range(n):
            if not (region >> i & 1) or i in seen:
                continue
            b = [j for j in range(n) if r[i][j] and r[j][i]]
            seen.update(b)
            components.append(b)
        parts.append(components)
        cyclic = (
            bool(components)
            and len(components) == 1
            and (len(components[0]) > 1 or components[0][0] in edges[components[0][0]])
        )
        recurrent.append(cyclic)
        fairrec.append(cyclic and all(any(region >> i & 1 for i in j) for j in justice))
    truths = []
    for region in range(1 << n):
        targets = [s for s in range(1 << n) if s & region == s and fairrec[s]]
        truths.append(
            sum(
                1 << i
                for i in range(n)
                if any(
                    any(closures[region][i][j] for j in range(n) if t >> j & 1)
                    for t in targets
                )
            )
        )

    def witness(root, region):
        if not (truths[region] >> root & 1):
            return None
        seeds = {
            v
            for b in parts[region]
            if (len(b) > 1 or b[0] in edges[b[0]]) and all(set(b) & j for j in justice)
            for v in b
        }
        prefixes = []

        def visit(xs):
            v = xs[-1]
            if v in seeds:
                prefixes.append(tuple(xs))
                return
            for w in sorted(edges[v]):
                if region >> w & 1 and w not in xs:
                    visit(xs + [w])

        visit([root])
        prefix = min(prefixes, key=lambda p: (len(p), p))
        entry = prefix[-1]
        component = next(set(b) for b in parts[region] if entry in b)
        seenbits = lambda v: sum(1 << k for k, j in enumerate(justice) if v in j)
        target = (1 << len(justice)) - 1
        heap = [(0, (entry,), seenbits(entry))]
        done = set()
        cycle = None
        while heap:
            length, path, mask = heapq.heappop(heap)
            v = path[-1]
            if length and v == entry and mask == target:
                cycle = path
                break
            if (v, mask) in done:
                continue
            done.add((v, mask))
            for w in sorted(edges[v] & component):
                heapq.heappush(heap, (length + 1, path + (w,), mask | seenbits(w)))
        assert cycle is not None
        return {
            "prefix": [names[i] for i in prefix],
            "cycle": [names[i] for i in cycle],
            "justice_positions": [
                next(i for i, v in enumerate(cycle[:-1]) if v in j) for j in justice
            ],
        }

    atlas = []
    for region in range(1 << n):
        components = []
        seed = 0
        for b in parts[region]:
            hits = [set(b) & j for j in justice]
            cyclic = len(b) > 1 or b[0] in edges[b[0]]
            fair = cyclic and all(hits)
            components.append(
                {
                    "states": [names[i] for i in b],
                    "cyclic": cyclic,
                    "justice_hits": [[names[i] for i in sorted(j)] for j in hits],
                    "fair": fair,
                }
            )
            if fair:
                seed |= bits(b)
        z = seed
        rounds = []
        while True:
            pre = sum(
                1 << i
                for i in range(n)
                if region >> i & 1 and any(z >> j & 1 for j in edges[i])
            )
            after = z | pre
            rounds.append(
                {
                    "before": listed(z),
                    "predecessors": listed(pre),
                    "after": listed(after),
                }
            )
            if after == z:
                break
            z = after
        assert z == truths[region]
        atlas.append(
            {
                "mask": region,
                "allowed": listed(region),
                "components": components,
                "fair_seed": listed(seed),
                "backward_rounds": rounds,
                "truth": listed(truths[region]),
                "recurrent": recurrent[region],
                "fair_recurrent": fairrec[region],
                "witnesses": [witness(i, region) for i in range(n)],
            }
        )
    paths = [[] for _ in range(n)]

    def walk(root, xs):
        paths[root].append(xs)
        for j in sorted(edges[xs[-1]]):
            if j not in xs:
                walk(root, xs + [j])

    for i in range(n):
        walk(i, [i])

    def prefix(left, right):
        return sum(
            1 << i
            for i in range(n)
            if any(
                right >> p[-1] & 1 and all(left >> v & 1 for v in p[:-1])
                for p in paths[i]
            )
        )

    def stages(left, right):
        z = 0
        out = []
        while True:
            pre = sum(1 << i for i in range(n) if any(z >> j & 1 for j in edges[i]))
            after = right | (left & pre)
            out.append(
                {
                    "before": listed(z),
                    "predecessors": listed(pre),
                    "after": listed(after),
                }
            )
            if after == z:
                return out
            z = after

    fair = truths[full]
    old = ordinary_replay(model)
    nodes = []
    values = []
    for source in old["subformulas"]:
        op = source["op"]
        cs = source["children"]
        a = values[cs[0]] if cs else 0
        b = values[cs[1]] if len(cs) > 1 else 0
        region = None
        aux = {}
        rounds = []
        kind = "local"
        if op == "bool":
            value = full if source["formula"]["value"] else 0
        elif op == "atom":
            value = sum(
                1 << i
                for i, s in enumerate(model["states"])
                if source["formula"]["name"] in s["labels"]
            )
        elif op == "not":
            value = full ^ a
        elif op == "and":
            value = a & b
        elif op == "or":
            value = a | b
        elif op in {"EX", "AX"}:
            target = (a if op == "EX" else full ^ a) & fair
            pre = sum(
                1 << i for i in range(n) if any(target >> j & 1 for j in edges[i])
            )
            value = pre if op == "EX" else full ^ pre
            aux = {
                "fair_target": listed(target),
                "existential_predecessors": listed(pre),
            }
            kind = "fair_next" if op == "EX" else "complement_fair_next"
        elif op in {"EU", "EF", "AG"}:
            left = a if op == "EU" else full
            goal = (b if op == "EU" else a if op == "EF" else full ^ a) & fair
            value = prefix(left, goal)
            rounds = stages(left, goal)
            aux = {"left": listed(left), "fair_goal": listed(goal)}
            kind = "fair_until"
            if op == "AG":
                value = full ^ value
                kind = "complement_fair_until"
        elif op in {"EG", "AF"}:
            region = a if op == "EG" else full ^ a
            value = truths[region] if op == "EG" else full ^ truths[region]
            kind = "fair_global" if op == "EG" else "complement_fair_global"
        else:
            region = full ^ b
            goal = (full ^ (a | b)) & fair
            finite = prefix(region, goal)
            infinite = truths[region]
            value = full ^ (finite | infinite)
            rounds = stages(region, goal)
            aux = {
                "finite_bad": listed(finite),
                "infinite_bad": listed(infinite),
                "left": listed(region),
                "fair_goal": listed(goal),
            }
            kind = "complement_two_fair_failures"
        values.append(value)
        ordinary = bits(names.index(s) for s in source["truth"])
        nodes.append(
            {
                "id": source["id"],
                "formula": source["formula"],
                "op": op,
                "children": cs,
                "truth": listed(value),
                "false": listed(full ^ value),
                "ordinary_truth": source["truth"],
                "changed": listed(ordinary ^ value),
                "kind": kind,
                "region_mask": region,
                "auxiliary": aux,
                "rounds": rounds,
                "state_checks": [
                    {
                        "state": names[i],
                        "holds": bool(value >> i & 1),
                        "ordinary_holds": bool(ordinary >> i & 1),
                        "children_hold": [bool(values[c] >> i & 1) for c in cs],
                        "fair_continuation": bool(fair >> i & 1),
                        "universal_without_fair_path": op.startswith("A")
                        and not bool(fair >> i & 1),
                    }
                    for i in range(n)
                ],
            }
        )
    return {
        "schema": "branchlab-fair-v1",
        "input": data,
        "fair_states": listed(fair),
        "no_fair_states": listed(full ^ fair),
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


def verify_fair(report):
    if type(report) is not dict or report.get("schema") != "branchlab-fair-v1":
        raise ValueError("wrong fair report schema")
    equal(report, expected(report.get("input")))
    return True
