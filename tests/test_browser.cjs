"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawn, execFileSync } = require("node:child_process"),
  { waitForDebugger } = require("./chrome_support.cjs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function stop(browser) {
  try {
    process.kill(-browser.pid, "SIGTERM");
  } catch {}
  if (browser.exitCode === null)
    await Promise.race([
      new Promise((r) => browser.once("exit", r)),
      delay(3000),
    ]);
  try {
    process.kill(-browser.pid, "SIGKILL");
  } catch {}
}
test(
  "actual Chrome every CTL subformula, state, round and atlas plus trusted certificate downloads",
  { timeout: 180000 },
  async () => {
    const server = require("node:http").createServer((req, res) => {
      try {
        const file = path.join(
          __dirname,
          "../docs",
          req.url === "/" ? "index.html" : req.url,
        );
        res.setHeader(
          "Content-Type",
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
          }[path.extname(file)] || "text/plain",
        );
        res.end(fs.readFileSync(file));
      } catch {
        res.statusCode = 404;
        res.end("not found");
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "branchlab-")),
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
      startupError,
      diagnostics = "";
    browser.on("error", (e) => (startupError = e));
    browser.stderr.on(
      "data",
      (d) => (diagnostics = (diagnostics + d).slice(-4000)),
    );
    try {
      for (
        let i = 0;
        i < 1200 &&
        !startupError &&
        browser.exitCode === null &&
        !fs.existsSync(path.join(profile, "DevToolsActivePort"));
        i++
      )
        await delay(25);
      assert.ok(
        fs.existsSync(path.join(profile, "DevToolsActivePort")),
        startupError?.message || diagnostics,
      );
      const port = fs
          .readFileSync(path.join(profile, "DevToolsActivePort"), "utf8")
          .split("\n")[0],
        tab = await waitForDebugger(`http://127.0.0.1:${port}/json/list`, {
          alive: () => browser.exitCode === null && !startupError,
        });
      ws = new WebSocket(tab.webSocketDebuggerUrl);
      await new Promise((r, j) => {
        ws.onopen = r;
        ws.onerror = j;
      });
      let seq = 0;
      const pending = new Map(),
        errors = [],
        downloads = new Map();
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === "Browser.downloadWillBegin")
          downloads.set(m.params.guid, { ...m.params, state: "started" });
        if (
          m.method === "Browser.downloadProgress" &&
          downloads.has(m.params.guid)
        )
          Object.assign(downloads.get(m.params.guid), m.params);
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
          process.env.BRANCHLAB_URL ||
          `http://127.0.0.1:${server.address().port}/`,
      });
      for (
        let i = 0;
        i < 500 && !(await js("Boolean(window.branchReport)"));
        i++
      )
        await delay(20);
      assert.ok(await js("window.branchReport"));
      const controls = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../docs/controls.json"),
            "utf8",
          ),
        ),
        reports = JSON.parse(
          execFileSync(
            process.env.PYTHON || "python",
            [
              "-c",
              'import json;from branchlab import analyze;print(json.dumps([analyze(c["input"])for c in json.load(open("docs/controls.json"))]))',
            ],
            { maxBuffer: 128 * 1024 * 1024 },
          ),
        );

      const set = (id, value, event = "change") =>
        js(
          `document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)}))`,
        );
      const text = (id) =>
        js(`document.getElementById(${JSON.stringify(id)}).textContent`);
      const rows = (id) =>
        js(
          `Array.from(document.querySelectorAll('#'+${JSON.stringify(id)}+' tbody tr'),tr=>Array.from(tr.children,td=>td.textContent))`,
        );
      const listed = (x) => "{" + x.join(", ") + "}",
        str = (x) => (x ? "true" : "false");
      async function shot(name) {
        if (!process.env.SCREENSHOT_DIR) return;
        await js(
          'document.activeElement.blur();window.scrollTo(0,0);document.querySelectorAll("textarea").forEach(e=>e.scrollTop=0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',
        );
        const m = await call("Page.getLayoutMetrics");
        const image = await call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
          clip: {
            x: 0,
            y: 0,
            width: await js("innerWidth"),
            height: m.cssContentSize.height,
            scale: 1,
          },
        });
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
        fs.writeFileSync(
          path.join(process.env.SCREENSHOT_DIR, name + ".png"),
          Buffer.from(image.data, "base64"),
        );
      }
      const counts = {
        reports: 0,
        subformulas: 0,
        stateSelections: 0,
        rounds: 0,
        atlasRows: 0,
        downloads: 0,
      };
      for (const width of [1280, 390, 320]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: false,
        });
        for (let ci = 0; ci < controls.length; ci++) {
          await set("control", ci);
          const r = reports[ci];
          assert.deepEqual(await js("window.branchReport"), r);
          assert.equal(await text("why"), controls[ci].why);
          counts.reports++;
          assert.deepEqual(
            await rows("model-table"),
            r.input.states.map((s) => [
              s.name,
              listed(s.labels),
              listed(s.next),
            ]),
          );
          assert.deepEqual(
            await js(
              'Array.from(document.querySelectorAll("#limits li"),e=>e.textContent)',
            ),
            r.limits,
          );
          for (const node of r.subformulas) {
            await set("subformula", node.id);
            counts.subformulas++;
            assert.match(await text("sub-summary"), new RegExp("Truth"));
            assert.deepEqual(
              await rows("state-checks"),
              node.state_checks.map((c) => [
                c.state,
                str(c.holds),
                c.children_hold.map(str).join(", ") || "none",
                c.successors
                  .map((s) => s.to + ":" + str(s.child_holds))
                  .join(", ") || "see fixed-point / Boolean rule",
              ]),
            );
            assert.deepEqual(
              await rows("atlas"),
              node.subset_atlas.map((a) => [
                String(a.mask),
                listed(a.candidate),
                listed(a.image),
                str(a.fixed),
                str(a.pre_fixed),
                str(a.post_fixed),
              ]),
            );
            counts.atlasRows += node.subset_atlas.length;
            assert.equal(
              await js('document.getElementById("atlas-detail").hidden'),
              !node.subset_atlas.length,
            );
            for (let i = 0; i < r.input.states.length; i++) {
              await set("state", i);
              const ex = node.examples[i];
              assert.equal(
                await js('document.getElementById("example").dataset.kind'),
                ex.kind,
              );
              if (ex.nodes)
                assert.ok(
                  (await text("example")).includes(ex.nodes.join(" → ")),
                );
              else assert.match(await text("example"), /No single trace/);
              counts.stateSelections++;
            }
            assert.equal(
              await js('document.getElementById("round").disabled'),
              !node.rounds.length,
            );
            for (const round of node.rounds) {
              await set("round", round.index);
              assert.ok(
                (await text("round-summary")).includes(
                  listed(round.before) + " → " + listed(round.after),
                ),
              );
              assert.deepEqual(
                await rows("round-checks"),
                round.checks.map((c) => [
                  c.state,
                  str(c.left_holds),
                  c.right_holds === null ? "n/a" : str(c.right_holds),
                  listed(c.successors),
                  c.successor_in_before.map(str).join(", "),
                  c.operator,
                  str(c.predecessor_test),
                  str(c.admitted),
                ]),
              );
              counts.rounds++;
            }
            assert.equal(
              await js("document.documentElement.scrollWidth>innerWidth"),
              false,
            );
          }
          await set("subformula", r.roots[0]);
          await shot(`control-${ci}-${width}`);
          if ([0, 2, 6, 7, 10].includes(ci)) {
            await set("subformula", ci === 0 ? r.roots[1] : r.roots[0]);
            await set("round", 0);
            await js('document.getElementById("atlas-detail").open=true');
            await shot(`detail-${ci}-${width}`);
            await js('document.getElementById("atlas-detail").open=false');
          }
          if (width === 1280) {
            const dir = path.join(profile, "exports");
            fs.mkdirSync(dir, { recursive: true });
            await call("Browser.setDownloadBehavior", {
              behavior: "allowAndName",
              downloadPath: dir,
              eventsEnabled: true,
            });
            const previous = new Set(downloads.keys());
            await js(
              'document.getElementById("download").scrollIntoView({block:"center"})',
            );
            const b = await js(
              '(()=>{const r=document.getElementById("download").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()',
            );
            for (const type of ["mousePressed", "mouseReleased"])
              await call("Input.dispatchMouseEvent", {
                type,
                ...b,
                button: "left",
                clickCount: 1,
              });
            let item;
            for (let k = 0; k < 800; k++) {
              item = Array.from(downloads.values()).find(
                (d) => !previous.has(d.guid),
              );
              if (item?.state === "completed" || item?.state === "canceled")
                break;
              await delay(25);
            }
            assert.ok(item);
            assert.equal(item.state, "completed");
            assert.equal(item.suggestedFilename, "branchlab-certificate.json");
            const file = path.join(dir, item.guid);
            assert.deepEqual(JSON.parse(fs.readFileSync(file)), r);
            if (process.env.VERIFY_DOWNLOADS === "1")
              execFileSync(process.env.PYTHON || "python", [
                "-m",
                "branchlab",
                file,
                "--verify",
              ]);
            fs.unlinkSync(file);
            counts.downloads++;
          }
        }
      }
      await set("control", 0);
      const edited = structuredClone(controls[0].input);
      edited.states[0].next = ["s1"];
      await set("input", JSON.stringify(edited), "input");
      await js('document.getElementById("run").click()');
      assert.deepEqual((await js("window.branchReport")).results[1].truth, [
        "s0",
        "s1",
      ]);
      await shot("edited-320");
      for (const raw of [
        "{}",
        '{"states":[],"states":[]}',
        "NaN",
        " ".repeat(65537),
      ]) {
        await set("input", raw, "input");
        await js('document.getElementById("run").click()');
        assert.equal(await js("window.branchReport"), null);
        assert.equal(
          await js('document.getElementById("download").disabled'),
          true,
        );
        assert.equal(await text("results"), "");
        assert.match(await text("status"), /^Rejected:/);
      }
      await shot("invalid-320");
      await set("control", 0);
      assert.deepEqual(await js("window.branchReport"), reports[0]);
      await js('document.getElementById("atlas-detail").open=true');
      await shot("expanded-320");
      assert.deepEqual(errors, []);
      console.log(JSON.stringify(counts));
    } finally {
      ws?.close();
      await stop(browser);
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await fs.promises.rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 100,
      });
    }
  },
);
