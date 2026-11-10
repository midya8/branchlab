# Fair paths are assumptions, not guarantees

BranchLab0.2 adds a separate state-justice fair-CTL inspector. The original ordinary-CTL schema, CLI and page remain intact. Nothing silently removes an inconvenient execution from that original inspector.

## Exact contract and convention

The extension accepts `{ "model": <ordinary total Kripke request>, "justice": [<state-name set>, ...] }`. The supplied model retains 1..6 states, 0..4 atomic propositions, 1..8 roots, AST depth6, per-root32 nodes and total128 nodes. Every state has at least one successor. Deadlocks are rejected, not silently totalized. There are zero to four justice sets; each contains unique declared state names. Empty justice sets and duplicate constraints are allowed and have their literal mathematical meaning. Normalization uses original state order.

An infinite path is fair iff it visits each supplied justice set infinitely often. With no constraints, every infinite path is fair. One empty constraint admits no fair paths. Justice is prefix-independent: a finite prefix neither satisfies nor invalidates infinitely-often conditions by itself.

We keep ordinary state semantics for atoms, true/false and Boolean connectives. Only temporal path quantifiers restrict to fair infinite paths. Thus a labeled p can be true at a state with no fair continuation, while fair EX true and fair EG true are false there. Universal temporal quantification over an empty collection is true, including AX false and A[false U false]. This is exposed as vacuity, never presented as actual progress. A nested temporal operator restarts quantification at its state.

This convention matches the local-atom fair-CTL equations in Katoen's RWTH2019 lecture14. Some other teaching presentations additionally guard Boolean truth with a fair-state proposition. We do not mix those conventions. The complete record says which convention is used, and controls test it at no-fair states.

## Fair continuations and every induced region

For every subset R of supplied states, retain exactly edges with both endpoints in R. A component is recurrent if it has at least two states, or one state with a self-loop. A recurrent component is fair if it intersects every justice set. Every state in such a component can follow an infinite walk meeting all sets repeatedly. The walk need not be a vertex-simple cycle. Backward reachability inside R gives every root with a fair path staying in R.

The certificate audits all 2^n regions, including the empty region. Each has complete SCC membership, cycle condition, separate justice intersections, fair seeds, synchronous backward rounds, fair-continuation states, whether the whole region itself is recurrent/fair, and a canonical prefix/repeating closed walk or null for every starting state. Every real edge is retained in the UI, with excluded states and edges faded. Graph state and atom indices map to complete supplied names in tables.

Native generation uses Tarjan SCCs and queue-based product-walk search. The independent checker imports neither generator nor Tarjan/search helpers. It computes Boolean transitive closure in each region, enumerates all contained nonempty recurrent subsets and their justice intersections, derives fair roots by reachability to those subsets, reconstructs components by mutual reachability, and checks every reported field. It uses simple-prefix enumeration and a separate heap-ordered product-state search for canonical walk reconstruction. Shared strict parsing/schema and the existing independent ordinary-CTL replay for the ordinary comparison are disclosed. The JavaScript engine uses separately written two-pass forward/reverse component discovery and product-walk search.

A prefix is shortest to any fair recurrent seed, with state-index lexicographic ties. At its entry, a shortest nonempty returning walk that covers every justice set is chosen with the same tie order. Search states pair a vertex with the justice sets seen. Canonical choice is deterministic; it is not a controller policy. Each justice record gives an actual position before the duplicate closing vertex. Repeating this closed walk meets all constraints infinitely often. Null witnesses correspond to absence of a fair path in that induced region.

Why the characterization is enough: on a finite graph, states visited infinitely often by an infinite path form a recurrent strongly connected set with an edge. A fair path's recurrent set hits every justice constraint. Conversely, in a fair recurrent component, concatenate finite internal paths to visit one member of every justice set and return to the entry, then repeat. Prefix reachability handles starting outside the component. Maximal SCCs suffice for the generator, while contained recurrent-set enumeration gives a separate bounded oracle.

## Operator semantics

Let F be the globally fair-continuation states and W all supplied states. E_f G(phi) is the fair-path truth in the subgraph induced by the fair truth set of phi. Restrict first, then find fair recurrence. Ordinary EG(phi) intersect F is insufficient: an ordinary phi-loop can avoid the justice set forever even when an exit to a fair region exists.

