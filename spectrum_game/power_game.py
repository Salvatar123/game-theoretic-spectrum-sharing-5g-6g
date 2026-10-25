"""Non-cooperative power-control game with linear pricing.

N small-cell links reuse the same 5G carrier. Each link i chooses a transmit
power p_i in [0, P_max] to maximise its own net utility

    u_i(p_i, p_-i) = R_i(p) - c * p_i ,      R_i = B log2(1 + SINR_i)   [Mbps]

where c (Mbps/W) is a price that the spectrum manager charges for the
interference each watt causes. Setting du_i/dp_i = 0 gives the best response

    BR_i(p_-i) = clip( B / (c ln2) - (I_i + N0) / G_ii , 0, P_max )

which is a *standard interference function* (Yates, 1995): positive, monotone
and scalable. Iterating it therefore converges from any starting point to the
unique Nash equilibrium.
"""

from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import minimize

LN2 = np.log(2.0)


@dataclass
class PowerGameResult:
    powers: np.ndarray
    sinr: np.ndarray
    rates_mbps: np.ndarray
    utilities: np.ndarray
    iterations: int
    converged: bool
    history: list = field(default_factory=list)

    @property
    def sum_rate(self):
        return float(self.rates_mbps.sum())

    @property
    def total_power(self):
        return float(self.powers.sum())

    @property
    def welfare(self):
        return float(self.utilities.sum())


def interference_plus_noise(p, net):
    G = net.gains
    return G @ p - np.diag(G) * p + net.noise_w


def sinr(p, net):
    return np.diag(net.gains) * p / interference_plus_noise(p, net)


def rates_mbps(p, net):
    return net.bandwidth_mhz * np.log2(1.0 + sinr(p, net))


def utilities(p, net, price):
    return rates_mbps(p, net) - price * p


def best_response(p, net, price, p_max):
    """Vector of every player's best response to the current power profile."""
    if price <= 0:
        return np.full(net.n, p_max)
    target = net.bandwidth_mhz / (price * LN2)
    return np.clip(target - interference_plus_noise(p, net) / np.diag(net.gains), 0.0, p_max)


def solve_nash(net, price, p_max=1.0, p0=None, tol=1e-10, max_iter=1000, sequential=True):
    """Best-response dynamics until no player wants to move (Nash equilibrium).

    sequential=True  -> Gauss-Seidel: players update one after another
    sequential=False -> Jacobi: all players update simultaneously
    """
    p = np.full(net.n, p_max) if p0 is None else np.array(p0, dtype=float)
    history = [p.copy()]
    converged = False
    it = 0
    for it in range(1, max_iter + 1):
        prev = p.copy()
        if sequential:
            for i in range(net.n):
                p[i] = best_response(p, net, price, p_max)[i]
        else:
            p = best_response(p, net, price, p_max)
        history.append(p.copy())
        if np.max(np.abs(p - prev)) < tol:
            converged = True
            break
    return _result(p, net, price, it, converged, history)


def social_optimum(net, price, p_max=1.0, restarts=8, rng=None):
    """Centralised benchmark: maximise sum of utilities (non-convex, multi-start L-BFGS-B)."""
    rng = np.random.default_rng(rng)
    G = net.gains
    Gd = np.diag(G)
    G_off = G - np.diag(Gd)
    b = net.bandwidth_mhz

    def neg_welfare(p):
        total = G @ p + net.noise_w
        interf = total - Gd * p
        welfare = b * np.sum(np.log2(total) - np.log2(interf)) - price * p.sum()
        grad = (b / LN2) * (G.T @ (1.0 / total) - G_off.T @ (1.0 / interf)) - price
        return -welfare, -grad

    starts = [np.full(net.n, p_max), np.full(net.n, p_max / 10)]
    starts.append(solve_nash(net, price, p_max).powers)
    starts += [rng.uniform(0, p_max, net.n) for _ in range(restarts)]
    best = None
    for x0 in starts:
        res = minimize(neg_welfare, x0, jac=True, method="L-BFGS-B",
                       bounds=[(0.0, p_max)] * net.n)
        if best is None or res.fun < best.fun:
            best = res
    return _result(best.x, net, price, best.nit, bool(best.success), [])


def _result(p, net, price, iterations, converged, history):
    return PowerGameResult(powers=p, sinr=sinr(p, net), rates_mbps=rates_mbps(p, net),
                           utilities=utilities(p, net, price), iterations=iterations,
                           converged=converged, history=history)
