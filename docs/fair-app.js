import { analyzeFair, limits } from "./fair-engine.js";
import { parseJSON as parseStrictJSON } from "./engine.js";
const $ = (id) => document.getElementById(id),
  controls = await (await fetch("fair-controls.json")).json(),
  names = () => window.currentFairReport.input.model.states.map((s) => s.name),
  no = (x) => (x ? "yes" : "no"),
  joined = (x) => x.join(", ") || "none";
export function format(f) {
  if (f.op === "bool") return String(f.value);
  if (f.op === "atom") return f.name;
  if (f.op === "not") return "not (" + format(f.arg) + ")";
  if (f.arg) return f.op + " (" + format(f.arg) + ")";
  return "(" + format(f.left) + ") " + f.op + " (" + format(f.right) + ")";
}
function table(id, heads, rows) {
  const t = document.createElement("table"),
    h = t.createTHead().insertRow();
  heads.forEach((s) => {
    const th = document.createElement("th");
    th.textContent = s;
    h.append(th);
  });
  const b = t.createTBody();
  for (const row of rows) {
    const tr = b.insertRow();
    for (const v of row) {
      const td = tr.insertCell();
      td.textContent = typeof v === "object" ? JSON.stringify(v) : String(v);
    }
  }
  $(id).replaceChildren(t);
}
function cards(id, items) {
  $(id).replaceChildren(
    ...items.map(([title, text, warn]) => {
      const d = document.createElement("div");
      d.className = "card" + (warn ? " warn" : "");
      const h = document.createElement("h3");
      h.textContent = title;
      const p = document.createElement("p");
      p.textContent = text;
      d.append(h, p);
      return d;
    }),
  );
}
function opts(id, items) {
  $(id).replaceChildren(
    ...items.map(([v, t]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      return o;
    }),
  );
}
function graph() {
  const r = window.currentFairReport,
    t = r.region_atlas[Number($("region").value)],
    root = Number($("start").value),
    w = t.witnesses[root],
    ns = names(),
    n = ns.length,
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 440 440");
  const add = (tag, attrs, parent = svg) => {
      const e = document.createElementNS(svg.namespaceURI, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      parent.append(e);
      return e;
    },
    defs = add("defs", {});
  for (const [id, col] of [
    ["edge", "#6d818b"],
    ["cycle", "#c9f178"],
    ["prefix", "#8fd9e0"],
  ]) {
    const m = add(
      "marker",
      {
        id: "arrow-" + id,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: "auto",
      },
      defs,
    );
    add("path", { d: "M0,0 L10,5 L0,10z", fill: col }, m);
  }
  const pts = ns.map((_, i) =>
      n === 1
        ? [220, 220]
        : [
            220 + 130 * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / n),
            220 + 130 * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / n),
          ],
    ),
    pairs = (xs) => xs?.slice(1).map((v, i) => xs[i] + ">" + v) || [],
    cycle = new Set(pairs(w?.cycle)),
    prefix = new Set(pairs(w?.prefix));
  for (let a = 0; a < n; a++)
    for (const dest of r.input.model.states[a].next) {
      const b = ns.indexOf(dest),
        [x, y] = pts[a],
        [u, v] = pts[b],
        key = ns[a] + ">" + ns[b],
        type = cycle.has(key) ? "cycle" : prefix.has(key) ? "prefix" : "edge";
      let d;
      if (a === b) {
        const len = Math.hypot(x - 220, y - 220),
          ux = len ? (x - 220) / len : 0,
          uy = len ? (y - 220) / len : -1,
          px = -uy,
          py = ux;
        d = `M${x + 19 * ux + 16 * px},${y + 19 * uy + 16 * py} C${x + 67 * ux + 47 * px},${y + 67 * uy + 47 * py} ${x + 67 * ux - 47 * px},${y + 67 * uy - 47 * py} ${x + 19 * ux - 16 * px},${y + 19 * uy - 16 * py}`;
      } else {
        const dx = u - x,
          dy = v - y,
          len = Math.hypot(dx, dy),
          sx = x + (28 * dx) / len,
          sy = y + (28 * dy) / len,
          ex = u - (30 * dx) / len,
          ey = v - (30 * dy) / len,
          cx = (sx + ex) / 2 - (22 * dy) / len,
          cy = (sy + ey) / 2 + (22 * dx) / len;
        d = r.input.model.states[b].next.includes(ns[a])
          ? `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`
          : `M${sx},${sy} L${ex},${ey}`;
      }
      add("path", {
        d,
        class:
          "edge " +
          type +
          (!t.allowed.includes(ns[a]) || !t.allowed.includes(ns[b])
            ? " off"
            : ""),
        "marker-end": "url(#arrow-" + type + ")",
        "data-source": a,
        "data-target": b,
        "data-role": type,
      });
    }
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i],
      g = add("g", {
        "data-state": i,
        "data-allowed": String(t.allowed.includes(ns[i])),
      }),
      fair = t.components.some((c) => c.fair && c.states.includes(ns[i]));
    g.setAttribute("class", t.allowed.includes(ns[i]) ? "" : "off");
    add(
      "circle",
      { cx: x, cy: y, r: 26, fill: fair ? "#3a5630" : "#253942" },
      g,
    );
    add("text", { x, y: y - 2, "text-anchor": "middle" }, g).textContent =
      "s" + i;
    add(
      "text",
      { x, y: y + 44, "text-anchor": "middle", class: "mark" },
      g,
    ).textContent = r.input.model.states[i].labels
      .map((a) => "p" + r.input.model.atoms.indexOf(a))
      .join(" ");
    add(
      "text",
      { x, y: y + 15, "text-anchor": "middle", class: "justice" },
      g,
    ).textContent = r.input.justice.some((j) => j.includes(ns[i]))
      ? "J" +
        r.input.justice
          .flatMap((j, k) => (j.includes(ns[i]) ? [k] : []))
          .join(",")
      : "";
  }
  $("graph").replaceChildren(svg);
}
function showRegion() {
  const r = window.currentFairReport,
    t = r.region_atlas[Number($("region").value)],
    w = t.witnesses[Number($("start").value)];
  cards("region-summary", [
    ["Allowed region", joined(t.allowed)],
    ["Fair recurrent seed", joined(t.fair_seed), !t.fair_seed.length],
    [
      "Has a fair continuation inside this region",
      joined(t.truth),
      !t.truth.length,
    ],
    [
      "This whole region as a recurrent set",
      "Recurrent: " +
        no(t.recurrent) +
        "\nFair recurrent: " +
        no(t.fair_recurrent),
    ],
  ]);
  cards(
    "lasso-summary",
    w
      ? [
          ["Prefix / before repeating", w.prefix.join(" → ")],
          ["Cycle / repeat forever", w.cycle.join(" → ")],
          [
            "Justice occurrence positions",
            w.justice_positions
              .map((v, i) => "J" + i + ": cycle[" + v + "] = " + w.cycle[v])
              .join("\n") || "No justice constraints",
          ],
        ]
      : [
          [
            "No fair lasso from this start",
            "No fair path stays in the selected region. This is not a missing witness.",
            true,
          ],
        ],
  );
  table(
    "component-table",
    ["Component states", "Has a cycle", "Justice hits, in order", "Fair"],
    t.components.map((c) => [
      joined(c.states),
      no(c.cyclic),
      c.justice_hits.map((h, i) => "J" + i + ": " + joined(h)).join("; ") ||
        "no constraints",
      no(c.fair),
    ]),
  );
  table(
    "walk-table",
    ["Part", "Position", "State", "Justice sets met"],
    w
      ? ["prefix", "cycle"].flatMap((k) =>
          w[k].map((s, i) => [
            k,
            i,
            s,
            joined(
              r.input.justice.flatMap((j, k) =>
                j.includes(s) ? ["J" + k] : [],
              ),
            ),
          ]),
        )
      : [],
  );
  table(
    "reach-table",
    ["Round", "Before", "Allowed predecessors", "After"],
    t.backward_rounds.map((q, i) => [
      i,
      joined(q.before),
      joined(q.predecessors),
      joined(q.after),
    ]),
  );
  $("region-json").textContent = JSON.stringify(t, null, 2);
  graph();
}
function showFormula() {
  const r = window.currentFairReport,
    f = r.subformulas[Number($("formula").value)];
  cards("formula-summary", [
    ["Selected formula", format(f.formula)],
    ["Ordinary truth", joined(f.ordinary_truth)],
    ["Fair truth", joined(f.truth)],
    ["Changed states", joined(f.changed), f.changed.length > 0],
    ["Evidence route", f.kind],
    ["Auxiliary sets", JSON.stringify(f.auxiliary)],
  ]);
  table(
    "state-table",
    [
      "State",
      "Fair truth",
      "Ordinary truth",
      "Children",
      "Fair continuation",
      "Universal with no fair path",
    ],
    f.state_checks.map((c) => [
      c.state,
      no(c.holds),
      no(c.ordinary_holds),
      c.children_hold.map(no).join(", "),
      no(c.fair_continuation),
      no(c.universal_without_fair_path),
    ]),
  );
  table(
    "round-table",
    ["Round", "Before", "All predecessors", "After"],
    f.rounds.map((q, i) => [
      i,
      joined(q.before),
      joined(q.predecessors),
      joined(q.after),
    ]),
  );
  $("open-region").disabled = f.region_mask === null;
  $("formula-json").textContent = JSON.stringify(f, null, 2);
}
function show(r) {
  $("results").hidden = false;
  cards("fair-summary", [
    ["Fair states", joined(r.fair_states)],
    [
      "No fair continuation",
      joined(r.no_fair_states),
      r.no_fair_states.length > 0,
    ],
    ["Complete region atlas", r.region_atlas.length + " induced state regions"],
  ]);
  table(
    "model-table-fair",
    [
      "Graph index",
      "Supplied state name",
      "Atom labels",
      "Original successors",
    ],
    r.input.model.states.map((s, i) => [
      "s" + i,
      s.name,
      joined(s.labels),
      joined(s.next),
    ]),
  );
  table(
    "atom-table-fair",
    ["Graph atom index", "Supplied atom"],
    r.input.model.atoms.map((a, i) => ["p" + i, a]),
  );
  table(
    "justice-table",
    ["Constraint", "Must visit infinitely often"],
    r.input.justice.map((j, i) => ["J" + i, joined(j)]),
  );
  table(
    "root-table",
    ["Root", "Formula", "Ordinary truth", "Fair truth", "Changed"],
    r.results.map((x, i) => [
      i,
      format(r.subformulas[x.formula_id].formula),
      joined(x.ordinary_truth),
      joined(x.truth),
      joined(x.changed),
    ]),
  );
  opts(
    "region",
    r.region_atlas.map((t) => [
      t.mask,
      t.mask +
        " / {" +
        t.allowed.join(",") +
        "} / fair from {" +
        t.truth.join(",") +
        "}",
    ]),
  );
  $("region").value = r.region_atlas.length - 1;
  opts(
    "start",
    names().map((s, i) => [i, s]),
  );
  opts(
    "formula",
    r.subformulas.map((f) => [f.id, f.id + " / " + format(f.formula)]),
  );
  $("formula").value = r.roots[0];
  table(
    "atlas-table",
    [
      "Mask",
      "Allowed states",
      "Recurrent",
      "Fair recurrent",
      "Fair seed",
      "Fair from",
    ],
    r.region_atlas.map((t) => [
      t.mask,
      joined(t.allowed),
      no(t.recurrent),
      no(t.fair_recurrent),
      joined(t.fair_seed),
      joined(t.truth),
    ]),
  );
  showRegion();
  showFormula();
  $("report-json").textContent = JSON.stringify(r, null, 2);
  $("download").disabled = false;
}
function clear() {
  window.currentFairReport = null;
  $("results").hidden = true;
  $("download").disabled = true;
  $("graph").replaceChildren();
  $("report-json").textContent = "";
}
function run() {
  clear();
  try {
    const r = analyzeFair(parseStrictJSON($("input").value));
    window.currentFairReport = r;
    show(r);
    $("status").textContent =
      "Exact fair CTL: " +
      r.region_atlas.length +
      " regions, " +
      r.subformulas.length +
      " subformulas, " +
      r.fair_states.length +
      " states with a fair continuation.";
  } catch (e) {
    $("status").textContent = "Invalid input: " + e.message;
  }
}
opts(
  "control",
  controls.map((c, i) => [i, c.title]),
);
$("control").onchange = () => {
  const c = controls[Number($("control").value)];
  $("input").value = JSON.stringify(c.input, null, 2);
  $("why").textContent = c.why;
  run();
};
$("input").oninput = () => {
  clear();
  $("status").textContent = "Input changed. Analyze to replace stale evidence.";
};
$("run").onclick = run;
$("region").onchange = showRegion;
$("start").onchange = showRegion;
$("formula").onchange = showFormula;
$("open-region").onclick = () => {
  const f = window.currentFairReport.subformulas[Number($("formula").value)];
  if (f.region_mask !== null) {
    $("region").value = f.region_mask;
    showRegion();
    $("region").focus();
  }
};
$("download").onclick = () => {
  if (!window.currentFairReport) return;
  const u = URL.createObjectURL(
      new Blob([JSON.stringify(window.currentFairReport, null, 2) + "\n"], {
        type: "application/json",
      }),
    ),
    a = document.createElement("a");
  a.href = u;
  a.download = "branchlab-fair.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};
limits.forEach((s) => {
  const li = document.createElement("li");
  li.textContent = s;
  $("limits").append(li);
});
$("control").onchange();
