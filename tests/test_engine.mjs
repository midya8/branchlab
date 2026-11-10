import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { analyze, parseJSON, validate } from "../docs/engine.js";
test("full browser engine reports match native on controls, all two-state models and nested random formulas", () => {
  const code = `import json,itertools,random
from branchlab import analyze
from tools.make_controls import controls,model,atom,unary,binary
rs=[c['input']for c in controls()];p=atom('p');q=atom('q');fs=[unary(op,p)for op in ['EX','AX','EF','AF','EG','AG']]+[binary(op,p,q)for op in ['EU','AU']]
for rows in itertools.product([[0],[1],[0,1]],repeat=2):
 for masks in itertools.product(range(4),repeat=2):rs.append(model(rows,[[a for k,a in enumerate(['p','q'])if m>>k&1]for m in masks],fs))
rng=random.Random(487)
def f(d):
 if d==0:return atom(rng.choice(['p','q']))
 op=rng.choice(['not','and','or','EX','AX','EF','AF','EG','AG','EU','AU'])
 return binary(op,f(d-1),f(d-1))if op in {'and','or','EU','AU'}else unary(op,f(d-1))
for _ in range(120):
 n=rng.randrange(1,7);rows=[sorted(set([rng.randrange(n)]+[j for j in range(n)if rng.random()<.4]))for i in range(n)];rs.append(model(rows,[[a for a in ['p','q']if rng.random()<.5]for _ in range(n)],[f(3)for _ in range(4)]))
print(json.dumps([{'input':r,'report':analyze(r)}for r in rs]))`;
  const records = JSON.parse(
    execFileSync(process.env.PYTHON || "python", ["-c", code], {
      maxBuffer: 128 * 1024 * 1024,
    }),
  );
  let subformulas = 0,
    rounds = 0,
    atlas = 0;
  for (const x of records) {
    const before = JSON.stringify(x.input);
    assert.deepEqual(analyze(x.input), x.report);
    assert.equal(JSON.stringify(x.input), before);
    subformulas += x.report.subformulas.length;
    for (const n of x.report.subformulas) {
      rounds += n.rounds.length;
      atlas += n.subset_atlas.length;
    }
  }
  console.log(
    JSON.stringify({
      reports: records.length,
      subformulas,
      rounds,
      subset_atlas_rows: atlas,
    }),
  );
});
test("strict parser rejects duplicate, malformed, oversized and noninteger JSON; no arbitrary text eval", () => {
  for (const s of [
    "NaN",
    "Infinity",
    '{"a":1,"a":2}',
    '{"a":NaN}',
    "{}\u00a0",
    " ".repeat(65537),
    "[1,]",
    '{"a":1,}',
    '{"a":1.5}',
  ])
    assert.throws(() => parseJSON(s));
  assert.equal(parseJSON('{"__proto__":1}').__proto__, 1);
});
test("schema rejects deadlock, unknown nodes, malformed AST and bool coercion", () => {
  const c = JSON.parse(fs.readFileSync("docs/controls.json"))[0].input;
  for (const r of [
    {},
    null,
    [],
    { ...c, formulas: [{ op: "bool", value: 1 }] },
    { ...c, formulas: [{ op: "AX" }] },
    { ...c, extra: 1 },
    { ...c, states: [{ name: "x", labels: [], next: [] }] },
  ])
    assert.throws(() => validate(r));
});
