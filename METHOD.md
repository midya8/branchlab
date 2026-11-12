# BranchLab: ordinary CTL

These notes define the original total-graph, ordinary-CTL mode.
[FAIRNESS.md](FAIRNESS.md) defines the separate justice-set path convention,
including vacuous temporal claims and the restrictions on fair EG.

## Contract

Supplied finite total Kripke graph, not a game: every state has at least one successor. We reject deadlocks rather than silently adding transitions or choosing a finite-path convention. In this original mode all paths are infinite and path quantifiers have no fairness restriction. Labels are state propositions, not probabilities or inferred facts. All supplied states are checked, including states unreachable from a particular viewing selection.

The bounded AST uses one quantifier per temporal operator, with state-formula children. Nested quantifiers restart at the current state. `AG EF p` is not the same as `AF p`, and `AX EX p` is not `EX AX p`. This mode does not accept arbitrary CTL*, LTL, justice sets, weak until, release or textual SMV specifications. The separate fair mode accepts explicitly supplied justice sets. Strong until admits a zero-step right operand and excludes waiting forever without it. Limits are 1..6 states, at most 4 atoms, 1..8 roots, depth 6, at most 32 nodes/root and 128 in total. Reports use state order, not lexicographic name order; repeated identical subformulas share an ID and child-first entry.

## Truth equations

Let S be all states, PreE(Z) the states having a successor in Z, and PreA(Z) the states whose every successor belongs to Z. Totality prevents vacuous deadlock next-truth and supports the usual infinite-path semantics.

- EX p = PreE(p); AX p = PreA(p).
- EF p = least Z of p union PreE(Z).
- AF p = least Z of p union PreA(Z).
- EG p = greatest Z of p intersect PreE(Z).
- AG p = greatest Z of p intersect PreA(Z).
- E[p U q] = least Z of q union (p intersect PreE(Z)).
- A[p U q] = least Z of q union (p intersect PreA(Z)).

Boolean truth uses complement relative to S, intersection and union. Synchronous least iterations start empty; greatest iterations start at S. Every round reads the same prior set, includes all state checks, records changes, and retains the final unchanged round. Monotonicity and finiteness bound strict changes by n. For AU, finite branching and eventual success on every infinite path yield a finite uniform rank. No finite sample trace is substituted for this all-branch requirement.

## Certificates and independent checks

A self-consistent fixed point can be wrong. The complete subset atlas lists every Z, its image F(Z), fixed status, F(Z) subset Z (pre-fixed) and Z subset F(Z) (post-fixed). A least fixed point is the intersection of all pre-fixed sets, equivalently all fixed points on this finite lattice; a greatest fixed point is the union of all post-fixed sets, equivalently all fixed points.

The main native generator uses Python sets and extremal synchronous iteration. The independent native verifier imports only schema/type utilities, not the generator. It enumerates integer-bitmask candidates, selects truth through intersections/unions of **all fixed points**, and only then reconstructs the displayed iterations. It independently lists every vertex-simple finite prefix and first-repeat lasso, sorts by transitions and supplied-state order, and selects canonical path-shaped evidence. Every field, list order, type and key is compared; JSON duplicate keys and nonfinite constants are rejected. This is independent implementation, not a mechanically verified checker.

EX true, AX false, EF/EU true and AG false get finite prefixes. EG true and AF false get lassos. AU false first uses a shortest prefix that loses both left and right before any right; if none exists, a lasso avoiding the right is shown. A lasso's last state repeats an earlier state, with zero-based cycle-start index. These are valid evidence for the **selected subformula**, using its child truth sets. A universal true or existential false statement cannot generally be certified by a single execution; those entries say branching certificate and rely on all-state obligations/extrema. Paths are examples, not claims of unique executions or full proofs of nested children.

The browser independently implements validation, integer-bitmask truth iteration, all subset images and canonical example discovery. Full reports are compared against native output, not served precomputed JSON certificates. The UI exposes all subformulas, states, rounds and subset rows. Downloaded complete certificates are replayable by the installed verifier.

## Coverage

Native tests check all 144 two-state total transition graphs with every two-proposition labelling, plus all 2,744 three-state total graph/one-proposition labellings with q fixed at state 2. The latter uses a third direct semantics oracle: finite prefixes for EF/AG/EU and first-repeat lassos plus bad prefixes for AF/EG/AU. These exhaustions cover those stated small spaces, not all larger graphs or all CTL formulas. 120 seeded nested cases test 1..6 states; 60 seeded duality cases, malformed schemas and all 445 non-input primitive fields of the default report are tested. A tamper count is specific to this default, not every possible report.

The browser-engine full-record comparison covers 276 requests, 3,662 unique subformula records, 3,963 rounds and 30,020 subset-atlas rows. Optional pyModelChecking 1.3.4 checks 212 requests and 3,630 subformula truth sets, including all 12 controls and 200 seeded nested cases. It is a separate GPL test dependency, never vendored or part of runtime; agreement is a correctness cross-check, not a formal proof or performance benchmark. No code is copied from it. Commands and CI reproduce these checks; a failed check must stay visible until fixed.

The actual Chrome test covers the full UI controls and exports, including narrow widths, arbitrary edits and rejection recovery. The release record describes observed runs; no timing or scaling benchmark is claimed.

## Sources and attribution

Classical theory is credited below. University lecture notes corroborate the fixed-point equations, monotonicity and finite-state iteration. NuSMV pages are explicitly historical versions used for semantics and witness limitations, not current product behavior claims.

1. Matt Fredrikson, CMU 15-414 lecture 23, Spring 2023: [CTL model checking](https://www.cs.cmu.edu/~15414/s23/lectures/23-ctl-checking.pdf). Total structure, subformula algorithm and least/greatest CTL equations.
2. Tevfik Bultan, UCSB 267 [lecture3](https://sites.cs.ucsb.edu/~bultan/courses/267/lectures/l3.pdf). Fixed-point lattice reasoning, EF least and EG greatest.
3. Tim Willemse, TU Eindhoven 2019 [lecture2](https://timw.win.tue.nl/downloads/amc2019/lecture2.pdf). EX/EG/EU basis, finite iteration and symbolic/explicit distinction.
4. [pyModelChecking models](https://pymodelchecking.readthedocs.io/en/latest/models.html). Total Kripke structures and infinite paths. Our paths are displayed by node sequences; transition count is sequence length minus one.
5. [NuSMV 2.1 tutorial](https://nusmv.fbk.eu/userman/v21/nusmv_2.html). Deadlock risk, fairness, AG EF versus AF and single-trace limitations for arbitrary CTL.
6. [NuSMV 1.1 fairness](https://nusmv.fbk.eu/userman/v11/html/nusmv_23.html). Fairness is an extra restriction of quantified paths, not assumed in the original mode.
7. [NuSMV 1.1 CTL syntax](https://nusmv.fbk.eu/userman/v11/html/nusmv_25.html). Operators and state-formula syntax; we implement bounded JSON AST rather than SMV text.
8. [pyModelChecking 1.3.4](https://pypi.org/project/pyModelChecking/) and [constructor/model-check usage](https://pymodelchecking.readthedocs.io/en/latest/using_logics.html). Separate installed reference, version, license, dependency and API grounding.

Original controls, CTL code, subset-extremum replay and interface by this project. The author's AbsorbLab contributes strict JSON parsing, installed-wheel and Chrome readiness/download scaffolding. No external implementation, textbook diagram or real/private system data is reproduced. MIT project license does not relicense optional test packages.
