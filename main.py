"""Game-Theoretic Model for Spectrum Sharing in 5G/6G Networks - experiment driver.

Runs every experiment, prints result tables and writes figures + a JSON summary
to the output folder.

    python main.py                 # full run (results/)
    python main.py --quick         # fewer Monte-Carlo drops, for a fast check
"""

import argparse
import json
import os
import sys
import time

import numpy as np
import matplotlib.pyplot as plt

from spectrum_game import bargaining, channel, cournot_game, power_game, stackelberg_game
from spectrum_game.metrics import energy_efficiency, jain_fairness, price_of_anarchy
from spectrum_game.plotting import (AXIS, GRID, INK, INK_2, MUTED, SERIES, apply_style,
                                    label_end, save)

P_MAX = 1.0          # W (30 dBm small-cell limit)
REF_PRICE = 40.0     # Mbps/W, interference price used for the reference scenario


class Tee:
    """Write console output to the terminal and a log file at the same time."""

    def __init__(self, path):
        self.file = open(path, "w", encoding="utf-8")
        self.stdout = sys.stdout

    def write(self, text):
        self.stdout.write(text)
        self.file.write(text)

    def flush(self):
        self.stdout.flush()
        self.file.flush()


def header(title):
    print("\n" + "=" * 78)
    print(f"  {title}")
    print("=" * 78)


def table(columns, rows, fmt):
    cells = [[v.strip() if isinstance(v, str) else f"{v:{f}}" for v, f in zip(row, fmt)]
             for row in rows]
    widths = [max([len(c), 9] + [len(r[j]) for r in cells]) for j, c in enumerate(columns)]
    columns = [c.strip() for c in columns]
    print("  " + " ".join(c.rjust(w) for c, w in zip(columns, widths)))
    print("  " + " ".join("-" * w for w in widths))
    for row in cells:
        print("  " + " ".join(v.rjust(w) for v, w in zip(row, widths)))


