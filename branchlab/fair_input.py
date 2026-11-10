"""Explicit state-justice extension; local Boolean truth stays local."""

from .input import validate as base_validate

LIMITS = [
    "One to six supplied total Kripke states; deadlocks rejected, not silently totalized.",
    "Zero to four state-justice sets. A fair infinite path visits every set infinitely often; an empty set makes fairness impossible.",
    "Atomic and Boolean state truth stays local. Only temporal path quantifiers range over fair paths; universal temporal claims may be vacuous without a fair continuation.",
    "Justice is an assumption, not a scheduler, controller, probability, action-fairness or Streett/compassion guarantee.",
    "Every induced state region is audited. A multi-justice recurrent walk may repeat intermediate states and need not be a simple cycle.",
    "Existing CTL AST caps and strong time-zero until semantics retained; nested quantifiers restart at each state.",
    "Established finite fair CTL, original bounded implementation. No CTL*, scalable solver, new theorem or actual-agent guarantee.",
]


def validate(raw):
    if type(raw) is not dict or set(raw) != {"model", "justice"}:
        raise ValueError("requires exactly model and justice")
    model = base_validate(raw["model"])
    names = [s["name"] for s in model["states"]]
    js = raw["justice"]
    if type(js) is not list or len(js) > 4:
        raise ValueError("justice must have length0..4")
    out = []
    for j in js:
        if (
            type(j) is not list
            or any(type(s) is not str or s not in names for s in j)
            or len(j) != len(set(j))
        ):
            raise ValueError("justice sets need unique declared states")
        out.append([s for s in names if s in j])
    return {"model": model, "justice": out}
