"""Builds the diagrams and console screenshots used in the report and slides.

    python tools/make_doc_assets.py      (run main.py first)
"""

import os
import subprocess
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")
INK, INK_2, MUTED = "#0b0b0b", "#52514e", "#898781"
BLUE, ORANGE, AQUA, YELLOW = "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
TINT = {BLUE: "#e3eefb", ORANGE: "#fde8df", AQUA: "#dcf3ea", YELLOW: "#fdf0d2", MUTED: "#efeeea"}


def box(ax, x, y, w, h, title, body="", color=BLUE):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.12",
                                fc=TINT[color], ec=color, lw=1.4))
    ax.text(x + w / 2, y + h - 0.22, title, ha="center", va="top", fontsize=10.5,
            fontweight="bold", color=INK)
    if body:
        ax.text(x + w / 2, y + h - 0.62, body, ha="center", va="top", fontsize=8.6,
                color=INK_2, linespacing=1.45)


def arrow(ax, a, b, color=MUTED, text=None, rad=0.0):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=13, lw=1.4,
                                 color=color, connectionstyle=f"arc3,rad={rad}"))
    if text:
        ax.text((a[0] + b[0]) / 2 + 0.08, (a[1] + b[1]) / 2, text, fontsize=8.2, color=INK_2,
                va="center")


def system_model():
    fig, ax = plt.subplots(figsize=(11, 6.2))
    ax.set(xlim=(0, 11), ylim=(0, 6.2))
    ax.axis("off")
    box(ax, 2.9, 4.7, 5.2, 1.3, "Primary MNO (licensed spectrum owner)",
        "3.5 GHz n78 band, idle capacity W MHz\nsets price / interference cap", BLUE)
    box(ax, 2.9, 2.75, 5.2, 1.25, "Spectrum manager / SAS",
        "collects bids, enforces prices,\nsolves for the equilibrium", MUTED)
    games = [
        (0.15, "Power-control game", "small cells reuse one carrier\nchoose p_i  |  price c per W", BLUE),
        (2.85, "Cournot game", "secondary operators choose\nb_i MHz  |  c(B)=x+yB", ORANGE),
        (5.55, "Stackelberg game", "leader price p, followers\nbest-respond b_i(p)", AQUA),
        (8.25, "Nash bargaining", "eMBB / URLLC / mMTC slices\nsplit W cooperatively", YELLOW),
    ]
    for x, t, b, c in games:
        box(ax, x, 0.45, 2.6, 1.35, t, b, c)
        arrow(ax, (5.5, 2.75), (x + 1.3, 1.8))
    arrow(ax, (5.5, 4.7), (5.5, 4.0), text="spectrum offer")
    ax.plot([0.15, 7.95], [0.3, 0.3], color=MUTED, lw=1)
    ax.plot([8.25, 10.85], [0.3, 0.3], color=MUTED, lw=1)
    ax.text(4.05, 0.08, "Non-cooperative games", ha="center", fontsize=9, color=INK_2, fontweight="bold")
    ax.text(9.55, 0.08, "Cooperative game", ha="center", fontsize=9, color=INK_2, fontweight="bold")
    fig.savefig(os.path.join(OUT, "system_model.png"), dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def methodology():
    steps = [("Scenario", "5G NR n78,\nsmall cells,\noperators, slices", BLUE),
             ("Channel", "3GPP UMi\npath loss,\nshadowing, fading", BLUE),
             ("Game model", "players,\nstrategies,\nutilities", ORANGE),
             ("Solver", "best response,\nbackward induction,\nconvex opt.", ORANGE),
             ("Verification", "unit tests check\nequilibrium\nconditions", AQUA),
             ("Evaluation", "sum rate, EE,\nfairness,\nprofit, PoA", AQUA)]
    fig, ax = plt.subplots(figsize=(13, 2.6))
    ax.set(xlim=(0, 13), ylim=(0, 2.6))
    ax.axis("off")
    w, gap = 1.9, 0.27
    for k, (t, b, c) in enumerate(steps):
        x = 0.05 + k * (w + gap)
        box(ax, x, 0.15, w, 1.95, f"{k + 1}. {t}", b, c)
        if k < len(steps) - 1:
            arrow(ax, (x + w + 0.02, 1.12), (x + w + gap - 0.02, 1.12))
    fig.savefig(os.path.join(OUT, "methodology.png"), dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def console_image(lines, path, title):
    """Render captured terminal text as a console-window screenshot."""
    width = max(len(l) for l in lines)
    h = 0.17 * len(lines) + 0.7
    fig = plt.figure(figsize=(0.083 * width + 0.6, h))
    fig.patch.set_facecolor("#1e1e1e")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.axis("off")
    ax.add_patch(plt.Rectangle((0, 1 - 0.35 / h), 1, 0.35 / h, transform=ax.transAxes, color="#323233"))
    ax.text(0.012, 1 - 0.175 / h, title, transform=ax.transAxes, color="#cccccc", fontsize=8.5,
            va="center", family="Segoe UI")
    for i, line in enumerate(lines):
        color = "#4ec9b0" if line.strip().startswith("EXPERIMENT") else (
            "#dcdcaa" if line.startswith(("PS ", "GAME-")) else "#d4d4d4")
        ax.text(0.012, 1 - (0.5 + 0.17 * i) / h, line, transform=ax.transAxes, color=color,
                fontsize=8.2, family="Consolas", va="top")
    fig.savefig(path, dpi=200, facecolor=fig.get_facecolor())
    plt.close(fig)


def consoles():
    with open(os.path.join(ROOT, "results", "console_output.txt"), encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f]
    prompt = r"PS C:\Users\Arnav Anand\Spectrum_Sharing_Game_Theory> python main.py"
    split = next(i for i, l in enumerate(lines) if "EXPERIMENT 4" in l) - 1
    console_image([prompt] + lines[:split], os.path.join(OUT, "console_1.png"),
                  "Windows PowerShell - python main.py (part 1)")
    console_image(lines[split:], os.path.join(OUT, "console_2.png"),
                  "Windows PowerShell - python main.py (part 2)")

    run = subprocess.run([sys.executable, "-m", "unittest", "tests.test_games", "-v"], cwd=ROOT,
                         capture_output=True, text=True)
    test_lines = [r"PS C:\Users\Arnav Anand\Spectrum_Sharing_Game_Theory> python -m unittest tests.test_games -v"]
    test_lines += [l for l in run.stderr.splitlines()]
    console_image(test_lines, os.path.join(OUT, "console_tests.png"),
                  "Windows PowerShell - unit tests")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    system_model()
    methodology()
    consoles()
    print("assets written to", OUT)