# ---------------------------------------------------------------------------
# Experiment 1 - power-control game on one network drop
# ---------------------------------------------------------------------------
def exp_power_reference(out, seed):
    header("EXPERIMENT 1: Non-cooperative power-control game (N = 6 small cells)")
    net = channel.deploy_links(6, rng=seed)
    print(f"  Carrier: n78 {net.fc_ghz} GHz, bandwidth {net.bandwidth_mhz:.0f} MHz, "
          f"noise {10 * np.log10(net.noise_w * 1e3):.1f} dBm, P_max = {P_MAX} W, "
          f"price c = {REF_PRICE} Mbps/W")

    ne = power_game.solve_nash(net, REF_PRICE, P_MAX, p0=np.zeros(net.n))
    flat = power_game.solve_nash(net, 0.0, P_MAX)            # no pricing -> everyone at P_max
    opt = power_game.social_optimum(net, REF_PRICE, P_MAX, rng=seed)
    print(f"  Best-response dynamics converged: {ne.converged} after {ne.iterations} rounds\n")

    dist = np.linalg.norm(net.rx_pos - net.tx_pos, axis=1)
    sinr_db = [f"{10 * np.log10(v):.1f}" if v > 0 else "off" for v in ne.sinr]
    rows = [(f"SC{i + 1}", dist[i], ne.powers[i], sinr_db[i], ne.rates_mbps[i],
             flat.rates_mbps[i], ne.utilities[i]) for i in range(net.n)]
    table(["Link", "d (m)", "p* (W)", "SINR (dB)", "R* (Mbps)", "R@Pmax", "u* (net)"],
          rows, ["s", ".1f", ".3f", "s", ".1f", ".1f", ".2f"])

    schemes = {"Nash eq. (priced)": ne, "No pricing (P_max)": flat, "Social optimum": opt}
    print()
    table(["Scheme", "Sum rate", "Power (W)", "EE (Mb/J)", "Jain"],
          [(k.rjust(18), r.sum_rate, r.total_power,
            energy_efficiency(r.sum_rate, r.total_power, 0.1 * net.n), jain_fairness(r.rates_mbps))
           for k, r in schemes.items()],
          ["s", ".1f", ".3f", ".1f", ".3f"])
    poa = price_of_anarchy(opt.welfare, ne.welfare)
    print(f"\n  Welfare: NE = {ne.welfare:.2f}, optimum = {opt.welfare:.2f}, "
          f"Price of Anarchy = {poa:.3f}")

    # Figure: topology
    fig, ax = plt.subplots(figsize=(5.2, 4.6))
    for i in range(net.n):
        c = SERIES[i]
        ax.plot(*zip(net.tx_pos[i], net.rx_pos[i]), color=c, lw=1.6, zorder=2)
        ax.scatter(*net.tx_pos[i], marker="^", s=70, color=c, edgecolor="white", lw=1.2, zorder=3)
        ax.scatter(*net.rx_pos[i], marker="o", s=40, color=c, edgecolor="white", lw=1.2, zorder=3)
        ax.annotate(f"SC{i + 1}", net.tx_pos[i], xytext=(6, 6), textcoords="offset points",
                    fontsize=8.5, color=INK_2)
    ax.scatter([], [], marker="^", color=MUTED, label="Small-cell transmitter")
    ax.scatter([], [], marker="o", color=MUTED, label="User / receiver")
    ax.set(xlabel="x (m)", ylabel="y (m)", aspect="equal")
    ax.set_title("Co-channel small-cell deployment (3.5 GHz, 20 MHz)")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.14), ncol=2)
    save(fig, os.path.join(out, "fig01_topology.png"))

    # Figure: convergence of best-response dynamics
    hist = np.array(ne.history)
    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    for i in range(net.n):
        ax.plot(range(len(hist)), hist[:, i], color=SERIES[i], marker="o", ms=3.5, label=f"SC{i + 1}")
    off = [f"SC{i + 1}" for i in range(net.n) if ne.powers[i] == 0]
    if off:
        label_end(ax, len(hist) - 1, 0.0, f"{', '.join(off)} priced out (p* = 0)", dx=-150, dy=9)
    ax.set(xlabel="Best-response round", ylabel="Transmit power (W)")
    ax.set_title("Best-response dynamics converge to the Nash equilibrium")
    ax.legend(ncol=6, loc="upper center", bbox_to_anchor=(0.5, -0.18))
    save(fig, os.path.join(out, "fig02_power_convergence.png"))

    return {"net": net, "ne": ne, "flat": flat, "opt": opt, "poa": poa,
            "summary": {k: {"sum_rate_mbps": r.sum_rate, "total_power_w": r.total_power,
                            "jain": jain_fairness(r.rates_mbps)} for k, r in schemes.items()}
            | {"price_of_anarchy": poa, "iterations": ne.iterations}}


