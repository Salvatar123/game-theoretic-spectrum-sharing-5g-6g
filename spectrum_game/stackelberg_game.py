"""Stackelberg (leader-follower) spectrum pricing game.

Leader   : the primary MNO, which has W MHz of temporarily idle licensed spectrum
           and announces a unit price p (per MHz). Leasing spectrum has an
           opportunity cost c per MHz (e.g. risk to its own users' QoS).
Followers: N secondary users (private 5G networks, IoT/D2D clusters). Follower i
           with valuation w_i and channel quality g_i chooses bandwidth b_i to
           maximise
               U_i(b_i) = w_i ln(1 + g_i b_i) - p b_i
           whose unique best response is
               b_i*(p) = max(0, w_i / p - 1 / g_i).

The leader anticipates these responses and solves
    max_p  (p - c) * sum_i b_i*(p)    s.t.  sum_i b_i*(p) <= W.
The pair (p*, b*(p*)) is the Stackelberg equilibrium, found by backward induction.
"""

from dataclasses import dataclass

import numpy as np
from scipy.optimize import brentq, minimize_scalar


@dataclass
class StackelbergMarket:
    w: np.ndarray            # follower valuations
    g: np.ndarray            # follower channel quality (per MHz)
    capacity_mhz: float = 100.0
    cost: float = 0.5        # leader's opportunity cost per MHz

    @property
    def n(self):
        return len(self.w)

    @property
    def max_price(self):
        # above w_i * g_i follower i buys nothing
        return float(np.max(self.w * self.g))


def follower_demand(market, p):
    return np.maximum(0.0, market.w / p - 1.0 / market.g)


def follower_utility(market, b, p):
    return market.w * np.log1p(market.g * b) - p * b


def leader_profit(market, p):
    return (p - market.cost) * follower_demand(market, p).sum()


@dataclass
class StackelbergResult:
    price: float
    demand: np.ndarray
    leader_profit: float
    follower_utility: np.ndarray
    capacity_binding: bool


def solve(market, grid_points=4000):
    """Backward induction: grid search on the leader's price, then local refinement."""
    p_hi = market.max_price
    p_lo = max(market.cost, 1e-6)

    # Demand is decreasing in p: if it would exceed capacity, the leader must
    # charge at least the market-clearing price.
    if follower_demand(market, p_lo).sum() > market.capacity_mhz:
        p_lo = brentq(lambda p: follower_demand(market, p).sum() - market.capacity_mhz,
                      p_lo, p_hi)

    grid = np.linspace(p_lo, p_hi, grid_points)
    profits = np.array([leader_profit(market, p) for p in grid])
    k = int(np.argmax(profits))
    lo, hi = grid[max(k - 1, 0)], grid[min(k + 1, grid_points - 1)]
    res = minimize_scalar(lambda p: -leader_profit(market, p), bounds=(lo, hi), method="bounded")
    p_star = res.x if -res.fun >= profits[k] else grid[k]

    b = follower_demand(market, p_star)
    return StackelbergResult(price=float(p_star), demand=b,
                             leader_profit=float(leader_profit(market, p_star)),
                             follower_utility=follower_utility(market, b, p_star),
                             capacity_binding=bool(np.isclose(b.sum(), market.capacity_mhz, rtol=1e-3)))


def random_market(n_followers, capacity_mhz=100.0, cost=0.5, rng=None):
    rng = np.random.default_rng(rng)
    w = rng.uniform(20.0, 60.0, n_followers)
    g = rng.uniform(0.2, 1.0, n_followers)
    return StackelbergMarket(w=w, g=g, capacity_mhz=capacity_mhz, cost=cost)
