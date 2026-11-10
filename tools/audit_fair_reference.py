"""Inspect pinned pyModelChecking fairness limits; never a passing fairness oracle."""

import json
from importlib.metadata import version
from pyModelChecking import Kripke
from pyModelChecking.CTL import modelcheck, EG, AtomicProposition

cases = []
k = Kripke(S=[0, 1], S0=[0], R=[(0, 1), (1, 0)], L={0: {"p"}, 1: {"p"}})
cases.append(
    {
        "case": "two-state cycle without self loops",
        "expected_fair_states": [0, 1],
        "observed": sorted(k.get_fair_states([{0}, {1}])),
    }
)
k = Kripke(S=[0], S0=[0], R=[(0, 0)], L={0: {"p"}})
cases.append(
    {
        "case": "one-state self loop",
        "expected_fair_states": [0],
        "observed": sorted(k.get_fair_states([{0}])),
    }
)
k = Kripke(S=[0, 1], S0=[0], R=[(0, 0), (0, 1), (1, 1), (1, 0)], L={0: {"p"}, 1: set()})
cases.append(
    {
        "case": "EG p cannot meet justice at state1 outside p",
        "expected_truth": [],
        "observed": sorted(modelcheck(k, EG(AtomicProposition("p")), F=[{1}])),
    }
)
print(
    json.dumps(
        {
            "package": "pyModelChecking",
            "version": version("pyModelChecking"),
            "not_used_as_fair_oracle": True,
            "observations": cases,
        }
    )
)
