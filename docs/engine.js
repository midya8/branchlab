/* Original finite CTL implementation. No external model-checker code copied. */
"use strict";
const unary = new Set(["not", "EX", "AX", "EF", "AF", "EG", "AG"]);
const binary = new Set(["and", "or", "EU", "AU"]);
const fixed = new Set(["EF", "AF", "EG", "AG", "EU", "AU"]);
const limits = [
  "One to six supplied finite Kripke states; every state has at least one successor. Deadlocks are rejected, never silently totalized.",
  "All paths are infinite. No fairness constraints, probabilities, actions, controller or adversary are supplied.",
  "CTL path quantifiers restart at every state subformula; this is not arbitrary LTL or CTL*.",
  "Until is strong: the right operand must eventually hold, including at time zero.",
  "A single execution does not in general prove a universal formula or refute an existential formula. Branching obligations and fixed-point extrema remain part of the evidence.",
  "One to eight formula roots; at most32 AST nodes and depth6 per root, at most128 AST nodes in total; at most four declared atomic propositions.",
  "Classical finite CTL model checking; bounded examples and independent agreement are not new theory, a scalable solver or a guarantee about actual software or AI agents.",
];
const obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const keys = (x, ks) =>
  obj(x) && Object.keys(x).sort().join(",") === ks.slice().sort().join(",");
const identifier = (x) =>
  typeof x === "string" && /^[A-Za-z_][A-Za-z_0-9]{0,23}$/.test(x);