# ---------------------------------------------------------------------------
# Experiment 2 - effect of the interference price
# ---------------------------------------------------------------------------
def exp_price_sweep(out, net):
    header("EXPERIMENT 2: Effect of interference price c on the equilibrium")
    prices = np.geomspace(1, 1e6, 61)
    flat = power_game.solve_nash(net, 0.0, P_MAX)
    res = [power_game.solve_nash(net, c, P_MAX) for c in prices]
    sr = np.array([r.sum_rate for r in res])
    pw = np.array([r.total_power for r in res])
    ee = np.array([energy_efficiency(r.sum_rate, r.total_power, 0.1 * net.n) for r in res])
    jf = np.array([jain_fairness(r.rates_mbps) for r in res])
    flat_ee = energy_efficiency(flat.sum_rate, flat.total_power, 0.1 * net.n)

    pick = [0, 10, 20, 30, 40, 50, 60]
    table(["c (Mbps/W)", "Sum rate", "Power (W)", "EE (Mb/J)", "Jain"],
          [(prices[k], sr[k], pw[k], ee[k], jf[k]) for k in pick], [".1f", ".1f", ".3f", ".1f", ".3f"])
    print(f"  {'no price':>10} {flat.sum_rate:10.1f} {flat.total_power:10.3f} {flat_ee:10.1f} "
          f"{jain_fairness(flat.rates_mbps):10.3f}")
    k_best = int(np.argmax(ee))
    print(f"\n  Energy efficiency peaks at c = {prices[k_best]:.1f} Mbps/W: {ee[k_best]:.1f} Mb/J "
          f"({ee[k_best] / flat_ee:.1f}x the unpriced network) with sum rate {sr[k_best]:.1f} Mbps")

    fig, axes = plt.subplots(2, 2, figsize=(9, 6.2), sharex=True)
    panels = [(sr, flat.sum_rate, "Sum rate (Mbps)"), (pw, flat.total_power, "Total transmit power (W)"),
              (ee, flat_ee, "Energy efficiency (Mbit/J)"), (jf, jain_fairness(flat.rates_mbps), "Jain fairness index")]
    for ax, (y, base, title) in zip(axes.flat, panels):
        ax.plot(prices, y, color=SERIES[0])
        ax.axhline(base, color=MUTED, ls="--", lw=1.2)
        ax.set_xscale("log")
        ax.set_title(title)
    axes[0, 0].plot([], [], color=SERIES[0], label="Nash equilibrium with price c")
    axes[0, 0].plot([], [], color=MUTED, ls="--", lw=1.2, label="No pricing (all at P_max)")
    axes[0, 0].legend(loc="lower left")
    axes[1, 0].axvline(prices[k_best], color=AXIS, lw=1)
    axes[1, 0].scatter([prices[k_best]], [ee[k_best]], color=SERIES[0], s=36, zorder=3,
                       edgecolor="white", lw=1.2)
    label_end(axes[1, 0], prices[k_best], ee[k_best], f"peak {ee[k_best]:.0f} Mb/J", dx=6, dy=4)
    for ax in axes[1]:
        ax.set_xlabel("Interference price c (Mbps per W, log scale)")
    fig.tight_layout()
    save(fig, os.path.join(out, "fig03_price_sweep.png"))
    return {"best_price": float(prices[k_best]), "best_ee": float(ee[k_best]),
            "flat_ee": float(flat_ee), "sum_rate_at_best": float(sr[k_best])}


