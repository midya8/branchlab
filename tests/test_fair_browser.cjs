"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn, execFileSync } = require("node:child_process"),
  {
    waitForDebugger,
    stopChrome,
    waitForDownload,
  } = require("./chrome_support.cjs"),
  delay = (ms) => new Promise((r) => setTimeout(r, ms));
test(
  "actual Chrome fair CTL: regions, subformulas, justice lassos and trusted downloads",
  { timeout: 180000 },
  async () => {
    const server = require("node:http").createServer((req, res) => {
      try {
        const p = path.join(
          __dirname,
          "../docs",
          req.url === "/" ? "fair.html" : req.url.split("?")[0],
        );
        res.setHeader(
          "Content-Type",
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".json": "application/json",
            ".css": "text/css",
          }[path.extname(p)] || "text/plain",
        );
        res.end(fs.readFileSync(p));
      } catch {
        res.statusCode = 404;
        res.end("not found");
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "branchlab-fair-")),
      browser = spawn(
        process.env.CHROME_BIN || "google-chrome",
        [
          "--headless",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-dev-shm-usage",
          "--remote-debugging-port=0",
          `--user-data-dir=${profile}`,
          "about:blank",
        ],
        { detached: true, stdio: ["ignore", "ignore", "pipe"] },
      );
    let ws,
      error,
      diagnostics = "";
    browser.on("error", (e) => (error = e));
    browser.stderr.on(
      "data",
      (d) => (diagnostics = (diagnostics + d).slice(-4000)),
    );
    try {
      for (
        let i = 0;
        i < 1200 &&
        !error &&
        browser.exitCode === null &&
        !fs.existsSync(path.join(profile, "DevToolsActivePort"));
        i++
      )
        await delay(25);
      assert.ok(
        fs.existsSync(path.join(profile, "DevToolsActivePort")),
        error?.message || diagnostics,
      );
      const port = fs
          .readFileSync(path.join(profile, "DevToolsActivePort"), "utf8")
          .split("\n")[0],
        tab = await waitForDebugger(`http://127.0.0.1:${port}/json/list`, {
          alive: () => browser.exitCode === null && !error,
        });
      ws = new WebSocket(tab.webSocketDebuggerUrl);
      await new Promise((r, j) => {
        ws.onopen = r;
        ws.onerror = j;
      });
      let seq = 0;
      const pending = new Map(),
        errors = [];
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === "Runtime.exceptionThrown") errors.push(m.params);
        if (pending.has(m.id)) {
          const { r, j } = pending.get(m.id);
          pending.delete(m.id);
          m.error ? j(Error(JSON.stringify(m.error))) : r(m.result);
        }
      };
      const call = (method, params = {}) =>
          new Promise((r, j) => {
            const id = ++seq;
            pending.set(id, { r, j });
            ws.send(JSON.stringify({ id, method, params }));
          }),
        js = async (expression) => {
          const r = await call("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
          });
          if (r.exceptionDetails)
            throw Error(JSON.stringify(r.exceptionDetails));
          return r.result.value;
        };
      await call("Runtime.enable");
      await call("Page.enable");
      await call("Page.navigate", {
        url:
          process.env.BRANCHLAB_FAIR_URL ||
          `http://127.0.0.1:${server.address().port}/`,
      });
      for (
        let i = 0;
        i < 400 && !(await js("Boolean(window.currentFairReport)"));
        i++
      )
        await delay(25);
      assert.ok(
        await js("Boolean(window.currentFairReport)"),
        await js("document.body.innerText"),
      );
      const controls = JSON.parse(fs.readFileSync("docs/fair-controls.json")),
        expected = JSON.parse(
          execFileSync(
            process.env.PYTHON || "python",
            [
              "-c",
              "import json;from branchlab.fair import analyze_fair;from branchlab.fair_verify import verify_fair;rs=[analyze_fair(c['input'])for c in json.load(open('docs/fair-controls.json'))];assert all(verify_fair(r)for r in rs);print(json.dumps(rs))",
            ],
            { maxBuffer: 64e6 },
          ),
        );
      const set = (id, value, event = "change") =>
          js(
            `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)}))`,
          ),
        rows = (id) =>
          js(
            `Array.from(document.querySelectorAll('#'+${JSON.stringify(id)}+' tbody tr'),r=>Array.from(r.cells,c=>c.textContent))`,
          ),
        cards = (id) =>
          js(
            `Array.from(document.querySelectorAll('#'+${JSON.stringify(id)}+' .card'),c=>[c.querySelector('h3').textContent,c.querySelector('p').textContent])`,
          ),
        record = (id) =>
          js(
            `JSON.parse(document.getElementById(${JSON.stringify(id)}).textContent)`,
          ),
        no = (x) => (x ? "yes" : "no"),
        joined = (x) => x.join(", ") || "none",
        strings = (rs) => rs.map((r) => r.map(String)),
        format = (f) =>
          f.op === "bool"
            ? String(f.value)
            : f.op === "atom"
              ? f.name
              : f.op === "not"
                ? "not (" + format(f.arg) + ")"
                : f.arg
                  ? f.op + " (" + format(f.arg) + ")"
                  : "(" +
                    format(f.left) +
                    ") " +
                    f.op +
                    " (" +
                    format(f.right) +
                    ")";
      async function shot(name) {
        if (!process.env.FAIR_SCREEN_DIR) return;
        await js(
          'document.activeElement.blur();window.scrollTo(0,0);document.querySelectorAll("textarea").forEach(e=>e.scrollTop=0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',
        );
        const m = await call("Page.getLayoutMetrics"),
          im = await call("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: true,
            clip: {
              x: 0,
              y: 0,
              width: m.cssContentSize.width,
              height: m.cssContentSize.height,
              scale: 1,
            },
          });
        fs.mkdirSync(process.env.FAIR_SCREEN_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(process.env.FAIR_SCREEN_DIR, name + ".png"),
          Buffer.from(im.data, "base64"),
        );
      }
      let reports = 0,
        regions = 0,
        starts = 0,
        formulas = 0,
        walkRows = 0,
        downloads = 0,
        graphEdges = 0;
      for (const width of [1280, 390, 320]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        });
        for (let ci = 0; ci < controls.length; ci++) {
          await set("control", ci);
          const r = expected[ci];
          assert.deepEqual(await js("window.currentFairReport"), r);
          assert.deepEqual(await record("report-json"), r);
          assert.deepEqual(
            await rows("root-table"),
            strings(
              r.results.map((x, i) => [
                i,
                format(r.subformulas[x.formula_id].formula),
                joined(x.ordinary_truth),
                joined(x.truth),
                joined(x.changed),
              ]),
            ),
          );
          assert.deepEqual(
            await rows("model-table-fair"),
            strings(
              r.input.model.states.map((s, i) => [
                "s" + i,
                s.name,
                joined(s.labels),
                joined(s.next),
              ]),
            ),
          );
          assert.deepEqual(
            await rows("atom-table-fair"),
            strings(r.input.model.atoms.map((a, i) => ["p" + i, a])),
          );
          assert.deepEqual(
            await rows("justice-table"),
            strings(r.input.justice.map((j, i) => ["J" + i, joined(j)])),
          );
          assert.deepEqual(
            await rows("atlas-table"),
            strings(
              r.region_atlas.map((t) => [
                t.mask,
                joined(t.allowed),
                no(t.recurrent),
                no(t.fair_recurrent),
                joined(t.fair_seed),
                joined(t.truth),
              ]),
            ),
          );
          const ns = r.input.model.states.map((s) => s.name);
          for (const t of r.region_atlas) {
            await set("region", t.mask);
            assert.deepEqual(await record("region-json"), t);
            assert.deepEqual(
              await rows("component-table"),
              strings(
                t.components.map((c) => [
                  joined(c.states),
                  no(c.cyclic),
                  c.justice_hits
                    .map((h, i) => "J" + i + ": " + joined(h))
                    .join("; ") || "no constraints",
                  no(c.fair),
                ]),
              ),
            );
            assert.deepEqual(
              await rows("reach-table"),
              strings(
                t.backward_rounds.map((q, i) => [
                  i,
                  joined(q.before),
                  joined(q.predecessors),
                  joined(q.after),
                ]),
              ),
            );
            assert.deepEqual(await cards("region-summary"), [
              ["Allowed region", joined(t.allowed)],
              ["Fair recurrent seed", joined(t.fair_seed)],
              ["Has a fair continuation inside this region", joined(t.truth)],
              [
                "This whole region as a recurrent set",
                "Recurrent: " +
                  no(t.recurrent) +
                  "\nFair recurrent: " +
                  no(t.fair_recurrent),
              ],
            ]);
            for (let root = 0; root < ns.length; root++) {
              await set("start", root);
              const w = t.witnesses[root];
              const expectedRows = w
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
                : [];
              assert.deepEqual(await rows("walk-table"), strings(expectedRows));
              walkRows += expectedRows.length;
              assert.deepEqual(
                await cards("lasso-summary"),
                w
                  ? [
                      ["Prefix / before repeating", w.prefix.join(" → ")],
                      ["Cycle / repeat forever", w.cycle.join(" → ")],
                      [
                        "Justice occurrence positions",
                        w.justice_positions
                          .map(
                            (v, i) =>
                              "J" + i + ": cycle[" + v + "] = " + w.cycle[v],
                          )
                          .join("\n") || "No justice constraints",
                      ],
                    ]
                  : [
                      [
                        "No fair lasso from this start",
                        "No fair path stays in the selected region. This is not a missing witness.",
                      ],
                    ],
              );
              const pairs = (xs) =>
                  xs?.slice(1).map((v, i) => xs[i] + ">" + v) || [],
                cy = new Set(pairs(w?.cycle)),
                pr = new Set(pairs(w?.prefix)),
                ed = r.input.model.states.flatMap((s, i) =>
                  s.next.map((v) => ({
                    source: i,
                    target: ns.indexOf(v),
                    role: cy.has(s.name + ">" + v)
                      ? "cycle"
                      : pr.has(s.name + ">" + v)
                        ? "prefix"
                        : "edge",
                  })),
                );
              assert.deepEqual(
                await js(
                  'Array.from(document.querySelectorAll("#graph path.edge"),p=>({source:Number(p.dataset.source),target:Number(p.dataset.target),role:p.dataset.role}))',
                ),
                ed,
              );
              assert.deepEqual(
                await js(
                  'Array.from(document.querySelectorAll("#graph g[data-state]"),p=>[Number(p.dataset.state),p.dataset.allowed])',
                ),
                ns.map((s, i) => [i, String(t.allowed.includes(s))]),
              );
              graphEdges += ed.length;
              starts++;
            }
            regions++;
          }
          for (const f of r.subformulas) {
            await set("formula", f.id);
            assert.deepEqual(await record("formula-json"), f);
            assert.deepEqual(
              await rows("state-table"),
              strings(
                f.state_checks.map((c) => [
                  c.state,
                  no(c.holds),
                  no(c.ordinary_holds),
                  c.children_hold.map(no).join(", "),
                  no(c.fair_continuation),
                  no(c.universal_without_fair_path),
                ]),
              ),
            );
            assert.deepEqual(
              await rows("round-table"),
              strings(
                f.rounds.map((q, i) => [
                  i,
                  joined(q.before),
                  joined(q.predecessors),
                  joined(q.after),
                ]),
              ),
            );
            assert.equal(
              await js('document.getElementById("open-region").disabled'),
              f.region_mask === null,
            );
            if (f.region_mask !== null) {
              await js('document.getElementById("open-region").click()');
              assert.equal(
                await js('Number(document.getElementById("region").value)'),
                f.region_mask,
              );
            }
            formulas++;
          }
          await set("region", r.region_atlas.length - 1);
          await set("start", 0);
          await set("formula", r.roots[0]);
          assert.ok(
            await js("document.documentElement.scrollWidth<=innerWidth"),
            "overflow " + ci + " " + width,
          );
          await shot(`control-${ci}-${width}`);
          if (ci === 0) {
            await set("start", 3);
            await shot(`no-fair-${width}`);
            await set("start", 0);
            await set("region", 7);
            await shot(`repeated-hub-${width}`);
            await set("region", r.region_atlas.length - 1);
          }
          if (width === 1280) {
            await call("Page.setDownloadBehavior", {
              behavior: "allow",
              downloadPath: profile,
            });
            await js(
              'document.getElementById("download").scrollIntoView({block:"center"})',
            );
            const rect = await js(
              '(()=>{const r=document.getElementById("download").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()',
            );
            await call("Input.dispatchMouseEvent", {
              type: "mousePressed",
              ...rect,
              button: "left",
              clickCount: 1,
            });
            await call("Input.dispatchMouseEvent", {
              type: "mouseReleased",
              ...rect,
              button: "left",
              clickCount: 1,
            });
            const dest = path.join(profile, "branchlab-fair.json");
            await waitForDownload(
              dest,
              Buffer.byteLength(JSON.stringify(r, null, 2) + "\n"),
            );
            assert.deepEqual(JSON.parse(fs.readFileSync(dest)), r);
            execFileSync(process.env.PYTHON || "python", [
              "-m",
              "branchlab.fair_cli",
              dest,
              "--verify",
            ]);
            fs.unlinkSync(dest);
            downloads++;
          }
          reports++;
        }
      }
      for (const bad of [
        "{}",
        '{"model":{},"model":{},"justice":[]}',
        '{"model":NaN,"justice":[]}',
      ]) {
        await set("input", bad, "input");
        assert.equal(await js("window.currentFairReport"), null);
        assert.equal(
          await js('document.getElementById("results").hidden'),
          true,
        );
        assert.equal(
          await js('document.getElementById("download").disabled'),
          true,
        );
        assert.equal(
          await js('document.getElementById("graph").children.length'),
          0,
        );
        await js('document.getElementById("run").click()');
        assert.match(
          await js('document.getElementById("status").textContent'),
          /^Invalid input:/,
        );
      }
      await shot("invalid");
      await set("control", 0);
      assert.deepEqual(await js("window.currentFairReport"), expected[0]);
      assert.deepEqual(errors, []);
      console.log(
        JSON.stringify({
          reports,
          regions,
          start_region_selections: starts,
          subformula_selections: formulas,
          walk_rows: walkRows,
          graph_edges: graphEdges,
          trusted_downloads: downloads,
          widths: [1280, 390, 320],
        }),
      );
    } finally {
      ws?.close();
      await stopChrome(browser);
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  },
);
