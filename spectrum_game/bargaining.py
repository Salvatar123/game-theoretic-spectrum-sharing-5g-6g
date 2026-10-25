"""Cooperative spectrum sharing via the Nash Bargaining Solution (NBS).

Network slices (e.g. eMBB, URLLC, mMTC tenants of a 5G/6G RAN) bargain over a
shared band of W MHz. Slice i achieves rate R_i = s_i * b_i (s_i = spectral
efficiency in bit/s/Hz, b_i in MHz -> R_i in Mbps) and has a disagreement point
d_i = its minimum guaranteed rate (what it would insist on without agreement).

The (weighted) NBS is the unique allocation satisfying Nash's axioms
(Pareto optimality, symmetry, scale invariance, independence of irrelevant
alternatives):

    max  sum_i  a_i * ln(R_i - d_i)    s.t.  sum_i b_i = W,  R_i >= d_i

For linear rates the solution is closed form: every slice first gets the
bandwidth that meets its minimum (d_i / s_i), and the surplus is split in
proportion to the bargaining powers a_i:

    b_i = d_i / s_i + a_i / sum(a) * (W - sum_j d_j / s_j)
"""

import numpy as np
from scipy.optimize import minimize


def nbs_closed_form(s, d, W, weights=None):
    s, d = np.asarray(s, float), np.asarray(d, float)
    a = np.ones_like(s) if weights is None else np.asarray(weights, float)
    base = d / s
    surplus = W - base.sum()
    if surplus < 0:
        raise ValueError("Minimum rate requirements exceed the shared band")
    return base + a / a.sum() * surplus


def nbs_numerical(s, d, W, weights=None):
    """Same problem solved with SLSQP, used to cross-check the closed form."""
    s, d = np.asarray(s, float), np.asarray(d, float)
    a = np.ones_like(s) if weights is None else np.asarray(weights, float)
    lo = d / s + 1e-6
    x0 = lo + (W - lo.sum()) / len(s)
    res = minimize(lambda b: -np.sum(a * np.log(s * b - d)), x0, method="SLSQP",
                   bounds=[(l, W) for l in lo],
                   constraints=[{"type": "eq", "fun": lambda b: b.sum() - W}],
                   options={"ftol": 1e-12, "maxiter": 500})
    return res.x


def equal_split(s, d, W):
    return np.full(len(s), W / len(s))


def max_sum_rate(s, d, W):
    """Utilitarian: meet the minimums, then give all surplus to the best slice."""
    s, d = np.asarray(s, float), np.asarray(d, float)
    b = d / s
    b[np.argmax(s)] += W - b.sum()
    return b


def proportional_to_demand(s, d, W):
    """Bandwidth proportional to each slice's minimum bandwidth need."""
    need = np.asarray(d, float) / np.asarray(s, float)
    return W * need / need.sum()