# ---------------------------------------------------------------------------
# Experiment 3 - Monte Carlo scaling with network density
# ---------------------------------------------------------------------------
def exp_density(out, seed, drops):
    header(f"EXPERIMENT 3: Network density (Monte Carlo, {drops} random drops per point)")
    sizes = [2, 4, 6, 8, 10, 12]
    rng = np.random.default_rng(seed)
    stats = {k: [] for k in ("ne_rate", "flat_rate", "opt_rate", "poa", "ne_ee", "flat_ee", "iters")}
    for n in sizes:
        acc = {k: [] for k in stats}
        for _ in range(drops):
            net = channel.deploy_links(n, rng=rng)
            ne = power_game.solve_nash(net, REF_PRICE, P_MAX)
            flat = power_game.solve_nash(net, 0.0, P_MAX)
            opt = power_game.social_optimum(net, REF_PRICE, P_MAX, restarts=4, rng=rng)
            acc["ne_rate"].append(ne.sum_rate)
            acc["flat_rate"].append(flat.sum_rate)
            acc["opt_rate"].append(opt.sum_rate)
            acc["poa"].append(price_of_anarchy(opt.welfare, ne.welfare))
            acc["ne_ee"].append(energy_efficiency(ne.sum_rate, ne.total_power, 0.1 * n))
            acc["flat_ee"].append(energy_efficiency(flat.sum_rate, flat.total_power, 0.1 * n))
            acc["iters"].append(ne.iterations)
        for k in stats:
            stats[k].append(float(np.mean(acc[k])))
    table(["N links", "R_NE", "R_Pmax", "R_opt", "PoA", "EE_NE", "EE_Pmax", "BR rounds"],
          [(n, *(stats[k][j] for k in stats)) for j, n in enumerate(sizes)],
          ["d", ".1f", ".1f", ".1f", ".3f", ".1f", ".1f", ".1f"])

    fig, axes = plt.subplots(1, 2, figsize=(9.6, 3.8))
    ax = axes[0]
    for key, name, c, m in (("opt_rate", "Social optimum", SERIES[2], "s"),
                            ("ne_rate", "Nash eq. (priced)", SERIES[0], "o"),
                            ("flat_rate", "No pricing (P_max)", SERIES[1], "^")):
        ax.plot(sizes, stats[key], color=c, marker=m, ms=6, label=name)
        label_end(ax, sizes[-1], stats[key][-1], name.split(" (")[0], dx=6)
    ax.set(xlabel="Number of co-channel links N", ylabel="Mbps", xlim=(1.5, 15.5))
    ax.set_title("Average network sum rate")
    ax.legend(loc="upper left")
    ax = axes[1]
    ax.plot(sizes, stats["poa"], color=SERIES[0], marker="o", ms=6)
    ax.axhline(1.0, color=MUTED, ls="--", lw=1.2)
    label_end(ax, sizes[0], 1.0, "PoA = 1 (fully efficient)", dx=0, dy=9)
    ax.set(xlabel="Number of co-channel links N", ylabel="Optimal welfare / NE welfare")
    ax.set_title("Price of Anarchy")
    fig.tight_layout()
    save(fig, os.path.join(out, "fig04_density.png"))
    return {"sizes": sizes} | stats


# ---------------------------------------------------------------------------
# Experiment 4 - Cournot competition between secondary operators
# ---------------------------------------------------------------------------
def exp_cournot(out):
    header("EXPERIMENT 4: Cournot game - 3 secondary operators buying spectrum")
    snr = np.array([14.0, 16.0, 18.0])
    k = channel.mqam_spectral_efficiency(snr)
    m = cournot_game.CournotMarket(k=k, r=10.0, x=2.0, y=1.0)
    b_ne = cournot_game.nash_equilibrium(m)
    b_cf = cournot_game.closed_form_equilibrium(m)
    b_co = cournot_game.collusion_optimum(m)
    print(f"  Price function c(B) = {m.x} + {m.y}*B, revenue r = {m.r} per Mbps, target BER 1e-4\n")
    table(["Operator", "SNR (dB)", "k (b/s/Hz)", "b* (MHz)", "Closed form", "Profit NE", "b collude"],
          [(f"SO{i + 1}", snr[i], k[i], b_ne[i], b_cf[i], m.profits(b_ne)[i], b_co[i]) for i in range(m.n)],
          ["s", ".0f", ".3f", ".3f", ".3f", ".2f", ".3f"])
    a_crit = cournot_game.stability_threshold(m, b_ne)
    print(f"\n  NE: total spectrum {b_ne.sum():.2f} MHz at price {m.price(b_ne):.2f}/MHz, "
          f"total profit {m.profits(b_ne).sum():.2f}")
    print(f"  Collusion: total spectrum {b_co.sum():.2f} MHz at price {m.price(b_co):.2f}/MHz, "
          f"total profit {m.profits(b_co).sum():.2f}")
    print(f"  Dynamic game stable for learning rate alpha < {a_crit:.4f}")

    fig, axes = plt.subplots(1, 2, figsize=(9.6, 3.6), sharey=True)
    b0 = np.array([1.0, 1.0, 1.0])
    for ax, alpha, title in ((axes[0], 0.6 * a_crit, "Stable: alpha = 0.6 x critical"),
                             (axes[1], 1.08 * a_crit, "Unstable: alpha = 1.08 x critical")):
        traj = cournot_game.dynamic_adjustment(m, alpha, b0, 80)
        for i in range(m.n):
            ax.plot(traj[:, i], color=SERIES[i], lw=1.6, label=f"SO{i + 1} ({snr[i]:.0f} dB)")
            ax.axhline(b_ne[i], color=SERIES[i], lw=0.8, ls=":")
        ax.set(xlabel="Iteration t")
        ax.set_title(title)
    axes[0].set_ylabel("Spectrum requested b_i (MHz)")
    fig.legend(*axes[0].get_legend_handles_labels(), ncol=3, loc="lower center")
    fig.tight_layout(rect=(0, 0.08, 1, 1))
    save(fig, os.path.join(out, "fig05_cournot_dynamics.png"))

    alphas = np.linspace(0.3 * a_crit, 1.35 * a_crit, 500)
    pts_a, pts_b = [], []
    for a in alphas:
        traj = cournot_game.dynamic_adjustment(m, a, b0, 1500)
        tail = traj[-120:, 2]
        tail = tail[np.isfinite(tail)]
        pts_a += [a] * len(tail)
        pts_b += list(tail)
    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    ax.scatter(pts_a, pts_b, s=0.6, color=SERIES[0], alpha=0.6, lw=0)
    ax.axvline(a_crit, color=MUTED, ls="--", lw=1.2)
    label_end(ax, a_crit, max(pts_b) * 0.97, "stability boundary", dx=4)
    ax.set(xlabel="Learning rate alpha", ylabel="Long-run b_3 (MHz)")
    ax.set_title("Bifurcation diagram of the dynamic Cournot game")
    save(fig, os.path.join(out, "fig06_cournot_bifurcation.png"))
    return {"k": k.tolist(), "b_ne": b_ne.tolist(), "price_ne": float(m.price(b_ne)),
            "profit_ne": float(m.profits(b_ne).sum()), "b_collusion": b_co.tolist(),
            "price_collusion": float(m.price(b_co)), "profit_collusion": float(m.profits(b_co).sum()),
            "alpha_critical": float(a_crit)}


