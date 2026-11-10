"""Optional graph reference, not a third-party fair-CTL checker."""

import json, sys
from pathlib import Path
import networkx as nx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from branchlab.fair import analyze_fair
from tools.fair_cases import controls, exhaustive, seeded

counts = {"requests": 0, "regions": 0, "components": 0, "lassos": 0}
for raw in list(exhaustive()) + seeded() + [c["input"] for c in controls()]:
    r = analyze_fair(raw)
    names = [s["name"] for s in raw["model"]["states"]]
    g = nx.DiGraph()
    g.add_nodes_from(names)
    g.add_edges_from((s["name"], t) for s in raw["model"]["states"] for t in s["next"])
    full = set(names)
    for t in r["region_atlas"]:
        sub = g.subgraph(t["allowed"])
        parts = sorted(
            (sorted(c, key=names.index) for c in nx.strongly_connected_components(sub)),
            key=lambda b: names.index(b[0]),
        )
        assert parts == [c["states"] for c in t["components"]]
        seed = set()
        for b, c in zip(parts, t["components"]):
            cyclic = len(b) > 1 or sub.has_edge(b[0], b[0])
            hits = [sorted(set(b) & set(j), key=names.index) for j in raw["justice"]]
            fair = cyclic and all(hits)
            assert c == {
                "states": b,
                "cyclic": cyclic,
                "justice_hits": hits,
                "fair": fair,
            }
            counts["components"] += 1
            if fair:
                seed.update(b)
        fairfrom = {v for target in seed for v in nx.ancestors(sub, target) | {target}}
        assert fairfrom == set(t["truth"])
        counts["regions"] += 1
        for root, w in enumerate(t["witnesses"]):
            assert (w is not None) == (names[root] in fairfrom)
            if w is None:
                continue
            assert (
                w["prefix"][0] == names[root]
                and w["prefix"][-1] == w["cycle"][0] == w["cycle"][-1]
                and len(w["cycle"]) > 1
            )
            assert len(w["prefix"]) - 1 == min(
                nx.shortest_path_length(sub, names[root], v)
                for v in seed
                if nx.has_path(sub, names[root], v)
            )
            for p in [w["prefix"], w["cycle"]]:
                assert all(sub.has_edge(a, b) for a, b in zip(p, p[1:]))
            for j in raw["justice"]:
                assert set(j) & set(w["cycle"][:-1])
            counts["lassos"] += 1
    counts["requests"] += 1
print(json.dumps({"networkx_version": nx.__version__, **counts}))