function validate(d) {
  const fail = (m) => {
    throw Error(m);
  };
  if (!keys(d, ["states", "atoms", "formulas"]))
    fail("request requires exactly states, atoms and formulas");
  if (
    !Array.isArray(d.atoms) ||
    d.atoms.length > 4 ||
    d.atoms.some((x) => !identifier(x)) ||
    new Set(d.atoms).size !== d.atoms.length
  )
    fail("invalid atoms");
  if (!Array.isArray(d.states) || d.states.length < 1 || d.states.length > 6)
    fail("states must have length1..6");
  const names = [];
  for (const s of d.states) {
    if (
      !keys(s, ["name", "labels", "next"]) ||
      !identifier(s.name) ||
      names.includes(s.name)
    )
      fail("invalid or duplicate state");
    names.push(s.name);
  }
  const ss = d.states.map((s) => {
    if (
      !Array.isArray(s.labels) ||
      s.labels.some((a) => !d.atoms.includes(a)) ||
      new Set(s.labels).size !== s.labels.length
    )
      fail("invalid labels");
    if (
      !Array.isArray(s.next) ||
      s.next.length < 1 ||
      s.next.length > 6 ||
      s.next.some((n) => !names.includes(n)) ||
      new Set(s.next).size !== s.next.length
    )
      fail("every state needs unique declared successors");
    return {
      name: s.name,
      labels: d.atoms.filter((a) => s.labels.includes(a)),
      next: names.filter((n) => s.next.includes(n)),
    };
  });
  if (
    !Array.isArray(d.formulas) ||
    d.formulas.length < 1 ||
    d.formulas.length > 8
  )
    fail("formulas must have length1..8");
  let total = 0;
  function ast(x, depth, c) {
    if (++total > 128 || ++c.n > 32 || depth > 6)
      fail("formula AST limit exceeded");
    if (!obj(x) || typeof x.op !== "string") fail("formula needs op");
    if (
      x.op === "bool" &&
      keys(x, ["op", "value"]) &&
      typeof x.value === "boolean"
    )
      return { op: x.op, value: x.value };
    if (x.op === "atom" && keys(x, ["op", "name"]) && d.atoms.includes(x.name))
      return { op: x.op, name: x.name };
    if (unary.has(x.op) && keys(x, ["op", "arg"]))
      return { op: x.op, arg: ast(x.arg, depth + 1, c) };
    if (binary.has(x.op) && keys(x, ["op", "left", "right"]))
      return {
        op: x.op,
        left: ast(x.left, depth + 1, c),
        right: ast(x.right, depth + 1, c),
      };
    fail("invalid formula operator, arity, atom or value");
  }
  return {
    states: ss,
    atoms: d.atoms.slice(),
    formulas: d.formulas.map((x) => ast(x, 1, { n: 0 })),
  };
}
function analyze(request) {
  const input = validate(request),
    ss = input.states,
    names = ss.map((s) => s.name),
    n = ss.length,
    full = (1 << n) - 1,
    adj = ss.map((s) => s.next.map((v) => names.indexOf(v))),
    nodes = [],
    values = [],
    lookup = new Map();
  const list = (z) => names.filter((_, i) => (z >> i) & 1);
  const sorted = (x) => JSON.stringify(x, Object.keys(x).sort());
  const canonical = (x) =>
    obj(x)
      ? "{" +
        Object.keys(x)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(x[k]))
          .join(",") +
        "}"
      : JSON.stringify(x);
  function build(f) {
    const key = canonical(f);
    if (lookup.has(key)) return lookup.get(key);
    const op = f.op,
      cs =
        "arg" in f
          ? [build(f.arg)]
          : "left" in f
            ? [build(f.left), build(f.right)]
            : [],
      a = cs.length ? values[cs[0]] : 0,
      b = cs.length > 1 ? values[cs[1]] : 0;
    function checks(z) {
      return adj.map((row, i) => {
        const targets = row.map((j) => Boolean((z >> j) & 1)),
          all = op.startsWith("A"),
          pre = all ? targets.every(Boolean) : targets.some(Boolean),
          left = Boolean((a >> i) & 1),
          right = Boolean((b >> i) & 1);
        const admitted = ["EF", "AF"].includes(op)
          ? left || pre
          : ["EG", "AG"].includes(op)
            ? left && pre
            : right || (left && pre);
        return {
          state: names[i],
          left_holds: left,
          right_holds: cs.length > 1 ? right : null,
          successors: row.map((j) => names[j]),
          successor_in_before: targets,
          operator: all ? "all" : "any",
          predecessor_test: pre,
          admitted,
        };
      });
    }
    const image = (z) =>
      checks(z).reduce((m, c, i) => m | (c.admitted ? 1 << i : 0), 0);
    let v = 0,
      rounds = [],
      atlas = [];
    if (op === "bool") v = f.value ? full : 0;
    else if (op === "atom")
      v = ss.reduce(
        (m, s, i) => m | (s.labels.includes(f.name) ? 1 << i : 0),
        0,
      );
    else if (op === "not") v = full ^ a;
    else if (op === "and") v = a & b;
    else if (op === "or") v = a | b;
    else if (["EX", "AX"].includes(op))
      v = adj.reduce(
        (m, row, i) =>
          m |
          ((
            op === "EX"
              ? row.some((j) => (a >> j) & 1)
              : row.every((j) => (a >> j) & 1)
          )
            ? 1 << i
            : 0),
        0,
      );
    else {
      v = ["EG", "AG"].includes(op) ? full : 0;
      for (let k = 0; k <= n + 1; k++) {
        const ch = checks(v),
          after = image(v);
        rounds.push({
          index: k,
          before: list(v),
          checks: ch,
          after: list(after),
          added: list(after & ~v),
          removed: list(v & ~after),
        });
        if (after === v) break;
        v = after;
      }
      for (let mask = 0; mask <= full; mask++) {
        const im = image(mask);
        atlas.push({
          mask,
          candidate: list(mask),
          image: list(im),
          fixed: mask === im,
          pre_fixed: (im & mask) === im,
          post_fixed: (im & mask) === mask,
        });
      }
    }
    const id = nodes.length;
    lookup.set(key, id);
    values.push(v);
    const examples = names.map((start, root) => {
      const holds = Boolean((v >> root) & 1);
      let kind = "branching_certificate",
        path = null,
        cycle = null,
        goal = null,
        allowed = full;
      if (["EF", "EU"].includes(op) && holds) {
        goal = op === "EF" ? a : b;
        allowed = op === "EF" ? full : a;
      } else if (op === "AG" && !holds) goal = full ^ a;
      else if (op === "AU" && !holds) {
        goal = full ^ (a | b);
        allowed = full ^ b;
      }
      if (goal !== null) {
        const queue = [[root]];
        while (queue.length) {
          const xs = queue.shift(),
            i = xs.at(-1);
          if ((goal >> i) & 1) {
            path = xs;
            kind = "finite_path";
            break;
          }
          if (!((allowed >> i) & 1)) continue;
          for (const j of adj[i]) if (!xs.includes(j)) queue.push([...xs, j]);
        }
      }
      if (
        (op === "EG" && holds) ||
        (["AF", "AU"].includes(op) && !holds && path === null)
      ) {
        allowed = op === "EG" ? a : full ^ (op === "AF" ? a : b);
        const queue = [[root]];
        while (queue.length) {
          const xs = queue.shift(),
            i = xs.at(-1);
          if (!((allowed >> i) & 1)) continue;
          for (const j of adj[i]) {
            if (!((allowed >> j) & 1)) continue;
            if (xs.includes(j)) {
              path = [...xs, j];
              cycle = xs.indexOf(j);
              kind = "lasso";
              break;
            }
            queue.push([...xs, j]);
          }
          if (path !== null) break;
        }
      }
      if (op === "EX" && holds) {
        path = [root, adj[root].find((j) => (a >> j) & 1)];
        kind = "finite_path";
      }
      if (op === "AX" && !holds) {
        path = [root, adj[root].find((j) => !((a >> j) & 1))];
        kind = "finite_path";
      }
      return {
        start,
        holds,
        kind,
        nodes: path === null ? null : path.map((j) => names[j]),
        cycle_start: cycle,
      };
    });
    nodes.push({
      id,
      formula: f,
      op,
      children: cs,
      truth: list(v),
      false: list(full ^ v),
      fixed_point: ["EG", "AG"].includes(op)
        ? "greatest"
        : fixed.has(op)
          ? "least"
          : null,
      rounds,
      subset_atlas: atlas,
      state_checks: names.map((state, i) => ({
        state,
        holds: Boolean((v >> i) & 1),
        children_hold: cs.map((c) => Boolean((values[c] >> i) & 1)),
        successors: ["EX", "AX"].includes(op)
          ? adj[i].map((j) => ({
              to: names[j],
              child_holds: Boolean((a >> j) & 1),
            }))
          : [],
      })),
      examples,
    });
    return id;
  }
  const roots = input.formulas.map(build);
  return {
    schema: "branchlab-v1",
    input,
    roots,
    subformulas: nodes,
    results: roots.map((i) => ({
      formula_id: i,
      truth: nodes[i].truth,
      false: nodes[i].false,
    })),
    limits: limits.slice(),
  };
}
// Strict duplicate-key parser adapted from our AbsorbLab parser, with independent
// full certificate checks still performed by branchlab.verify.
export function parseJSON(raw) {
  if (new TextEncoder().encode(raw).length > 65536)
    throw Error("input exceeds65536 bytes");
  let p = 0;
  const ws = () => {
    while (/[ \t\r\n]/.test(raw[p] ?? "") && p < raw.length) p++;
  };
  function string() {
    const start = p++;
    while (p < raw.length) {
      if (raw[p] === "\\") {
        p += 2;
        continue;
      }
      if (raw[p++] === '"') return JSON.parse(raw.slice(start, p));
    }
    throw Error("unterminated string");
  }
  function value() {
    ws();
    const c = raw[p];
    if (c === '"') return string();
    if (c === "{") {
      p++;
      const keys = new Set(),
        out = Object.create(null);
      ws();
      if (raw[p] === "}") {
        p++;
        return out;
      }
      while (true) {
        ws();
        if (raw[p] !== '"') throw Error("object key must be string");
        const k = string();
        if (keys.has(k)) throw Error("duplicate JSON key");
        keys.add(k);
        ws();
        if (raw[p++] !== ":") throw Error("missing colon");
        out[k] = value();
        ws();
        const sep = raw[p++];
        if (sep === "}") return out;
        if (sep !== ",") throw Error("missing comma");
      }
    }
    if (c === "[") {
      p++;
      const out = [];
      ws();
      if (raw[p] === "]") {
        p++;
        return out;
      }
      while (true) {
        out.push(value());
        ws();
        const sep = raw[p++];
        if (sep === "]") return out;
        if (sep !== ",") throw Error("missing comma");
      }
    }
    for (const [token, v] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ])
      if (raw.startsWith(token, p)) {
        p += token.length;
        return v;
      }
    const number = raw
      .slice(p)
      .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!number) throw Error("invalid JSON value");
    p += number[0].length;
    if (/[.eE]/.test(number[0])) throw Error("integer JSON number required");
    const n = Number(number[0]);
    if (!Number.isFinite(n)) throw Error("nonfinite JSON number");
    return n;
  }
  const result = value();
  ws();
  if (p !== raw.length) throw Error("trailing JSON content");
  return result;
}

export { analyze, validate };