# ---------------------------------------------------------------------------
# Experiment 5 - Stackelberg leader-follower pricing
# ---------------------------------------------------------------------------
def exp_stackelberg(out, seed, drops):
    header("EXPERIMENT 5: Stackelberg game - primary MNO (leader) vs secondary users")
    m = stackelberg_game.random_market(5, capacity_mhz=100.0, cost=0.5, rng=seed)
    se = stackelberg_game.solve(m)
    print(f"  Idle spectrum W = {m.capacity_mhz:.0f} MHz, leader cost {m.cost}/MHz\n")
    table(["Follower", "w_i", "g_i", "b_i* (MHz)", "Utility"],
          [(f"SU{i + 1}", m.w[i], m.g[i], se.demand[i], se.follower_utility[i]) for i in range(m.n)],
          ["s", ".1f", ".3f", ".2f", ".2f"])
    print(f"\n  Stackelberg price p* = {se.price:.3f}/MHz, spectrum leased {se.demand.sum():.1f} MHz, "
          f"leader profit {se.leader_profit:.2f}, capacity binding: {se.capacity_binding}")

    prices = np.linspace(m.cost + 0.01, 8.0, 600)
    fig, axes = plt.subplots(1, 2, figsize=(9.6, 3.7))
    ax = axes[0]
    ax.plot(prices, [stackelberg_game.leader_profit(m, p) for p in prices], color=SERIES[0])
    ax.scatter([se.price], [se.leader_profit], color=SERIES[0], s=40, edgecolor="white", lw=1.2, zorder=3)
    ax.axvline(se.price, color=AXIS, lw=1)
    label_end(ax, se.price, se.leader_profit, f"p* = {se.price:.2f}", dx=6, dy=6)
    ax.set(xlabel="Price per MHz p", ylabel="Leader profit")
    ax.set_title("Leader: profit vs announced price")
    ax = axes[1]
    for i in range(m.n):
        ax.plot(prices, [stackelberg_game.follower_demand(m, p)[i] for p in prices],
                color=SERIES[i], lw=1.6, label=f"SU{i + 1}")
    ax.axvline(se.price, color=AXIS, lw=1)
    ax.set(xlabel="Price per MHz p", ylabel="Bandwidth demanded (MHz)", ylim=(0, None))
    ax.set_title("Followers: best-response demand")
    ax.legend(ncol=5, loc="upper center", bbox_to_anchor=(0.5, -0.2))
    fig.tight_layout()
    save(fig, os.path.join(out, "fig07_stackelberg.png"))

    sizes = [2, 4, 6, 8, 10, 15, 20, 25, 30]
    rng = np.random.default_rng(seed + 1)
    p_avg, prof_avg, util_avg, bind = [], [], [], []
    for n in sizes:
        rs = [stackelberg_game.solve(stackelberg_game.random_market(n, rng=rng)) for _ in range(drops)]
        p_avg.append(np.mean([r.price for r in rs]))
        prof_avg.append(np.mean([r.leader_profit for r in rs]))
        util_avg.append(np.mean([r.follower_utility.mean() for r in rs]))
        bind.append(np.mean([r.capacity_binding for r in rs]))
    print()
    table(["N users", "Price p*", "Profit", "Avg U_i", "Cap. bind"],
          list(zip(sizes, p_avg, prof_avg, util_avg, bind)), ["d", ".3f", ".1f", ".2f", ".0%"])

    fig, axes = plt.subplots(1, 2, figsize=(9.6, 3.5))
    axes[0].plot(sizes, p_avg, color=SERIES[0], marker="o", ms=6)
    axes[0].set(xlabel="Number of secondary users N", ylabel="Price per MHz")
    axes[0].set_title("Equilibrium price p*")
    axes[1].plot(sizes, prof_avg, color=SERIES[0], marker="o", ms=6)
    axes[1].set(xlabel="Number of secondary users N", ylabel="Profit")
    axes[1].set_title("Leader (primary MNO) profit")
    k_bind = next((j for j, v in enumerate(bind) if v >= 0.5), None)
    if k_bind is not None:
        for ax in axes:
            ax.axvspan(sizes[k_bind], sizes[-1], color=GRID, alpha=0.5, lw=0)
        label_end(axes[0], sizes[k_bind], min(p_avg), "capacity-limited", dx=4)
    fig.tight_layout()
    save(fig, os.path.join(out, "fig08_stackelberg_scaling.png"))
    return {"price": se.price, "leader_profit": se.leader_profit, "demand": se.demand.tolist(),
            "scaling": {"sizes": sizes, "price": p_avg, "profit": prof_avg, "binding": bind}}