- E_f X(phi) is an ordinary one-step predecessor of `phi ∩ F`.
- E_f[phi U psi] is the set reaching `psi ∩ F` through a finite prefix whose earlier states satisfy phi. The endpoint can occur at time zero, but a fair infinite suffix is still required.
- E_f F(phi) uses the same until with left operand W.
- A_f X(phi) is the complement of E_f X(not phi).
- A_f F(phi) is the complement of E_f G(not phi).
- A_f G(phi) is the complement of E_f F(not phi).
- A_f[phi U psi] excludes both fair finite violations before psi and fair infinite avoidance of psi: complement of `E_f[not psi U(not phi and not psi)] union E_f G(not psi)`.

Boolean truth sets, ordinary/fair comparison, changed states, semantic route, all per-state child/continuation/vacuity checks, region pointers, auxiliary sets and every relevant finite-until round are recorded. The checker derives finite reachability from all vertex-simple prefixes rather than trusting the generator's least-fixed-point iteration. Complements are over all supplied states, not only F.

## Original controls

Twelve developed synthetic controls include: a repeated-hub two-justice walk with an unfair trap; infinite wait excluded by a goal-justice assumption; an empty justice set and vacuous universals with true local atoms; separately reachable but mutually exclusive recurrent justice sets; a justice set met only transiently; the wrong ordinary-EG/intersect-F shortcut; a two-state fair cycle with no self-loops; an until goal with no fair suffix; no-justice recovery of ordinary CTL; time-zero until with no fair continuation; overlapping justice sets; and nested quantifier restart.

The default four-state model has hub s0 pointing to s1, s2 and trap s3. s1/s2 return to the hub; s3 self-loops. Justice sets are {s1} and {s2}. A fair witness from s0 is prefix `[s0]` and cycle `[s0,s1,s0,s2,s0]`, with justice positions1 and3. No first-repeat simple cycle meets both. Fair-continuation states are s0,s1,s2, while s3 retains its labels but admits no fair path. The graph and transitions are unchanged by the assumption.

## Reproduction and bounded evidence

```sh
python -m pip install .
branchlab-fair examples/fairness.json --output /tmp/fair.json
branchlab-fair /tmp/fair.json --verify
# Equivalently: python -m branchlab.fair_cli ...
python -m unittest discover -s tests -v
npm test
bash tools/check_wheel.sh
python -m pip install -r requirements-reference.txt
python tools/check_reference.py          # original ordinary CTL only
python tools/check_fair_networkx.py      # fair-region graph reference only
python tools/audit_fair_reference.py     # why the old package is not a fair oracle
```

The full native suite has29tests:15original and14fairness. The new differential set contains278complete reports:186exhaustive one/two-state graph/label/justice cases,80seed37429 models with nested formulas, and12authored controls. Native generator, independent replay and JavaScript agree on2,808regions,4,135subformulas and2,643fair lassos. Every nonempty two-state successor relation, four p-label assignments and five justice patterns are covered; the one-state set includes both p-labels and three justice patterns. This is not exhaustive over six-state graphs, arbitrary formulas or every justice family.

All519noninput primitive leaves in a selected two-state certificate are separately changed and rejected. Tests include no-justice recovery for every subformula, all-witness edge/region/justice checks, explicit vacuity, strict schema, permutation/no-input-mutation, generator isolation, malformed/duplicate/nonfinite JSON, byte caps and atomic CLI failures. Both ordinary and fair workflows remain covered.

Actual Chrome checks36fair reports at1280/390/320,216regions,612start-region selections,465subformula selections,390walk rows,2,628graph edges and12trusted completed downloads independently replayed. It checks actual graph markings, all visible table records, route buttons, strict stale/invalid clearing, no page overflow and no console exceptions. Pixels are inspected separately. `FAIR_SCREEN_DIR` saves full-page images; `BRANCHLAB_FAIR_URL` targets deployment.

Fresh installed0.2wheels are run outside the checkout. Nine installed module origins,12fair controls, console/module generation and verification,24forged CLI rejections preserving previous output bytes, and24direct checker forgeries are checked. Original ordinary12controls/twoentrypoints/fiveorigins/20forgedCLI checks remain intact. Python3.10-3.13 are separate hosted jobs.

## External references: exact scope

