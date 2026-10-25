"""Performance metrics used to compare equilibria and allocation schemes."""

import numpy as np


def jain_fairness(x):
    """Jain's fairness index: 1/N (perfectly unfair) .. 1 (perfectly fair)."""
    x = np.asarray(x, dtype=float)
    if np.allclose(x, 0.0):
        return 1.0
    return float(x.sum() ** 2 / (len(x) * np.sum(x ** 2)))


def price_of_anarchy(optimal_welfare, equilibrium_welfare):
    """Ratio of the social optimum to the welfare reached at Nash equilibrium (>= 1)."""
    if equilibrium_welfare <= 0:
        return float("inf")
    return float(optimal_welfare / equilibrium_welfare)


def energy_efficiency(sum_rate_mbps, total_power_w, circuit_power_w=0.1):
    """Network energy efficiency in Mbit/J (Mbps per watt incl. circuit power per link)."""
    return float(sum_rate_mbps / (total_power_w + circuit_power_w))
