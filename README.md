# BranchLab

**Always possible is not inevitable.** A finite CTL workbench for inspecting branching-time claims, not just watching a convincing trace.

The default model has a waiting state that can loop or move to a goal. `AG EF p` holds at both states: a goal remains reachable everywhere. `AF p` fails at the waiting state: an infinite wait is still a valid path. No unstated fairness assumption erases it.

- [Live workbench](https://midya8.github.io/branchlab/)
- [Method, source notes and proof limits](METHOD.md)
- [Editable default model](examples/always-possible.json)

## What it computes

A supplied total Kripke structure with 1..6 states, up to four atomic propositions and up to eight formula roots. JSON AST supports `bool`, `atom`, `not`, `and`, `or`, `EX`, `AX`, `EF`, `AF`, `EG`, `AG`, `EU`, `AU`. Until is strong and includes time zero. Every state is checked, not only a designated initial state. No fairness, probability, action or controller is implied.

For every unique subformula, the certificate records the complete truth and false sets. Temporal fixed-point formulas include synchronous rounds, every state's predecessor checks, and the image of every one of the `2^n` subsets. Arbitrary fixed points are not accepted as least or greatest ones. Boolean/next operators have local all-state checks. Canonical finite prefixes or lassos are shown only for path-shaped existential witnesses or universal counterexamples. Other claims are explicitly labelled branching certificates, never “proved by one trace.”

Twelve original controls expose different branches for conjuncts, quantifier nesting, time-zero until, closed-loop strong-until failure, finite bad prefixes, universal finite ranks, and the six-state transition-count boundary. Editing is local to the browser. No paid API, network inference or model weights.

## Reproduce

Python3.10+ with no runtime dependencies:

```sh
python -m pip install .
branchlab examples/always-possible.json --output certificate.json
branchlab certificate.json --verify
python -m branchlab - < examples/always-possible.json
python -m unittest discover -s tests -v
bash tools/check_wheel.sh
```

The verifier imports neither the generator nor its iteration. It computes truth via the intersection/union of all fixed points, reconstructs every reported field with bitmask set operations, and independently enumerates vertex-simple prefixes and first-repeat lassos. It rejects additions, omissions, altered values and bool/int substitutions throughout the report. Installed-wheel checks run outside the checkout, assert all imported origins are site-packages, and test both CLI entry points and forged certificates.

Browser and reference checks:

```sh
node --test tests/test_engine.mjs tests/test_browser.cjs
python -m pip install -r requirements-reference.txt
python tools/check_reference.py
python -m http.server --directory docs 8000
```

Node22+ and Chrome are needed for the actual-browser test. `CHROME_BIN`, `PYTHON`, `BRANCHLAB_URL`, `SCREENSHOT_DIR` and `VERIFY_DOWNLOADS=1` select the executable, remote deployment, screenshot destination and native replay of genuine downloads. Optional pyModelChecking1.3.4 is an installed GPL-2.0-or-later test reference, not copied, bundled or needed at runtime. Native tests also compare all2744 three-state graph/label cases against direct finite-prefix/lasso semantics. See the method for exact coverage and limitations.

## Scope

Classical CTL theory, original bounded implementation and evidence UI. This is an explicit teaching/reasoning tool, not a symbolic industrial model checker, LTL/CTL* implementation, proof of an inferred system model, verified AI agent, new theory or scaling result. The browser parser and Chrome test plumbing adapt the author's prior AbsorbLab work; CTL algorithms, independent checker and thought experiments are project-specific.
