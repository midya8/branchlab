/* Original bounded state-justice inspector. No model-checker source copied. */
import { analyze as ordinary, validate as baseValidate } from "./engine.js";
export const limits = [
  "One to six supplied total Kripke states; deadlocks rejected, not silently totalized.",
  "Zero to four state-justice sets. A fair infinite path visits every set infinitely often; an empty set makes fairness impossible.",
  "Atomic and Boolean state truth stays local. Only temporal path quantifiers range over fair paths; universal temporal claims may be vacuous without a fair continuation.",
  "Justice is an assumption, not a scheduler, controller, probability, action-fairness or Streett/compassion guarantee.",
  "Every induced state region is audited. A multi-justice recurrent walk may repeat intermediate states and need not be a simple cycle.",
  "Existing CTL AST caps and strong time-zero until semantics retained; nested quantifiers restart at each state.",
  "Established finite fair CTL, original bounded implementation. No CTL*, scalable solver, new theorem or actual-agent guarantee.",
];
export function validateFair(x) {
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    Object.keys(x).sort().join(",") !== "justice,model"
  )
    throw Error("requires exactly model and justice");
  const model = baseValidate(x.model),
    names = model.states.map((s) => s.name);
  if (!Array.isArray(x.justice) || x.justice.length > 4)
    throw Error("justice length0..4");
  const justice = x.justice.map((j) => {
    if (
      !Array.isArray(j) ||
      j.some((s) => typeof s !== "string" || !names.includes(s)) ||
      new Set(j).size !== j.length
    )
      throw Error("invalid justice set");
    return names.filter((s) => j.includes(s));
  });
  return { model, justice };
}
export function analyzeFair(raw) {
  const input = validateFair(raw),
    { model } = input,
    names = model.states.map((s) => s.name),
    n = names.length,
    world = names.map((_, i) => i),
    all = (1 << n) - 1,
    adj = model.states.map((s) => s.next.map((t) => names.indexOf(t))),
    justice = input.justice.map((j) => new Set(j.map((s) => names.indexOf(s)))),
    list = (s) => world.filter((i) => s.has(i)).map((i) => names[i]),
    bits = (s) => [...s].reduce((a, i) => a | (1 << i), 0),
    subset = (m) => new Set(world.filter((i) => (m >> i) & 1)),
    intersection = (a, b) => new Set([...a].filter((i) => b.has(i))),
    minus = (a, b) => new Set([...a].filter((i) => !b.has(i))),
    union = (a, b) => new Set([...a, ...b]),
    W = new Set(world);
  function components(allowed) {
    const seen = new Set(),
      order = [];
    function dfs(v) {
      seen.add(v);
      for (const w of adj[v]) if (allowed.has(w) && !seen.has(w)) dfs(w);
      order.push(v);
    }
    for (const v of world) if (allowed.has(v) && !seen.has(v)) dfs(v);
    seen.clear();
    const out = [];
    function rev(v, b) {
      seen.add(v);
      b.push(v);
      for (const w of world)
        if (allowed.has(w) && adj[w].includes(v) && !seen.has(w)) rev(w, b);
    }
    for (const v of order.reverse())
      if (!seen.has(v)) {
        const b = [];
        rev(v, b);
        out.push(b.sort((a, b) => a - b));
      }
    return out.sort((a, b) => a[0] - b[0]);
  }
  const atlas = [];
  for (let mask = 0; mask <= all; mask++) {
    const allowed = subset(mask),
      parts = components(allowed),
      cs = parts.map((b) => {
        const cyclic = b.length > 1 || adj[b[0]].includes(b[0]),
          hits = justice.map((j) => b.filter((i) => j.has(i)));
        return {
          states: b,
          cyclic,
          justice_hits: hits,
          fair: cyclic && hits.every((h) => h.length > 0),
        };
      }),
      seed = new Set(cs.filter((c) => c.fair).flatMap((c) => c.states));
    let value = new Set(seed);
    const rounds = [];
    for (;;) {
      const pre = new Set(
          [...allowed].filter((v) => adj[v].some((w) => value.has(w))),
        ),
        after = union(value, pre);
      rounds.push({
        before: list(value),
        predecessors: list(pre),
        after: list(after),
      });
      if (bits(after) === bits(value)) break;
      value = after;
    }
    const witnesses = world.map((root) => {
      if (!value.has(root)) return null;
      const queue = [[root]],
        visited = new Set([root]);
      let prefix;
      for (let pos = 0; pos < queue.length; pos++) {
        const p = queue[pos],
          v = p.at(-1);
        if (seed.has(v)) {
          prefix = p;
          break;
        }
        for (const w of adj[v])
          if (allowed.has(w) && !visited.has(w)) {
            visited.add(w);
            queue.push([...p, w]);
          }
      }
      const entry = prefix.at(-1),
        comp = new Set(parts.find((b) => b.includes(entry))),
        hit = (v) =>
          justice.reduce((m, j, k) => m | (j.has(v) ? 1 << k : 0), 0),
        target = (1 << justice.length) - 1,
        walks = [{ v: entry, mask: hit(entry), path: [entry] }],
        seen = new Set([entry + ":" + hit(entry)]);
      let cycle;
      search: for (let pos = 0; pos < walks.length; pos++) {
        const p = walks[pos];
        for (const w of adj[p.v]) {
          if (!comp.has(w)) continue;
          const m = p.mask | hit(w),
            path = [...p.path, w];
          if (w === entry && m === target) {
            cycle = path;
            break search;
          }
          const key = w + ":" + m;
          if (!seen.has(key)) {
            seen.add(key);
            walks.push({ v: w, mask: m, path });
          }
        }
      }
      if (!cycle) throw Error("fair cycle missing");
      return {
        prefix: prefix.map((i) => names[i]),
        cycle: cycle.map((i) => names[i]),
        justice_positions: justice.map((j) =>
          cycle.slice(0, -1).findIndex((v) => j.has(v)),
        ),
      };
    });
    atlas.push({
      mask,
      allowed: list(allowed),
      components: cs.map((c) => ({
        states: c.states.map((i) => names[i]),
        cyclic: c.cyclic,
        justice_hits: c.justice_hits.map((h) => h.map((i) => names[i])),
        fair: c.fair,
      })),
      fair_seed: list(seed),
      backward_rounds: rounds,
      truth: list(value),
      recurrent: allowed.size > 0 && cs.length === 1 && cs[0].cyclic,
      fair_recurrent: allowed.size > 0 && cs.length === 1 && cs[0].fair,
      witnesses,
    });
  }
  const fair = new Set(atlas[all].truth.map((s) => names.indexOf(s))),
    old = ordinary(model),
    nodes = [],
    values = [];
  function reach(left, right) {
    let z = new Set();
    const rounds = [];
    for (;;) {
      const pre = new Set(world.filter((i) => adj[i].some((j) => z.has(j)))),
        after = union(right, intersection(left, pre));
      rounds.push({
        before: list(z),
        predecessors: list(pre),
        after: list(after),
      });
      if (bits(after) === bits(z)) return { value: z, rounds };
      z = after;
    }
  }
  for (const o of old.subformulas) {
    const op = o.op,
      cs = o.children,
      a = cs.length ? values[cs[0]] : new Set(),
      b = cs.length > 1 ? values[cs[1]] : new Set();
    let value,
      kind = "local",
      aux = {},
      rounds = [],
      region = null;
    if (op === "bool") value = o.formula.value ? new Set(W) : new Set();
    else if (op === "atom")
      value = new Set(
        world.filter((i) => model.states[i].labels.includes(o.formula.name)),
      );
    else if (op === "not") value = minus(W, a);
    else if (op === "and") value = intersection(a, b);
    else if (op === "or") value = union(a, b);
    else if (op === "EX" || op === "AX") {
      const target = intersection(op === "EX" ? a : minus(W, a), fair),
        pre = new Set(world.filter((i) => adj[i].some((j) => target.has(j))));
      value = op === "EX" ? pre : minus(W, pre);
      aux = { fair_target: list(target), existential_predecessors: list(pre) };
      kind = op === "EX" ? "fair_next" : "complement_fair_next";
    } else if (["EU", "EF", "AG"].includes(op)) {
      const left = op === "EU" ? a : W,
        goal = intersection(
          op === "EU" ? b : op === "EF" ? a : minus(W, a),
          fair,
        ),
        r = reach(left, goal);
      value = r.value;
      rounds = r.rounds;
      aux = { left: list(left), fair_goal: list(goal) };
      kind = "fair_until";
      if (op === "AG") {
        value = minus(W, value);
        kind = "complement_fair_until";
      }
    } else if (op === "EG" || op === "AF") {
      region = bits(op === "EG" ? a : minus(W, a));
      const v = new Set(atlas[region].truth.map((s) => names.indexOf(s)));
      value = op === "EG" ? v : minus(W, v);
      kind = op === "EG" ? "fair_global" : "complement_fair_global";
    } else {
      const left = minus(W, b),
        goal = intersection(minus(W, union(a, b)), fair),
        r = reach(left, goal);
      region = bits(left);
      const inf = new Set(atlas[region].truth.map((s) => names.indexOf(s)));
      rounds = r.rounds;
      value = minus(W, union(r.value, inf));
      aux = {
        finite_bad: list(r.value),
        infinite_bad: list(inf),
        left: list(left),
        fair_goal: list(goal),
      };
      kind = "complement_two_fair_failures";
    }
    values.push(value);
    const truth = list(value),
      original = new Set(o.truth),
      changed = names.filter((s) => original.has(s) !== truth.includes(s));
    nodes.push({
      id: o.id,
      formula: o.formula,
      op,
      children: cs,
      truth,
      false: list(minus(W, value)),
      ordinary_truth: o.truth,
      changed,
      kind,
      region_mask: region,
      auxiliary: aux,
      rounds,
      state_checks: world.map((i) => ({
        state: names[i],
        holds: value.has(i),
        ordinary_holds: original.has(names[i]),
        children_hold: cs.map((c) => values[c].has(i)),
        fair_continuation: fair.has(i),
        universal_without_fair_path: op.startsWith("A") && !fair.has(i),
      })),
    });
  }
  return {
    schema: "branchlab-fair-v1",
    input,
    fair_states: list(fair),
    no_fair_states: list(minus(W, fair)),
    region_atlas: atlas,
    roots: old.roots,
    subformulas: nodes,
    results: old.roots.map((i) => ({
      formula_id: i,
      truth: nodes[i].truth,
      ordinary_truth: nodes[i].ordinary_truth,
      changed: nodes[i].changed,
    })),
    limits: limits.slice(),
  };
}