# ---------------------------------------------------------------------------
# Experiment 6 - cooperative Nash bargaining between network slices
# ---------------------------------------------------------------------------
def exp_bargaining(out):
    header("EXPERIMENT 6: Nash bargaining - eMBB / URLLC / mMTC slices share 100 MHz")
    names = ["eMBB", "URLLC", "mMTC"]
    s = np.array([5.5, 3.0, 1.5])      # bit/s/Hz
    d = np.array([150.0, 40.0, 15.0])  # minimum rate, Mbps
    W = 100.0
    schemes = {
        "Nash bargaining": bargaining.nbs_closed_form(s, d, W),
        "Weighted NBS (URLLC x2)": bargaining.nbs_closed_form(s, d, W, [1, 2, 1]),
        "Equal split": bargaining.equal_split(s, d, W),
        "Proportional": bargaining.proportional_to_demand(s, d, W),
        "Max sum-rate": bargaining.max_sum_rate(s, d, W),
    }
    print("  Spectral efficiency (b/s/Hz): " + ", ".join(f"{n} {v}" for n, v in zip(names, s)))
    print("  Minimum rate (Mbps):          " + ", ".join(f"{n} {v:.0f}" for n, v in zip(names, d)) + "\n")
    rows, summary = [], {}
    for name, b in schemes.items():
        R = s * b
        gain = R - d
        nash_product = float(np.sum(np.log(np.maximum(gain, 1e-9))))
        fair = jain_fairness(R / d)
        fair_gain = jain_fairness(gain)
        rows.append((name.rjust(24), *b, R.sum(), fair, fair_gain, nash_product))
        summary[name] = {"bandwidth": b.tolist(), "rates": R.tolist(), "sum_rate": float(R.sum()),
                         "jain_satisfaction": fair, "jain_gain": fair_gain,
                         "log_nash_product": nash_product}
    table(["Scheme".rjust(24), "b eMBB", "b URLLC", "b mMTC", "Sum rate", "Jain(R/d)", "Jain(R-d)",
           "ln NashProd"], rows, ["s", ".1f", ".1f", ".1f", ".1f", ".3f", ".3f", ".2f"])

    fig, axes = plt.subplots(1, 2, figsize=(10, 3.9), gridspec_kw={"width_ratios": [1.5, 1]})
    ax = axes[0]
    labels = list(schemes)
    x = np.arange(len(labels))
    wbar = 0.26
    for j, nm in enumerate(names):
        vals = [schemes[k][j] for k in labels]
        ax.bar(x + (j - 1) * wbar, vals, wbar * 0.92, color=SERIES[j], label=nm)
    ax.set_xticks(x, [l.replace(" (", "\n(") for l in labels], fontsize=8)
    ax.set(ylabel="Bandwidth (MHz)")
    ax.set_title("Bandwidth allocated to each slice")
    ax.legend(ncol=3, loc="upper left")
    ax.grid(axis="x", visible=False)
    ax = axes[1]
    for k in labels:
        is_nbs = k.startswith("Nash")
        ax.scatter(summary[k]["sum_rate"], summary[k]["jain_gain"], s=70 if is_nbs else 44,
                   color=SERIES[0] if is_nbs else MUTED, edgecolor="white", lw=1.2, zorder=3)
        dx, dy, ha = {"Nash bargaining": (8, -12, "left"),
                      "Weighted NBS (URLLC x2)": (-6, 8, "right")}.get(k, (0, 9, "center"))
        ax.annotate(k, (summary[k]["sum_rate"], summary[k]["jain_gain"]), xytext=(dx, dy),
                    textcoords="offset points", ha=ha, fontsize=8,
                    color=INK if is_nbs else INK_2, fontweight="bold" if is_nbs else "normal")
    ax.set(xlabel="Sum rate (Mbps)", ylabel="Jain index of gains R_i - R_min,i",
           xlim=(300, 510), ylim=(0.2, 1.05))
    ax.set_title("Efficiency vs fairness trade-off")
    fig.tight_layout()
    save(fig, os.path.join(out, "fig09_bargaining.png"))
    return summary


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="results")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    sys.stdout = Tee(os.path.join(args.out, "console_output.txt"))
    apply_style()

    t0 = time.time()
    print("GAME-THEORETIC MODEL FOR SPECTRUM SHARING IN 5G/6G NETWORKS")
    print(f"seed = {args.seed}, output folder = {args.out}/")
    drops = 8 if args.quick else 40
    r1 = exp_power_reference(args.out, args.seed)
    r2 = exp_price_sweep(args.out, r1["net"])
    r3 = exp_density(args.out, args.seed, drops)
    r4 = exp_cournot(args.out)
    r5 = exp_stackelberg(args.out, args.seed, drops)
    r6 = exp_bargaining(args.out)

    summary = {"power_game": r1["summary"], "price_sweep": r2, "density": r3, "cournot": r4,
               "stackelberg": r5, "bargaining": r6}
    with open(os.path.join(args.out, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    header(f"Done in {time.time() - t0:.1f} s - figures and summary.json saved to {args.out}/")


if __name__ == "__main__":
    main()
