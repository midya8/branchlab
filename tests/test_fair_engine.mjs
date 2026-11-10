import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { analyzeFair, validateFair } from "../docs/fair-engine.js";
import { parseJSON } from "../docs/engine.js";
test("complete fair native/recurrent-subset/browser evidence", () => {
  const xs = JSON.parse(
    execFileSync(
      process.env.PYTHON || "python",
      [
        "-c",
        "import json;from tools.fair_cases import controls,exhaustive,seeded;from branchlab.fair import analyze_fair;from branchlab.fair_verify import verify_fair;xs=list(exhaustive())+seeded()+[c['input']for c in controls()];rs=[{'input':x,'report':analyze_fair(x)}for x in xs];assert all(verify_fair(x['report'])for x in rs);print(json.dumps(rs))",
      ],
      { maxBuffer: 64e6 },
    ),
  );
  let regions = 0,
    nodes = 0,
    witnesses = 0;
  for (const x of xs) {
    assert.deepEqual(analyzeFair(x.input), x.report);
    regions += x.report.region_atlas.length;
    nodes += x.report.subformulas.length;
    witnesses += x.report.region_atlas.reduce(
      (s, t) => s + t.witnesses.filter(Boolean).length,
      0,
    );
  }
  console.log(
    JSON.stringify({
      reports: xs.length,
      regions,
      subformulas: nodes,
      fair_lassos: witnesses,
    }),
  );
});
test("strict fairness contract and no mutation", () => {
  const x = JSON.parse(fs.readFileSync("docs/fair-controls.json"))[0].input,
    b = structuredClone(x);
  analyzeFair(x);
  assert.deepEqual(x, b);
  for (const j of ["x", [["missing"]], [["s0", "s0"]], [[], [], [], [], []]])
    assert.throws(() => validateFair({ ...x, justice: j }));
  for (const raw of [
    '{"model":{},"model":{},"justice":[]}',
    '{"model":NaN,"justice":[]}',
    '{"model":{},"justice":[],"x":1.0}',
  ])
    assert.throws(() => analyzeFair(parseJSON(raw)));
});
