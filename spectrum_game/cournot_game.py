"""Cournot game between secondary operators buying spectrum from a primary MNO.

Model after Niyato & Hossain, "Competitive pricing for spectrum sharing in
cognitive radio networks", IEEE JSAC 26(1), 2008.

N secondary operators each request b_i MHz. The primary prices spectrum with an
increasing inverse-demand function of the total request B = sum(b):

    c(B) = x + y * B                         (price per MHz)

Operator i earns revenue r per Mbps and its spectral efficiency is k_i
(bit/s/Hz, from adaptive M-QAM), so its profit is

    pi_i = r * k_i * b_i - b_i * c(B)

The marginal profit is  d pi_i / d b_i = r k_i - x - y B - y b_i , so

    best response  b_i = max(0, (r k_i - x - y B_-i) / (2y))

Dynamic (bounded-rationality) game: operators only observe their marginal
profit and adjust  b_i(t+1) = b_i(t) + alpha * b_i(t) * d pi_i / d b_i .
For small alpha this converges to the Nash equilibrium; for large alpha the
equilibrium loses stability (period doubling, then chaos).
"""

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize


@dataclass
class CournotMarket:
    k: np.ndarray        # spectral efficiency of each operator (bit/s/Hz)
    r: float = 10.0      # revenue per Mbps
    x: float = 2.0       # base price per MHz
    y: float = 1.0       # price slope

    @property
    def n(self):
        return len(self.k)

    def price(self, b):
        return self.x + self.y * np.sum(b)

    def profits(self, b):
        b = np.asarray(b, dtype=float)
        return b * (self.r * self.k - self.price(b))

    def marginal_profit(self, b):
        b = np.asarray(b, dtype=float)
        return self.r * self.k - self.x - self.y * np.sum(b) - self.y * b


def best_response(market, b, i):
    others = np.sum(b) - b[i]
    return max(0.0, (market.r * market.k[i] - market.x - market.y * others) / (2.0 * market.y))


def nash_equilibrium(market, tol=1e-12, max_iter=10_000):
    """Sequential best response. The linear Cournot game is an exact potential
    game, so Gauss-Seidel best-response converges to its unique equilibrium."""
    b = np.zeros(market.n)
    for _ in range(max_iter):
        prev = b.copy()
        for i in range(market.n):
            b[i] = best_response(market, b, i)
        if np.max(np.abs(b - prev)) < tol:
            break
    return b


def closed_form_equilibrium(market):
    """Interior Nash equilibrium (valid when every operator buys a positive amount)."""
    n, r, x, y = market.n, market.r, market.x, market.y
    total = (r * market.k.sum() - n * x) / (y * (n + 1))
    return (r * market.k - x - y * total) / y


def collusion_optimum(market):
    """Operators cooperate to maximise total profit (benchmark for the PoA)."""
    res = minimize(lambda b: -market.profits(b).sum(), np.ones(market.n),
                   bounds=[(0.0, None)] * market.n, method="L-BFGS-B")
    return res.x


def dynamic_adjustment(market, alpha, b0, steps=300):
    """Iterate the bounded-rationality dynamic; returns trajectory (steps+1, N)."""
    traj = np.empty((steps + 1, market.n))
    b = np.array(b0, dtype=float)
    traj[0] = b
    for t in range(steps):
        b = np.maximum(b + alpha * b * market.marginal_profit(b), 0.0)
        if not np.all(np.isfinite(b)) or b.max() > 1e6:
            traj[t + 1:] = np.nan
            break
        traj[t + 1] = b
    return traj


def stability_threshold(market, b_star=None):
    """Largest learning rate alpha for which the equilibrium is locally stable.

    Jacobian of the map at an interior equilibrium: J = I - alpha * y * diag(b*) (I + 1 1^T).
    Stable iff all eigenvalues lie inside the unit circle.
    """
    b_star = nash_equilibrium(market) if b_star is None else b_star
    M = market.y * np.diag(b_star) @ (np.eye(market.n) + np.ones((market.n, market.n)))
    lam_max = np.max(np.real(np.linalg.eigvals(M)))
    return 2.0 / lam_max
