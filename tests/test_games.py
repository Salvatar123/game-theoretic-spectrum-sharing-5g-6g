"""Correctness checks: every computed equilibrium must satisfy its definition."""

import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spectrum_game import bargaining, channel, cournot_game, power_game, stackelberg_game
from spectrum_game.metrics import jain_fairness


class PowerGameTests(unittest.TestCase):
    def setUp(self):
        self.net = channel.deploy_links(6, rng=7)
        self.price, self.p_max = 40.0, 1.0

    def test_converges(self):
        res = power_game.solve_nash(self.net, self.price, self.p_max)
        self.assertTrue(res.converged)

    def test_no_profitable_unilateral_deviation(self):
        res = power_game.solve_nash(self.net, self.price, self.p_max)
        grid = np.linspace(0, self.p_max, 2001)
        for i in range(self.net.n):
            best_dev = -np.inf
            for q in grid:
                p = res.powers.copy()
                p[i] = q
                best_dev = max(best_dev, power_game.utilities(p, self.net, self.price)[i])
            self.assertLessEqual(best_dev, res.utilities[i] + 1e-6)

    def test_unique_equilibrium_from_any_start(self):
        a = power_game.solve_nash(self.net, self.price, self.p_max, p0=np.zeros(6))
        b = power_game.solve_nash(self.net, self.price, self.p_max, p0=np.full(6, self.p_max))
        c = power_game.solve_nash(self.net, self.price, self.p_max, sequential=False)
        np.testing.assert_allclose(a.powers, b.powers, atol=1e-7)
        np.testing.assert_allclose(a.powers, c.powers, atol=1e-7)

    def test_optimum_dominates_equilibrium(self):
        ne = power_game.solve_nash(self.net, self.price, self.p_max)
        opt = power_game.social_optimum(self.net, self.price, self.p_max, rng=0)
        self.assertGreaterEqual(opt.welfare, ne.welfare - 1e-6)


class CournotTests(unittest.TestCase):
    def setUp(self):
        k = channel.mqam_spectral_efficiency(np.array([14.0, 16.0, 18.0]))
        self.market = cournot_game.CournotMarket(k=k)

    def test_matches_closed_form(self):
        np.testing.assert_allclose(cournot_game.nash_equilibrium(self.market),
                                   cournot_game.closed_form_equilibrium(self.market), atol=1e-8)

    def test_first_order_conditions(self):
        b = cournot_game.nash_equilibrium(self.market)
        np.testing.assert_allclose(self.market.marginal_profit(b), 0.0, atol=1e-8)

    def test_dynamics_stable_below_threshold_only(self):
        b_star = cournot_game.nash_equilibrium(self.market)
        a_crit = cournot_game.stability_threshold(self.market)
        stable = cournot_game.dynamic_adjustment(self.market, 0.8 * a_crit, b_star * 0.5, 3000)
        np.testing.assert_allclose(stable[-1], b_star, atol=1e-6)
        unstable = cournot_game.dynamic_adjustment(self.market, 1.1 * a_crit, b_star * 0.5, 3000)
        self.assertFalse(np.allclose(unstable[-1], b_star, atol=1e-3))

    def test_collusion_beats_competition(self):
        b_ne = cournot_game.nash_equilibrium(self.market)
        b_co = cournot_game.collusion_optimum(self.market)
        self.assertGreater(self.market.profits(b_co).sum(), self.market.profits(b_ne).sum())


class StackelbergTests(unittest.TestCase):
    def test_followers_best_respond(self):
        market = stackelberg_game.random_market(5, rng=3)
        res = stackelberg_game.solve(market)
        for i in range(market.n):
            grid = np.linspace(0, 100, 20001)
            u = market.w[i] * np.log1p(market.g[i] * grid) - res.price * grid
            self.assertLessEqual(u.max(), res.follower_utility[i] + 1e-4)

    def test_leader_price_is_optimal(self):
        market = stackelberg_game.random_market(5, rng=3)
        res = stackelberg_game.solve(market)
        prices = np.linspace(market.cost, market.max_price, 20000)
        feasible = [p for p in prices
                    if stackelberg_game.follower_demand(market, p).sum() <= market.capacity_mhz]
        best = max(stackelberg_game.leader_profit(market, p) for p in feasible)
        self.assertGreaterEqual(res.leader_profit, best - 1e-6)

    def test_capacity_respected(self):
        market = stackelberg_game.random_market(30, capacity_mhz=50, rng=1)
        res = stackelberg_game.solve(market)
        self.assertLessEqual(res.demand.sum(), market.capacity_mhz + 1e-6)


class BargainingTests(unittest.TestCase):
    s = np.array([5.5, 3.0, 1.5])
    d = np.array([150.0, 40.0, 15.0])

    def test_closed_form_matches_numerical(self):
        for w in (None, [2, 1, 1]):
            np.testing.assert_allclose(bargaining.nbs_closed_form(self.s, self.d, 100, w),
                                       bargaining.nbs_numerical(self.s, self.d, 100, w), atol=1e-3)

    def test_uses_whole_band_and_meets_minimums(self):
        b = bargaining.nbs_closed_form(self.s, self.d, 100)
        self.assertAlmostEqual(b.sum(), 100.0)
        self.assertTrue(np.all(self.s * b >= self.d))


class MetricTests(unittest.TestCase):
    def test_jain_bounds(self):
        self.assertAlmostEqual(jain_fairness([1, 1, 1, 1]), 1.0)
        self.assertAlmostEqual(jain_fairness([1, 0, 0, 0]), 0.25)


if __name__ == "__main__":
    unittest.main(verbosity=2)
