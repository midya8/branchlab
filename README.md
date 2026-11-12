# BranchLab

Check CTL formulas on a small supplied state graph. Inspect every subformula's
truth set, fixed-point round, predecessor check and subset image. Separate
ordinary and fair-path inspectors make their path assumptions explicit.

The default model has a waiting state that can loop or move to a goal. `AG EF p` holds at both states: a goal remains reachable everywhere. `AF p` fails at the waiting state: an infinite wait is still a valid path. No unstated fairness assumption erases it.

- [Live workbench](https://midya8.github.io/branchlab/)
- [Method, source notes and proof limits](METHOD.md)
- [Editable default model](examples/always-possible.json)

## Fair paths and vacuous claims

The separate [fair-path inspector](https://midya8.github.io/branchlab/fair.html) adds zero to four state-justice sets. A fair infinite path must meet each set infinitely often on the same execution. The original ordinary-CTL page and schema are unchanged. Local atoms stay local; universal temporal claims at a state with no fair continuation are visibly labeled vacuous.

The default repeated-hub walk `s0 → s1 → s0 → s2 → s0` meets two justice sets that no first-repeat simple cycle can cover. A trap retains its p label but admits no fair path. All induced state regions, component justice intersections, backward rounds, canonical prefix/closed-walk witnesses and ordinary-versus-fair subformula truth sets are inspectable. Fair EG restricts to the operand first; ordinary EG intersected with globally fair states is not enough.

```sh
branchlab-fair examples/fairness.json --output /tmp/fair.json
branchlab-fair /tmp/fair.json --verify
# Equivalently: python -m branchlab.fair_cli ...
python tools/check_fair_networkx.py  # optional NetworkX 3.4.2 graph reference
```

All 29 Python tests retain 15 ordinary tests and add 14 fairness tests; all 7 Node tests retain prior engine/browser checks. The new native, independent recurrent-subset/closure checker and separately written two-pass-component browser agree on 278 complete reports, 2,808 regions, 4,135 subformulas and 2,643 fair lassos. All 519 non-input primitive leaves of one full certificate are separately changed and rejected. The optional NetworkX 3.4.2 graph comparison covers 278 requests / 2,808 regions / 4,632 components / 2,643 lassos; it is a graph reference, not an external full fair-CTL solver. The pyModelChecking 1.3.4 ordinary-CTL comparison remains separate. Three pinned-version counterexamples in FAIRNESS.md explain why its fairness path is not used as an oracle.

Actual Chrome fairness checks 36 reports at 1280/390/320, 216 regions, 612 start-region selections, 465 subformula selections, 390 walk rows, 2,628 graph edges and 12 trusted completed downloads replayed natively. Set `FAIR_SCREEN_DIR` for screenshots or `BRANCHLAB_FAIR_URL` to target deployment. Fresh installed wheels add nine module-origin checks, 12 fair controls/both entrypoints, 24 forged CLI rejections with atomic output preservation and 24 direct checker forgeries while retaining the ordinary installed workflow. [FAIRNESS.md](FAIRNESS.md) states the exact convention, source conflicts, derivation and limits.

## Ordinary CTL

A supplied total Kripke structure with 1..6 states, up to four atomic propositions and up to eight formula roots. JSON AST supports `bool`, `atom`, `not`, `and`, `or`, `EX`, `AX`, `EF`, `AF`, `EG`, `AG`, `EU`, `AU`. Until is strong and includes time zero. Every state is checked, not only a designated initial state. No fairness, probability, action or controller is implied.

For every unique subformula, the certificate records the complete truth and false sets. Temporal fixed-point formulas include synchronous rounds, every state's predecessor checks, and the image of every one of the `2^n` subsets. Arbitrary fixed points are not accepted as least or greatest ones. Boolean/next operators have local all-state checks. Canonical finite prefixes or lassos are shown only for path-shaped existential witnesses or universal counterexamples. Other claims are explicitly labelled branching certificates, not a proof from one trace.

Twelve original controls expose different branches for conjuncts, quantifier nesting, time-zero until, closed-loop strong-until failure, finite bad prefixes, universal finite ranks, and the six-state transition-count boundary. Editing is local to the browser. No paid API, network inference or model weights.

## Choose the path convention

The original schema and page use ordinary CTL on a total graph. The separate
fair schema supplies zero to four justice sets; its temporal quantifiers range
over fair continuations. Atoms remain local, and a universal claim with no fair
continuation is marked vacuous. Neither mode infers fairness from a trace.

The current suite has 29 Python tests and seven Node/actual-Chrome tests,
retaining the original ordinary-CTL checks. Optional external references below
are separate from the runtime and are not full proofs of the implementation.

## Reproduce

Python 3.10+ with no runtime dependencies:

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

Node 22+ and Chrome are needed for the actual-browser test. `CHROME_BIN`, `PYTHON`, `BRANCHLAB_URL`, `SCREENSHOT_DIR` and `VERIFY_DOWNLOADS=1` select the executable, remote deployment, screenshot destination and native replay of genuine downloads. Optional pyModelChecking 1.3.4 is an installed GPL-2.0-or-later test reference, not copied, bundled or needed at runtime. Native tests also compare all 2,744 three-state graph/label cases against direct finite-prefix/lasso semantics. See the method for exact coverage and limitations.

## Scope

Classical CTL theory, original bounded implementation and evidence UI. This is an explicit teaching/reasoning tool, not a symbolic industrial model checker, LTL/CTL* implementation, proof of an inferred system model, verified AI agent, new theory or scaling result. The browser parser and Chrome test plumbing adapt the author's prior AbsorbLab work; CTL algorithms, independent checker and thought experiments are project-specific.
