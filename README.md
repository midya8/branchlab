# BranchLab

**Always possible is not inevitable.** A finite CTL workbench for inspecting branching-time claims, not just watching a convincing trace.

The default model has a waiting state that can loop or move to a goal. `AG EF p` holds at both states: a goal remains reachable everywhere. `AF p` fails at the waiting state: an infinite wait is still a valid path. No unstated fairness assumption erases it.

- [Live workbench](https://midya8.github.io/branchlab/)
- [Method, source notes and proof limits](METHOD.md)
- [Editable default model](examples/always-possible.json)

## New in 0.2: explicit justice, explicit vacuity

The separate [fair-path inspector](https://midya8.github.io/branchlab/fair.html) adds zero to four state-justice sets. A fair infinite path must meet each set infinitely often on the same execution. The original ordinary-CTL page and schema are unchanged. Local atoms stay local; universal temporal claims at a state with no fair continuation are visibly labeled vacuous.

The default repeated-hub walk `s0 → s1 → s0 → s2 → s0` meets two justice sets that no first-repeat simple cycle can cover. A trap retains its p label but admits no fair path. All induced state regions, component justice intersections, backward rounds, canonical prefix/closed-walk witnesses and ordinary-versus-fair subformula truth sets are inspectable. Fair EG restricts to the operand first; ordinary EG intersected with globally fair states is not enough.

```sh
branchlab-fair examples/fairness.json --output /tmp/fair.json
branchlab-fair /tmp/fair.json --verify
# Equivalently: python -m branchlab.fair_cli ...
python tools/check_fair_networkx.py  # optional NetworkX3.4.2 graph reference
```

All29Python tests retain15ordinary tests and add14fairness tests; all7Node tests retain prior engine/browser checks. The new native, independent recurrent-subset/closure checker and separately written two-pass-component browser agree on278complete reports,2808regions,4135subformulas and2643fair lassos. All519noninput primitive leaves of one full certificate are separately changed and rejected. The genuinely invoked optional NetworkX3.4.2 reference checks278requests/2808regions/4632components/2643lassos; it is a graph reference, not an external full fair-CTL solver. Existing pyModelChecking1.3.4 ordinary tests remain; three actual installed counterexamples exclude its fairness path as a new oracle rather than faking agreement.

Actual Chrome fairness checks36reports at1280/390/320,216regions,612start-region selections,465subformula selections,390walk rows,2628graph edges and12trusted completed downloads replayed natively. Set `FAIR_SCREEN_DIR` for screenshots or `BRANCHLAB_FAIR_URL` to target deployment. Fresh installed wheels add nine module-origin checks,12fair controls/both entrypoints,24forged CLI rejections with atomic output preservation and24directcheckerforgeries while retaining the ordinary installed workflow. [FAIRNESS.md](FAIRNESS.md) states the exact convention, source conflicts, derivation and limits.

## What the original inspector computes

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
npm test
python -m pip install -r requirements-reference.txt
python tools/check_reference.py
python -m http.server --directory docs 8000
```

Node22+ and Chrome are needed for the actual-browser test. `CHROME_BIN`, `PYTHON`, `BRANCHLAB_URL`, `SCREENSHOT_DIR` and `VERIFY_DOWNLOADS=1` select the executable, remote deployment, screenshot destination and native replay of genuine downloads. Optional pyModelChecking1.3.4 is an installed GPL-2.0-or-later test reference, not copied, bundled or needed at runtime. Native tests also compare all2744 three-state graph/label cases against direct finite-prefix/lasso semantics. See the method for exact coverage and limitations.

## Scope

Classical CTL theory, original bounded implementation and evidence UI. This is an explicit teaching/reasoning tool, not a symbolic industrial model checker, LTL/CTL* implementation, proof of an inferred system model, verified AI agent, new theory or scaling result. The browser parser and Chrome test plumbing adapt the author's prior AbsorbLab work; CTL algorithms, independent checker and thought experiments are project-specific.
