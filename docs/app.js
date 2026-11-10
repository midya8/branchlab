import { analyze, parseJSON } from "./engine.js";
const $ = (id) => document.getElementById(id),
  el = (tag, text, cls) => {
    const x = document.createElement(tag);
    if (text !== undefined) x.textContent = text;
    if (cls) x.className = cls;
    return x;
  };
const set = (xs) => "{" + xs.join(", ") + "}",
  yes = (x) => (x ? "true" : "false");
export function format(f) {
  const op = f.op;
  if (op === "atom") return f.name;
  if (op === "bool") return String(f.value);
  if (op === "not") return "¬(" + format(f.arg) + ")";
  if (["and", "or"].includes(op))
    return (
      "(" +
      format(f.left) +
      (op === "and" ? " ∧ " : " ∨ ") +
      format(f.right) +
      ")"
    );
  if (["EU", "AU"].includes(op))
    return op[0] + "[" + format(f.left) + " U " + format(f.right) + "]";
  return op + " (" + format(f.arg) + ")";
}
function table(headers, rows) {
  const t = el("table"),
    h = el("tr");
  for (const k of headers) h.append(el("th", k));
  const head = el("thead");
  head.append(h);
  t.append(head);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    for (const v of row) tr.append(el("td", String(v)));
    body.append(tr);
  }
  t.append(body);
  return t;
}
function options(id, items) {
  $(id).replaceChildren(
    ...items.map(([value, label]) => {
      const o = el("option", label);
      o.value = value;
      return o;
    }),
  );
}
function graph(r) {
  const ss = r.input.states,
    n = ss.length,
    ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 550 180");
  svg.setAttribute("role", "img");
  const title = document.createElementNS(ns, "title");
  title.textContent = "Supplied states, labels, transitions and self-loops";
  svg.append(title);
  function shape(tag, attrs) {
    const x = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
    svg.append(x);
    return x;
  }
  const xy = ss.map((s, i) => [
    55 + (i * 440) / Math.max(1, n - 1),
    n > 3 ? (i % 2 ? 113 : 67) : 94,
  ]);
  for (let i = 0; i < n; i++)
    for (const name of ss[i].next) {
      const j = ss.findIndex((s) => s.name === name),
        [x, y] = xy[i],
        [xx, yy] = xy[j];
      if (i === j)
        shape("path", {
          d: `M ${x - 12} ${y - 24} C ${x - 47} ${y - 70}, ${x + 47} ${y - 70}, ${x + 12} ${y - 24}`,
          fill: "none",
          stroke: "#8fd9e0",
          "stroke-width": 1.2,
        });
      else {
        const direction = j > i ? 1 : -1,
          curve = Math.abs(j - i) > 1 ? (j > i ? 25 : -25) : 0;
        shape("path", {
          d: `M ${x + direction * 25} ${y} Q ${(x + xx) / 2} ${(y + yy) / 2 + curve} ${xx - direction * 27} ${yy}`,
          fill: "none",
          stroke: "#71868e",
          "stroke-width": 1.2,
        });
        shape("path", {
          d: `M ${xx - direction * 32} ${yy - 4} L ${xx - direction * 26} ${yy} L ${xx - direction * 32} ${yy + 4}`,
          fill: "none",
          stroke: "#8fd9e0",
        });
      }
    }
  for (let i = 0; i < n; i++) {
    const [x, y] = xy[i];
    shape("circle", {
      cx: x,
      cy: y,
      r: 24,
      fill: "#172126",
      stroke: "#c9f178",
      "stroke-width": 1.5,
    });
    const text = shape("text", {
      x,
      y: y + 4,
      "text-anchor": "middle",
      fill: "#edf3ee",
      "font-size": 12,
      "font-family": "monospace",
    });
    text.textContent = ss[i].name;
    const lab = shape("text", {
      x,
      y: y + 42,
      "text-anchor": "middle",
      fill: "#c9f178",
      "font-size": 10,
      "font-family": "monospace",
    });
    lab.textContent = set(ss[i].labels);
  }
  $("graph").replaceChildren(svg);
}
function showExample() {
  const r = window.branchReport,
    node = r.subformulas[Number($("subformula").value)],
    ex = node.examples[Number($("state").value)];
  const box = $("example");
  box.replaceChildren(
    el(
      "span",
      (ex.holds ? "HOLDS" : "DOES NOT HOLD") + " AT " + ex.start,
      "badge",
    ),
  );
  if (ex.kind === "branching_certificate") {
    box.append(
      el(
        "p",
        "No single trace is offered as a proof. Read the child truth sets, all-state checks and fixed-point extrema below.",
        "muted small",
      ),
    );
  } else {
    box.append(el("p", ex.nodes.join(" → "), "path"));
    box.append(
      el(
        "p",
        ex.kind === "lasso"
          ? "The final node repeats node " +
              ex.cycle_start +
              ". Repeat this cycle forever."
          : "This finite prefix witnesses this particular existential claim or universal counterexample.",
        "muted small",
      ),
    );
  }
  box.dataset.kind = ex.kind;
}
function showRound() {
  const node = window.branchReport.subformulas[Number($("subformula").value)],
    box = $("round-summary"),
    checks = $("round-checks");
  box.replaceChildren();
  checks.replaceChildren();
  if (!node.rounds.length) {
    box.append(
      el(
        "p",
        "Boolean, label or next-state rule. No fixed-point iteration is needed.",
        "muted small",
      ),
    );
    return;
  }
  const x = node.rounds[Number($("round").value)];
  box.append(el("p", set(x.before) + " → " + set(x.after), "set"));
  box.append(
    el(
      "p",
      "Added " + set(x.added) + " · Removed " + set(x.removed),
      "small muted",
    ),
  );
  box.append(
    el(
      "p",
      x.before.join("|") === x.after.join("|")
        ? "Stable. The selected least/greatest iteration has reached its extremum."
        : "Synchronous update: every predecessor check reads the same “before” set.",
      "small muted",
    ),
  );
  checks.append(
    table(
      [
        "State",
        "Left",
        "Right",
        "Successors",
        "In before",
        "Pre rule",
        "Pre holds",
        "Admitted",
      ],
      x.checks.map((c) => [
        c.state,
        yes(c.left_holds),
        c.right_holds === null ? "n/a" : yes(c.right_holds),
        set(c.successors),
        c.successor_in_before.map(yes).join(", "),
        c.operator,
        yes(c.predecessor_test),
        yes(c.admitted),
      ]),
    ),
  );
}
function showSub() {
  const r = window.branchReport,
    node = r.subformulas[Number($("subformula").value)];
  $("sub-summary").replaceChildren(
    el("p", "Truth " + set(node.truth) + " · False " + set(node.false), "set"),
    el(
      "span",
      node.fixed_point
        ? node.fixed_point.toUpperCase() + " FIXED POINT"
        : "LOCAL STATE RULE",
      "badge",
    ),
  );
  options(
    "state",
    r.input.states.map((s, i) => [i, s.name]),
  );
  options(
    "round",
    node.rounds.map((x, i) => [
      i,
      "Round " + i + ": " + set(x.before) + " → " + set(x.after),
    ]),
  );
  $("round").disabled = !node.rounds.length;
  $("state-checks").replaceChildren(
    table(
      ["State", "Holds", "Children hold", "Next-state child obligations"],
      node.state_checks.map((c) => [
        c.state,
        yes(c.holds),
        c.children_hold.map(yes).join(", ") || "none",
        c.successors.map((s) => s.to + ":" + yes(s.child_holds)).join(", ") ||
          "see fixed-point / Boolean rule",
      ]),
    ),
  );
  $("atlas").replaceChildren();
  $("atlas-detail").hidden = !node.subset_atlas.length;
  if (node.subset_atlas.length)
    $("atlas").append(
      table(
        [
          "Mask",
          "Candidate Z",
          "Image F(Z)",
          "Fixed",
          "Pre-fixed",
          "Post-fixed",
        ],
        node.subset_atlas.map((a) => [
          a.mask,
          set(a.candidate),
          set(a.image),
          yes(a.fixed),
          yes(a.pre_fixed),
          yes(a.post_fixed),
        ]),
      ),
    );
  showExample();
  showRound();
}
function run() {
  try {
    const r = analyze(parseJSON($("input").value));
    window.branchReport = r;
    window.branchError = null;
    $("status").className = "";
    $("status").textContent =
      "Checked " +
      r.input.states.length +
      " states · " +
      r.subformulas.length +
      " unique subformulas · complete finite truth sets";
    $("download").disabled = false;
    $("results").replaceChildren(
      ...r.results.map((x) => {
        const node = r.subformulas[x.formula_id],
          card = el("article", undefined, "result");
        card.append(
          el("code", format(node.formula)),
          el("div", "Holds: " + set(x.truth), "truth"),
          el("div", "False: " + set(x.false), "false"),
        );
        return card;
      }),
    );
    options(
      "subformula",
      r.subformulas.map((x) => [x.id, "#" + x.id + " " + format(x.formula)]),
    );
    $("subformula").value = r.roots[0];
    graph(r);
    $("model-table").replaceChildren(
      table(
        ["State", "Labels", "Successors"],
        r.input.states.map((s) => [s.name, set(s.labels), set(s.next)]),
      ),
    );
    $("limits").replaceChildren(...r.limits.map((x) => el("li", x)));
    showSub();
  } catch (e) {
    window.branchReport = null;
    window.branchError = e.message;
    $("status").textContent = "Rejected: " + e.message;
    $("status").className = "error";
    $("download").disabled = true;
    for (const id of [
      "results",
      "graph",
      "model-table",
      "sub-summary",
      "example",
      "round-summary",
      "round-checks",
      "state-checks",
      "atlas",
    ])
      $(id).replaceChildren();
    for (const id of ["subformula", "state", "round"]) options(id, []);
    $("atlas-detail").hidden = true;
  }
}
const controls = await (await fetch("controls.json")).json();
window.branchControls = controls;
options(
  "control",
  controls.map((x, i) => [i, x.title]),
);
function choose() {
  const c = controls[Number($("control").value)];
  $("input").value = JSON.stringify(c.input, null, 2);
  $("why").textContent = c.why;
  run();
}
$("control").addEventListener("change", choose);
$("run").addEventListener("click", run);
$("subformula").addEventListener("change", showSub);
$("state").addEventListener("change", showExample);
$("round").addEventListener("change", showRound);
$("download").addEventListener("click", () => {
  if (!window.branchReport) return;
  const blob = new Blob([JSON.stringify(window.branchReport, null, 2) + "\n"], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = el("a");
  a.href = url;
  a.download = "branchlab-certificate.json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});
choose();