The optional NetworkX3.4.2 graph reference genuinely runs on all278requests/2,808regions/4,632components/2,643lassos. It invokes installed strong-component, ancestor and shortest-path routines; checks each component's cycle/justice conditions and fair backward set; and validates witness edges, justice coverage and shortest prefix length. It uses generated reports and the authored corpus. It does not independently model-check the entire fair-CTL AST, prove canonical-cycle optimality or replace the full native checker. No NetworkX code is vendored, and it is not a runtime dependency.

The retained optional pyModelChecking1.3.4 ordinary-CTL reference is not a fair-CTL oracle for this release. Actual installed tests produced empty fair-state sets for a valid singleton self-loop and a valid two-state cycle without self-loops. On a two-state graph where only state0 satisfies p, state1 is the justice set and both states have self/cross edges, its fair EG(p) returned {0}; no path staying in p can meet justice at state1. The installed source uses a singleton/self-loop condition excluding those valid cases and rewrites fair EG as ordinary EG intersected with the global fair-state label, the shortcut excluded above. `tools/audit_fair_reference.py` reproduces these three pinned-version observations. We do not modify the package or claim a passing fairness comparison. These findings do not undo the original ordinary-CTL checks, which continue to run without fairness parameters.

## Inspected foundations and terminology

- Joost-Pieter Katoen, RWTH model checking lecture14, WiSe2019/2020, fair-CTL state semantics and fair-region characterization: https://moves.rwth-aachen.de/wp-content/uploads/WS1920/MC/mc2019-lecture14-slides.pdf . In particular, local atomic truth is not fair-state-guarded in the displayed equations. No example is copied.
- Roberto Sebastiani and Stefano Tonetta, *Introduction to Formal Methods*, Chapter06, May18,2020, SCC fair-EG and until/next suffix reasoning: http://disi.unitn.it/rseba/DIDATTICA/fm2020/06_FAIRCTL_HANDOUT.pdf . Its additional Boolean-fair guard is not adopted; this convention difference is kept explicit.
- Tim Willemse, *Algorithms for Model Checking*, lecture2,2011, fair nontrivial SCCs and backward reachability: https://timw.win.tue.nl/downloads/amc2011/amc_lecture2_2011.pdf . This teaching presentation also fair-guards atoms, unlike our stated local-state convention. The graph theorem is used, not that different Boolean convention.
- NuSMV user manual, fairness declarations: https://nusmv.fbk.eu/userman/v11/html/nusmv_23.html . Every constraint must hold infinitely often on one admitted path. Tool syntax is background, not a parser supported here.
- NuSMV fair-CTL implementation overview: https://nusmv.fbk.eu/papers/sttt_j/html/node16.html . Confirms fixed-point fair-CTL workflow, not a solver invoked by this project.
- Daniel Hausmann, Tadeusz Litak, Christoph Rauch and Matthias Zinner, *Cheap CTL Compassion in NuSMV*, VMCAI2020 tool-paper presentation: https://www.csc.liv.ac.uk/~hausmann/fairctl.pdf . Separates unconditional justice from conditional/strong Streett compassion. This project does not implement the latter or borrow its scaling claims.
- NuSMV2.7 tutorial, asynchronous running/fairness examples: https://nusmv.fbk.eu/tutorial/v27/tutorial.pdf . A fairness declaration filters executions; it is not a scheduler implementation. Original controls here do not copy its examples.
- pyModelChecking implementation documentation, inspected and compared with installed1.3.4: https://pymodelchecking.readthedocs.io/en/latest/_modules/pyModelChecking/kripke.html and https://pymodelchecking.readthedocs.io/en/latest/_modules/pyModelChecking/CTL/language.html . Used to delimit the rejected fairness oracle, not as authority for our semantics.
- NetworkX graph reference documentation: https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.components.strongly_connected_components.html and https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.shortest_paths.unweighted.all_pairs_shortest_path_length.html . Development graph-check scope only.

All authored engines, controls and tests are MIT licensed. No external solver source is copied or bundled. Strict parsing and Chrome lifecycle/download plumbing adapt the author's existing work; fairness engines and controls are separate. No paid API, private model/data, probabilities, action-enabledness, controller synthesis, strong compassion, arbitrary CTL*, new theorem, performance benchmark or actual-agent guarantee.
