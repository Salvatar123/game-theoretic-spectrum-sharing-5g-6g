const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, ShadingType, PageBreak,
  TableOfContents, Header, Footer, PageNumber, TabStopType, VerticalAlign,
} = require("docx");

const ROOT = "C:/Users/Arnav Anand/Spectrum_Sharing_Game_Theory";
const RES = path.join(ROOT, "results");
const ASSETS = path.join(ROOT, "docs", "assets");
const S = JSON.parse(fs.readFileSync(path.join(RES, "summary.json"), "utf8"));
const consoleLines = fs.readFileSync(path.join(RES, "console_output.txt"), "utf8").split(/\r?\n/);

const CONTENT_W = 9026; // A4 width minus 1" margins, in DXA
const ACCENT = "1F4E79";
const LIGHT = "DCE8F5";
const f1 = (x) => Number(x).toFixed(1);
const f2 = (x) => Number(x).toFixed(2);
const f3 = (x) => Number(x).toFixed(3);

// ---------- helpers ----------
function runs(text, base = {}) {
  // **bold** and _italic_ markup
  const out = [];
  const re = /(\*\*[^*]+\*\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (text, opts = {}) => new Paragraph({
  children: runs(text), alignment: AlignmentType.JUSTIFIED, spacing: { after: 140, line: 300 }, ...opts,
});
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: true });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const H3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
const bullet = (text, level = 0) => new Paragraph({
  children: runs(text), numbering: { reference: "bullets", level }, spacing: { after: 80, line: 290 },
});
let numRef = 0;
function numbered(items) {
  const ref = `num${numRef++}`;
  numberingConfigs.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
  });
  return items.map((t) => new Paragraph({ children: runs(t), numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 290 } }));
}
const eq = (text, label) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 80, after: 160 },
  tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
  children: [new TextRun({ text, font: "Cambria Math", italics: true, size: 23 }),
    ...(label ? [new TextRun({ text: `\t(${label})`, font: "Calibri", size: 21 })] : [])],
});
function code(lines) {
  return lines.map((l, i) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: "F3F3F1", color: "auto" },
    spacing: { after: 0, before: i === 0 ? 80 : 0, line: 250 }, keepNext: i < lines.length - 1, keepLines: true,
    indent: { left: 120, right: 120 },
    children: [new TextRun({ text: l || " ", font: "Consolas", size: 17, color: "1E1E1E" })],
  })).concat([new Paragraph({ spacing: { after: 120 }, children: [] })]);
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b };
}
let figNo = 0, tabNo = 0;
function figure(file, widthIn, caption) {
  const { w, h, data } = pngSize(file);
  const W = widthIn * 96, H = W * h / w;
  figNo++;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true,
      children: [new ImageRun({ type: "png", data, transformation: { width: W, height: H },
        altText: { title: `Figure ${figNo}`, description: caption, name: `fig${figNo}` } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 },
      children: [new TextRun({ text: `Figure ${figNo}: `, bold: true, size: 19, color: "404040" }),
        new TextRun({ text: caption, italics: true, size: 19, color: "404040" })] }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(headers, rows, widths, caption, opts = {}) {
  tabNo++;
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, i, head, hl) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER,
    shading: head ? { type: ShadingType.CLEAR, fill: ACCENT, color: "auto" }
      : hl ? { type: ShadingType.CLEAR, fill: LIGHT, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ keepNext: rows.length <= 12, alignment: i === 0 && !opts.centerFirst ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [new TextRun({ text: String(text), bold: head || hl, size: 19, color: head ? "FFFFFF" : "000000" })] })],
  });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true,
      children: [new TextRun({ text: `Table ${tabNo}: `, bold: true, size: 19, color: "404040" }),
        new TextRun({ text: caption, italics: true, size: 19, color: "404040" })] }),
    new Table({
      width: { size: total, type: WidthType.DXA }, columnWidths: widths, alignment: AlignmentType.CENTER,
      rows: [new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, true)) }),
        ...rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, i, false, opts.highlight && opts.highlight(r))) }))],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

// ---------- data pulled from the program output ----------
const pg = S.power_game;
const NE = pg["Nash eq. (priced)"], FLAT = pg["No pricing (P_max)"], OPT = pg["Social optimum"];
const linkStart = consoleLines.findIndex((l) => l.trim().startsWith("Link"));
const linkRows = consoleLines.slice(linkStart + 2, linkStart + 8).map((l) => l.trim().split(/\s+/));
const ps = S.price_sweep;
const D = S.density, CO = S.cournot, ST = S.stackelberg, BA = S.bargaining;
const gainPct = ((NE.sum_rate_mbps / FLAT.sum_rate_mbps - 1) * 100).toFixed(1);
const eeNE = NE.sum_rate_mbps / (NE.total_power_w + 0.6), eeFlat = FLAT.sum_rate_mbps / (FLAT.total_power_w + 0.6);
const neShare = D.ne_rate.map((r, i) => r / D.opt_rate[i]);
const overFlat = D.ne_rate.map((r, i) => r / D.flat_rate[i] - 1);
const pct = (x) => `${Math.round(x * 100)}%`;
const minmax = (a) => [Math.min(...a), Math.max(...a)];
const numberingConfigs = [{
  reference: "bullets",
  levels: [
    { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
    { level: 1, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
  ],
}];

const members = [
  ["Arnav Anand", "2427030154"],
  ["Aniket Mohanty", "2427030143"],
  ["Aneesh Srivastava", "2427030086"],
  ["Nihit Karanjawala", "2427030145"],
  ["Shree Ganesh Manikandan", "2427030121"],
];

// ---------- cover ----------
const cover = [
  new Paragraph({ spacing: { before: 1400, after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "PROJECT REPORT", size: 26, bold: true, color: "7F7F7F", characterSpacing: 60 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [new TextRun({ text: "Game-Theoretic Model for Spectrum Sharing", font: "Cambria", size: 46, bold: true, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 },
    children: [new TextRun({ text: "in 5G/6G Networks", font: "Cambria", size: 46, bold: true, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 },
    children: [new TextRun({ text: "Implementation in Python with power-control, Cournot, Stackelberg and Nash-bargaining models",
      italics: true, size: 24, color: "404040" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [new TextRun({ text: "Submitted by", size: 22, bold: true, color: "404040" })] }),
  new Table({
    width: { size: 6000, type: WidthType.DXA }, columnWidths: [700, 3300, 2000], alignment: AlignmentType.CENTER,
    rows: [["S. No.", "Name", "Roll Number"], ...members.map((m, i) => [String(i + 1), ...m])].map((r, ri) =>
      new TableRow({ children: r.map((t, ci) => new TableCell({
        width: { size: [700, 3300, 2000][ci], type: WidthType.DXA }, borders,
        shading: ri === 0 ? { type: ShadingType.CLEAR, fill: ACCENT, color: "auto" } : undefined,
        margins: { top: 70, bottom: 70, left: 120, right: 120 },
        children: [new Paragraph({ alignment: ci === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: t, size: 22, bold: ri === 0, color: ri === 0 ? "FFFFFF" : "000000" })] })],
      })) })),
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1000 },
    children: [new TextRun({ text: "October 2026", size: 22, color: "404040" })] }),
];

// ---------- body ----------
const body = [];
const add = (...xs) => xs.forEach((x) => (Array.isArray(x) ? body.push(...x) : body.push(x)));

add(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Abstract")] }));
add(P("Radio spectrum is the scarcest resource in mobile communication. 5G New Radio and the coming 6G systems promise much higher data rates, ultra-reliable low-latency links and massive machine connectivity, but the licensed bands that carry them are already heavily allocated and, at any given place and time, often under-used. **Dynamic spectrum sharing** lets several users and operators use the same band. Because each of them acts in its own interest, the interaction is naturally modelled as a **game**."));
add(P(`This project builds a Python framework that models spectrum sharing in 5G/6G networks with four complementary game-theoretic models: (i) a non-cooperative **power-control game with interference pricing** for co-channel small cells; (ii) a **Cournot game** in which secondary operators compete for spectrum leased from a primary operator; (iii) a **Stackelberg leader-follower game** in which the primary operator sets a price and secondary users respond; and (iv) a cooperative **Nash bargaining** model that divides a band between eMBB, URLLC and mMTC network slices. The channel follows the 3GPP TR 38.901 Urban-Micro model at 3.5 GHz. Every equilibrium is computed numerically and checked against its formal definition by 14 automated tests.`));
add(P(`Key results: best-response dynamics reach the Nash equilibrium in ${pg.iterations} rounds; interference pricing raises the network sum rate by ${gainPct}% and the energy efficiency by ${(eeNE / eeFlat).toFixed(1)}x compared with every cell transmitting at full power, and up to ${(ps.best_ee / ps.flat_ee).toFixed(1)}x at the most efficient price. The selfish equilibrium reaches ${pct(minmax(neShare)[0])}–${pct(minmax(neShare)[1])} of the centrally optimal sum rate. In the Cournot market, competition lowers total operator profit from ${f1(CO.profit_collusion)} (collusion) to ${f1(CO.profit_ne)}, and adaptive bidding is stable only for learning rates below ${f3(CO.alpha_critical)}. In the Stackelberg market the equilibrium price stays near ${f2(ST.price)} per MHz until demand saturates the band, then rises steeply. The Nash bargaining solution gives a balanced compromise between maximum throughput and equal sharing.`));
add(P("**Keywords:** dynamic spectrum sharing, game theory, Nash equilibrium, Stackelberg game, Cournot competition, Nash bargaining, 5G, 6G, network slicing, cognitive radio."));

add(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Table of Contents")] }));
add(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }));

// 1 Introduction
add(H1("1. Introduction"));
add(H2("1.1 Background"));
add(P("Mobile data traffic keeps growing, and every new generation of cellular technology needs more bandwidth. 5G NR operates in sub-6 GHz bands such as n78 (3.3–3.8 GHz) and in millimetre-wave bands; 6G research targets the upper mid-band (7–24 GHz) and sub-terahertz frequencies. Measurements, however, repeatedly show that licensed spectrum is poorly used in time and space: a band that is congested in a city centre at noon may be almost idle in the suburbs at night."));
add(P("**Dynamic Spectrum Sharing (DSS)** addresses this by letting several parties use the same frequencies under rules that control interference. Examples already deployed include LTE–NR dynamic spectrum sharing, the three-tier Citizens Broadband Radio Service (CBRS) in the USA with its Spectrum Access System (SAS), Licensed Shared Access (LSA) in Europe and local licences for private 5G networks. 6G is expected to make sharing native, with AI-driven spectrum management, sharing between terrestrial and non-terrestrial networks, and spectrum allocated per network slice."));
add(H2("1.2 Why game theory?"));
add(P("Spectrum sharing involves several decision makers: primary operators, secondary operators, small cells, network slices and end users. Their objectives conflict. One user's transmit power is another's interference, and one operator's leased bandwidth is unavailable to its competitors. Game theory is the mathematics of interacting rational decision makers, so it is a natural fit:"));
add(bullet("**Players** are the radios, cells, operators or slices."));
add(bullet("**Strategies** are their choices: transmit power, bandwidth requested, price announced."));
add(bullet("**Utilities** capture what each player wants: throughput, profit or quality of service, minus costs."));
add(bullet("An **equilibrium** is a stable outcome from which no player wants to deviate. It predicts how a distributed system will behave without a central controller."));
add(P("Non-cooperative games describe selfish, distributed behaviour. Hierarchical (Stackelberg) games describe a spectrum owner that moves first. Cooperative bargaining describes parties that agree on a fair division. This project implements one model from each family and compares them in 5G/6G scenarios."));

// 2 Problem statement
add(H1("2. Problem Statement"));
add(P("Given a limited shared band and several self-interested users or operators in a 5G/6G network, **how should spectrum and transmit power be allocated so that the outcome is efficient (high throughput and energy efficiency), fair, profitable for the spectrum owner, and stable, without requiring a central controller that knows everything?**"));
add(P("The problem has four concrete instances, each studied in this project:"));
add(numbered([
  "**Co-channel interference:** small cells that reuse one carrier interfere with each other. If each one transmits at maximum power, everyone suffers. What power levels emerge, and can a price on interference steer them to a better outcome?",
  "**Competition for leased spectrum:** several secondary operators buy bandwidth from a primary operator whose price rises with total demand. How much does each one buy, how far is competition from the cooperative optimum, and does adaptive bidding converge?",
  "**Pricing by the spectrum owner:** a primary operator with idle spectrum wants to maximise revenue, knowing how secondary users will react. What price should it set, and how does this change as demand grows?",
  "**Fair sharing between slices:** eMBB, URLLC and mMTC slices with minimum rate guarantees must share one band. What allocation is both efficient and fair?",
]));

// 3 Objectives
add(H1("3. Objectives"));
add(numbered([
  "Study the spectrum-sharing problem in 5G/6G networks and the game-theoretic tools used to model it.",
  "Build a realistic radio environment: 3GPP TR 38.901 UMi path loss at 3.5 GHz, log-normal shadowing, Rayleigh fading and thermal noise.",
  "Formulate and implement four game models: a pricing-based power-control game, a Cournot spectrum market, a Stackelberg pricing game and a Nash bargaining slice-sharing model.",
  "Implement algorithms that compute their equilibria (best-response dynamics, backward induction and constrained optimisation) and prove correctness with automated tests.",
  "Evaluate the equilibria using sum rate, energy efficiency, Jain's fairness index, operator profit and the Price of Anarchy, against baselines such as full-power transmission, equal split and centralised optimisation.",
  "Study the stability of learning dynamics and the effect of network density and market size.",
  "Discuss practical applications in 5G/6G spectrum management.",
]));

// 4 Literature
add(H1("4. Literature Review"));
add(P("**Cognitive radio and DSS.** Mitola and Maguire [1] introduced cognitive radio: radios that sense their environment and adapt. Haykin [2] framed spectrum access by cognitive radios as a multi-user problem and pointed to game theory for modelling the interaction between secondary users. These ideas underlie today's CBRS and LSA frameworks [10]."));
add(P("**Power control and pricing.** Yates [4] showed that power-control iterations built on a standard interference function (positive, monotone and scalable) converge to a unique fixed point. Saraydar, Mandayam and Goodman [5] showed that the Nash equilibrium of selfish power control is inefficient and that a linear price on transmit power yields a Pareto improvement. This project's power game follows this line."));
add(P("**Spectrum markets.** Niyato and Hossain [3] modelled several secondary services buying spectrum from a primary service as a Cournot oligopoly. They derived the Nash equilibrium, showed that it is less profitable than collusion, and analysed the stability of a dynamic, bounded-rationality version of the game. Yaïche, Mazumdar and Rosenberg [13] used bargaining and pricing to allocate bandwidth fairly. Monderer and Shapley [15] defined potential games, a class to which linear Cournot games belong, which guarantees that best-response dynamics converge."));
add(P("**Hierarchical games and bargaining.** The Stackelberg model [16] describes a leader that commits to a strategy before followers respond, and is widely used for spectrum pricing by license holders [7]. Nash's bargaining solution [6] is the unique allocation satisfying Pareto optimality, symmetry, scale invariance and independence of irrelevant alternatives. In networking it corresponds to proportional fairness of the gains above the disagreement point."));
add(P("**Evaluation.** Jain's index [11] measures fairness; the Price of Anarchy [12] measures how much welfare is lost when players act selfishly. Han et al. [7] survey the application of these tools to wireless networks, and Saad, Bennis and Chen [14] identify intelligent spectrum management as a core 6G research problem."));

// 5 Methodology
add(H1("5. System Model and Methodology"));
add(H2("5.1 Overall system model"));
add(P("Figure 1 shows the system considered. A primary mobile network operator (MNO) holds a licensed 5G band (n78, 3.5 GHz). A spectrum manager, playing the role of a CBRS Spectrum Access System or an operator's AI spectrum controller, sets the rules of interaction. Four sharing situations sit beneath it: three non-cooperative games and one cooperative game."));
add(figure(path.join(ASSETS, "system_model.png"), 6.2, "System model: one licensed band, a spectrum manager and four sharing games"));
add(H2("5.2 Methodology"));
add(P("The project follows the six-step workflow shown in Figure 2. For each scenario we define the players, their strategies and their utilities. We then derive the best response analytically and compute the equilibrium numerically. Each equilibrium is verified against its definition and compared with non-game baselines."));
add(figure(path.join(ASSETS, "methodology.png"), 6.3, "Methodology followed in the project"));
add(H2("5.3 Radio channel model"));
add(P("The path loss between a transmitter and a receiver at distance d (metres) uses the 3GPP TR 38.901 Urban-Micro street-canyon line-of-sight model [8], with carrier frequency fc in GHz:"));
add(eq("PL(d) = 32.4 + 21 log10(d) + 20 log10(fc)   [dB]", "1"));
add(P("To this we add log-normal shadowing (σ = 4 dB) and Rayleigh small-scale fading (an exponentially distributed power gain). The noise power over bandwidth B is N0 = −174 dBm/Hz + 10 log10(B) + NF, with a noise figure NF of 7 dB. This gives −94 dBm for a 20 MHz carrier. For the operator-level games, the spectral efficiency of adaptive M-QAM at a target bit-error rate is taken from Goldsmith and Chua [9]:"));
add(eq("k = log2(1 + K·SNR),   K = 1.5 / ln(0.2 / BER)", "2"));

add(H2("5.4 Model A: power-control game with interference pricing"));
add(P("**Players:** N small-cell links that reuse one 20 MHz carrier. **Strategy:** transmit power p_i ∈ [0, P_max], with P_max = 1 W. **Utility:** throughput minus a price c (Mbps per watt) on the power used, which represents the interference that power imposes on others:"));
add(eq("u_i(p_i, p_−i) = B log2(1 + SINR_i) − c·p_i,    SINR_i = G_ii p_i / (Σ_j≠i G_ij p_j + N0)", "3"));
add(P("Setting ∂u_i/∂p_i = 0 gives a closed-form best response, a form of water-filling:"));
add(eq("BR_i(p_−i) = [ B / (c ln 2) − (I_i + N0) / G_ii ] clipped to [0, P_max]", "4"));
add(P("This best response is a standard interference function, so by Yates' theorem [4] the iteration p ← BR(p) converges to a **unique Nash equilibrium** from any starting point. As a benchmark, the **social optimum** maximises Σ u_i with a multi-start L-BFGS-B optimiser using an analytic gradient. The **Price of Anarchy** is PoA = W_opt / W_NE."));

add(H2("5.5 Model B: Cournot competition for leased spectrum"));
add(P("**Players:** N secondary operators. **Strategy:** the amount of spectrum b_i (MHz) bought from the primary operator. The primary charges a price that rises with total demand B = Σ b_i, namely c(B) = x + yB. Operator i earns revenue r per Mbps and has spectral efficiency k_i, so its profit is"));
add(eq("π_i = r·k_i·b_i − b_i·(x + y·B)", "5"));
add(eq("BR_i = max{0, (r·k_i − x − y·B_−i) / (2y)},    B* = (r Σk − N x) / (y (N + 1))", "6"));
add(P("Because the linear Cournot game is a potential game [15], sequential best response converges to the Nash equilibrium. We also implement the **dynamic game** of [3], in which operators only observe their marginal profit and adapt as b_i(t+1) = b_i(t) + α b_i(t) ∂π_i/∂b_i. Linearising this map around the equilibrium gives the stability limit α < 2 / λ_max(y·diag(b*)(I + 11ᵀ)). The collusion optimum (maximising Σ π_i) is used as the benchmark."));

add(H2("5.6 Model C: Stackelberg spectrum pricing"));
add(P("**Leader:** the primary MNO, which has W = 100 MHz of idle spectrum and an opportunity cost c = 0.5 per MHz. **Followers:** N secondary users (private networks, IoT or D2D clusters), each with valuation w_i and channel quality g_i. Follower i chooses b_i to maximise"));
add(eq("U_i(b_i) = w_i ln(1 + g_i b_i) − p·b_i    ⇒    b_i*(p) = max{0, w_i/p − 1/g_i}", "7"));
add(P("The leader anticipates these responses (backward induction) and solves"));
add(eq("max_p  (p − c) Σ b_i*(p)   subject to   Σ b_i*(p) ≤ W", "8"));
add(P("The solver applies the capacity constraint by finding the market-clearing price with Brent's method. It then performs a grid search on p followed by bounded scalar refinement. Within each active set of followers the leader's profit is concave in p, so the refined maximum is global."));

add(H2("5.7 Model D: Nash bargaining between network slices"));
add(P("Three slices share W = 100 MHz: eMBB (spectral efficiency 5.5 bit/s/Hz, minimum rate 150 Mbps), URLLC (3.0 bit/s/Hz, 40 Mbps, using a robust MCS) and mMTC (1.5 bit/s/Hz, 15 Mbps). The minimum rates d_i form the disagreement point. The weighted Nash Bargaining Solution with bargaining powers a_i is"));
add(eq("max Σ a_i ln(s_i b_i − d_i)   s.t.  Σ b_i = W     ⇒     b_i = d_i/s_i + (a_i / Σa)(W − Σ d_j/s_j)", "9"));
add(P("Each slice first receives the bandwidth needed for its guarantee, and the surplus is divided in proportion to bargaining power. The closed form is cross-checked against a numerical SLSQP solution and compared with equal split, demand-proportional split and maximum sum-rate allocation."));

add(H2("5.8 Performance metrics"));
add(table(["Metric", "Definition", "Meaning"], [
  ["Sum rate", "Σ R_i (Mbps)", "Total throughput"],
  ["Energy efficiency", "Σ R_i / (Σ p_i + N·0.1 W)", "Mbit delivered per joule, including circuit power"],
  ["Jain's index", "(Σ x_i)² / (N Σ x_i²)", "1 = perfectly fair, 1/N = one user gets all"],
  ["Price of Anarchy", "W_opt / W_NE", "Welfare lost by selfish behaviour (1 = none)"],
  ["Profit", "Revenue − cost", "Operator incentive to share"],
], [1900, 3300, 3826], "Performance metrics used in the evaluation"));

// 6 Implementation
add(H1("6. Implementation"));
add(H2("6.1 Tools and environment"));
add(table(["Item", "Used"], [
  ["Language", "Python 3.13"],
  ["Numerical computing", "NumPy (vectorised channel and SINR computation)"],
  ["Optimisation", "SciPy: L-BFGS-B, SLSQP, Brent's method, bounded scalar search"],
  ["Visualisation", "Matplotlib (colour-blind-safe palette)"],
  ["Testing", "Python unittest (14 tests)"],
  ["Platform", "Windows 11, VS Code"],
], [2600, 6426], "Software tools"));
add(H2("6.2 Project structure"));
add(table(["File", "Purpose"], [
  ["spectrum_game/channel.py", "3GPP UMi path loss, shadowing, fading, noise; random small-cell deployment; M-QAM spectral efficiency"],
  ["spectrum_game/power_game.py", "Power-control game: SINR, utilities, best response, Nash solver (Gauss-Seidel / Jacobi), social optimum"],
  ["spectrum_game/cournot_game.py", "Cournot market, best response, closed-form equilibrium, collusion, dynamic game, stability threshold"],
  ["spectrum_game/stackelberg_game.py", "Follower demand, leader profit, backward-induction solver with capacity constraint"],
  ["spectrum_game/bargaining.py", "Weighted Nash bargaining (closed form and numerical) and baseline allocations"],
  ["spectrum_game/metrics.py", "Jain's fairness, Price of Anarchy, energy efficiency"],
  ["spectrum_game/plotting.py", "Shared figure style"],
  ["main.py", "Runs the six experiments, prints tables, saves figures and summary.json"],
  ["tests/test_games.py", "Verifies every equilibrium against its definition"],
  ["tools/make_doc_assets.py", "Generates diagrams and console screenshots for this report"],
], [3200, 5826], "Source files"));
add(H2("6.3 Key algorithms"));
add(H3("Best-response dynamics (power game)"));
add(P("Each link computes its best response from the interference it currently measures (equation 4). Links update in turn (Gauss-Seidel) until no power changes by more than 10⁻¹⁰ W. The core of the implementation is vectorised over all links:"));
add(code([
  "def best_response(p, net, price, p_max):",
  "    if price <= 0:",
  "        return np.full(net.n, p_max)",
  "    target = net.bandwidth_mhz / (price * LN2)",
  "    return np.clip(target - interference_plus_noise(p, net) / np.diag(net.gains),",
  "                   0.0, p_max)",
  "",
  "def solve_nash(net, price, p_max=1.0, p0=None, tol=1e-10, max_iter=1000, sequential=True):",
  "    p = np.full(net.n, p_max) if p0 is None else np.array(p0, dtype=float)",
  "    for it in range(1, max_iter + 1):",
  "        prev = p.copy()",
  "        for i in range(net.n):                     # Gauss-Seidel sweep",
  "            p[i] = best_response(p, net, price, p_max)[i]",
  "        if np.max(np.abs(p - prev)) < tol:          # no player wants to move",
  "            break",
]));
add(H3("Backward induction (Stackelberg game)"));
add(code([
  "def follower_demand(market, p):",
  "    return np.maximum(0.0, market.w / p - 1.0 / market.g)",
  "",
  "def solve(market):",
  "    p_lo = max(market.cost, 1e-6)",
  "    if follower_demand(market, p_lo).sum() > market.capacity_mhz:   # capacity binds",
  "        p_lo = brentq(lambda p: follower_demand(market, p).sum() - market.capacity_mhz,",
  "                      p_lo, market.max_price)",
  "    grid = np.linspace(p_lo, market.max_price, 4000)              # leader's search",
  "    ...  # refine the best grid point with minimize_scalar(method='bounded')",
]));
add(H3("Nash bargaining (closed form)"));
add(code([
  "def nbs_closed_form(s, d, W, weights=None):",
  "    a = np.ones_like(s) if weights is None else np.asarray(weights, float)",
  "    base = d / s                       # bandwidth that meets each minimum rate",
  "    surplus = W - base.sum()",
  "    return base + a / a.sum() * surplus",
]));
add(H2("6.4 Verification"));
add(P("An equilibrium solver is only useful if its output really is an equilibrium. The test suite (Figure 14) therefore checks the definitions directly, not only that the code runs:"));
add(bullet("**Power game:** at the computed point no link can raise its utility by any unilateral change of power (checked on a 2001-point grid); the same equilibrium is reached from zero power, full power and with simultaneous updates (uniqueness); the social optimum is never worse than the equilibrium."));
add(bullet("**Cournot:** the iterative solution equals the closed form; all first-order conditions are zero; the dynamic game converges below the computed stability limit and does not converge above it; collusion earns more than competition."));
add(bullet("**Stackelberg:** every follower's demand maximises its utility; no feasible price gives the leader more profit (checked on a 20,000-point grid); the capacity constraint is respected."));
add(bullet("**Bargaining:** the closed form matches SLSQP to within 10⁻³ MHz for equal and unequal bargaining powers; the whole band is used and every minimum rate is met."));
add(H2("6.5 How to run"));
add(code([
  "pip install -r requirements.txt",
  "python main.py                       # all experiments -> results/",
  "python -m unittest tests.test_games -v",
  "python tools/make_doc_assets.py      # diagrams and screenshots -> docs/assets/",
]));

// 7 Results
add(H1("7. Results and Discussion"));
add(H2("7.1 Experiment 1: power-control equilibrium"));
add(P("Six small-cell links were dropped at random in a 300 m × 300 m area (Figure 3), with an interference price of c = 40 Mbps/W. Starting from zero power, best-response dynamics converged in " + pg.iterations + " rounds (Figure 4)."));
add(figure(path.join(RES, "fig01_topology.png"), 3.9, "Random deployment of six co-channel small-cell links (triangles: transmitters, circles: users)"));
add(figure(path.join(RES, "fig02_power_convergence.png"), 5.2, "Best-response dynamics converge to the Nash equilibrium within a few rounds"));
add(table(["Link", "d (m)", "p* (W)", "SINR (dB)", "Rate at NE (Mbps)", "Rate at P_max (Mbps)", "Net utility"],
  linkRows.map((r) => r), [900, 1000, 1100, 1200, 1700, 1800, 1326], "Nash equilibrium of the power-control game (c = 40 Mbps/W)"));
add(P(`Two links (SC5 and SC6) choose zero power at equilibrium: their own channel is too weak relative to the interference they receive for transmission to be worth the price. Removing their interference lets SC2 and SC4 increase their rates from 65.7 and 75.2 Mbps to 110.9 and 103.5 Mbps. Table 5 compares the outcomes.`));
add(table(["Scheme", "Sum rate (Mbps)", "Total power (W)", "Energy eff. (Mbit/J)", "Jain index"], [
  ["Nash equilibrium (priced)", f1(NE.sum_rate_mbps), f3(NE.total_power_w), f1(eeNE), f3(NE.jain)],
  ["No pricing (all at P_max)", f1(FLAT.sum_rate_mbps), f3(FLAT.total_power_w), f1(eeFlat), f3(FLAT.jain)],
  ["Social optimum", f1(OPT.sum_rate_mbps), f3(OPT.total_power_w), f1(OPT.sum_rate_mbps / (OPT.total_power_w + 0.6)), f3(OPT.jain)],
], [2900, 1500, 1500, 1700, 1426], "Comparison of power-allocation schemes", { highlight: (r) => r[0].startsWith("Nash") }));
add(P(`With pricing, the selfish equilibrium delivers **${gainPct}% more throughput** while using **${(100 * (1 - NE.total_power_w / FLAT.total_power_w)).toFixed(0)}% less power** than the unpriced network. Energy efficiency therefore improves about ${(eeNE / eeFlat).toFixed(1)}x. The centralised optimum is better still, but it achieves this by switching weak links almost completely off, which gives the lowest fairness of the three schemes (Jain ${f3(OPT.jain)}). The Price of Anarchy for this drop is ${f3(pg.price_of_anarchy)}.`));

add(H2("7.2 Experiment 2: effect of the interference price"));
add(figure(path.join(RES, "fig03_price_sweep.png"), 6.2, "Sum rate, power, energy efficiency and fairness at equilibrium as the interference price varies"));
add(P("Figure 5 sweeps the price from 1 to 10⁶ Mbps/W and shows three regimes:"));
add(bullet("**Low price (c < 10):** almost every link transmits at full power; the outcome is close to the unpriced network."));
add(bullet("**Moderate price (10 < c < 10⁴):** weak, interference-generating links drop out and the remaining powers scale down together. Because the network is interference-limited, scaling all powers down by the same factor leaves the SINR unchanged, so the sum rate holds at its maximum while power falls by orders of magnitude."));
add(bullet(`**Very high price (c > 10⁵):** signals approach the noise floor and the rate collapses. Energy efficiency peaks at c ≈ ${Math.round(ps.best_price)} Mbps/W with ${f1(ps.best_ee)} Mbit/J, which is **${(ps.best_ee / ps.flat_ee).toFixed(1)}x** the unpriced network, while still delivering ${f1(ps.sum_rate_at_best)} Mbps.`));
add(P("The price is therefore a single control knob that a spectrum manager can use to move the network along the throughput–energy trade-off without dictating individual power levels."));

add(H2("7.3 Experiment 3: network density (Monte Carlo)"));
add(P(`For each network size N from 2 to 12, 40 random deployments were simulated (Figure 6, Table 6).`));
add(figure(path.join(RES, "fig04_density.png"), 6.2, "Average sum rate and Price of Anarchy versus number of co-channel links (40 drops per point)"));
add(table(["N", "Sum rate NE", "Sum rate P_max", "Sum rate optimum", "NE / optimum", "PoA", "BR rounds"],
  D.sizes.map((n, i) => [n, f1(D.ne_rate[i]), f1(D.flat_rate[i]), f1(D.opt_rate[i]), pct(neShare[i]), f3(D.poa[i]), f1(D.iters[i])]),
  [700, 1350, 1450, 1600, 1350, 1100, 1476], "Monte Carlo results (mean over 40 deployments, sum rates in Mbps)", { centerFirst: true }));
add(P(`At every density the priced Nash equilibrium beats full-power transmission by ${pct(minmax(overFlat)[0])}–${pct(minmax(overFlat)[1])} and reaches ${pct(minmax(neShare)[0])}–${pct(minmax(neShare)[1])} of the optimal sum rate. Full-power transmission saturates as cells are added because the extra interference cancels the extra transmitters. The Price of Anarchy stays roughly constant between 1.9 and 2.3, so the cost of decentralisation does not grow with density. Convergence takes a few to about 25 rounds, which is fast enough for frame-level operation.`));

add(H2("7.4 Experiment 4: Cournot spectrum market"));
add(P("Three secondary operators with SNRs of 14, 16 and 18 dB (BER target 10⁻⁴) buy spectrum at price c(B) = 2 + B per MHz, with revenue r = 10 per Mbps."));
add(table(["Operator", "SNR (dB)", "k (bit/s/Hz)", "b* at NE (MHz)", "b under collusion (MHz)"],
  CO.k.map((k, i) => [`SO${i + 1}`, [14, 16, 18][i], f3(k), f3(CO.b_ne[i]), f3(CO.b_collusion[i])]),
  [1600, 1500, 1800, 2000, 2126], "Cournot equilibrium versus collusion"));
add(P(`At the Nash equilibrium the operators buy ${f2(CO.b_ne.reduce((a, b) => a + b, 0))} MHz in total at ${f2(CO.price_ne)} per MHz, earning a combined profit of ${f1(CO.profit_ne)}. If they colluded, all spectrum would go to the most efficient operator (SO3); less spectrum would be bought, the price would fall to ${f2(CO.price_collusion)} and the combined profit would rise to ${f1(CO.profit_collusion)}. This is the classic inefficiency of Cournot competition: each operator overbuys because it ignores the price increase it causes for the others. The iterative solver matches the closed-form solution (equation 6) to 10⁻⁸.`));
add(figure(path.join(RES, "fig05_cournot_dynamics.png"), 6.2, "Adaptive bidding: convergence below the stability limit, oscillation above it (dotted lines mark the equilibrium)"));
add(figure(path.join(RES, "fig06_cournot_bifurcation.png"), 5.0, "Bifurcation diagram: period doubling and chaos as the learning rate increases"));
add(P(`Figures 7 and 8 show the bounded-rationality dynamic game. The analytical stability limit is α* = ${f3(CO.alpha_critical)}. Below it, bids converge to the Nash equilibrium. Just above it they oscillate in a 2-cycle. Further increases cause repeated period doubling and finally chaos. In practice, operators (or AI agents) that adapt their spectrum requests too aggressively destabilise the market, so the adaptation rate must be limited.`));

add(H2("7.5 Experiment 5: Stackelberg pricing"));
add(figure(path.join(RES, "fig07_stackelberg.png"), 6.2, "Leader profit versus price (left) and followers' best-response demand (right)"));
add(table(["Follower", "Spectrum bought (MHz)"],
  ST.demand.map((b, i) => [`SU${i + 1}`, f2(b)]).concat([["Total", f2(ST.demand.reduce((a, b) => a + b, 0))]]),
  [3000, 3000], "Stackelberg equilibrium with five secondary users (W = 100 MHz)", { centerFirst: true, highlight: (r) => r[0] === "Total" }));
add(P(`With five followers the leader's profit is concave in price and peaks at an optimal price of **${f2(ST.price)} per MHz**, giving a profit of ${f1(ST.leader_profit)}. Followers with higher valuation and better channels buy more. Only ${f1(ST.demand.reduce((a, b) => a + b, 0))} of the 100 idle MHz are leased: a profit-maximising owner deliberately withholds some capacity to keep the price high.`));
add(figure(path.join(RES, "fig08_stackelberg_scaling.png"), 6.2, "Equilibrium price and leader profit versus number of secondary users (shaded: capacity is the binding constraint)"));
add(P(`Figure 10 averages 40 random markets per size. While demand is below capacity (N ≤ 8) the optimal price stays near 3.2 and profit grows linearly with the number of users. From N = 10 the capacity constraint binds in ${pct(ST.scaling.binding[4])} of markets and in all markets beyond. The price then rises steeply, to ${f2(ST.scaling.price[ST.scaling.price.length - 1])} at N = 30, and profit grows more slowly. This is the scarcity regime in which spectrum sharing becomes most valuable.`));

add(H2("7.6 Experiment 6: Nash bargaining between slices"));
add(figure(path.join(RES, "fig09_bargaining.png"), 6.3, "Bandwidth per slice under each scheme (left) and the efficiency–fairness trade-off (right)"));
const order = ["Nash bargaining", "Weighted NBS (URLLC x2)", "Equal split", "Proportional", "Max sum-rate"];
add(table(["Scheme", "eMBB (MHz)", "URLLC (MHz)", "mMTC (MHz)", "Sum rate (Mbps)", "Jain of gains", "ln Nash product"],
  order.map((k) => [k, f1(BA[k].bandwidth[0]), f1(BA[k].bandwidth[1]), f1(BA[k].bandwidth[2]), f1(BA[k].sum_rate), f3(BA[k].jain_gain), f2(BA[k].log_nash_product)]),
  [2400, 1050, 1100, 1050, 1250, 1050, 1126], "Comparison of slice-sharing schemes (W = 100 MHz)", { highlight: (r) => r[0] === "Nash bargaining" }));
add(P(`Every scheme meets the minimum guarantees, but they divide the surplus very differently. **Max sum-rate** gives all spare bandwidth to eMBB: throughput is highest (${f1(BA["Max sum-rate"].sum_rate)} Mbps), but URLLC and mMTC get nothing beyond their minimums (Jain of gains ${f3(BA["Max sum-rate"].jain_gain)}). **Equal split** is the fairest but wastes the efficient eMBB slice (${f1(BA["Equal split"].sum_rate)} Mbps). **Nash bargaining** sits between the two, at ${f1(BA["Nash bargaining"].sum_rate)} Mbps with a Jain index of ${f3(BA["Nash bargaining"].jain_gain)}, and has the largest Nash product of all schemes. It is the unique allocation satisfying Nash's fairness axioms. Doubling URLLC's bargaining power moves ${f1(BA["Weighted NBS (URLLC x2)"].bandwidth[1] - BA["Nash bargaining"].bandwidth[1])} MHz to URLLC, which shows how an operator can prioritise mission-critical services with a single parameter.`));

add(H2("7.7 Summary of findings"));
add(table(["Model", "Main finding"], [
  ["Power game", `Pricing gives +${gainPct}% sum rate, ~${(eeNE / eeFlat).toFixed(0)}x energy efficiency; unique NE reached in ${pg.iterations} rounds`],
  ["Price sweep", `Energy efficiency peaks at ${(ps.best_ee / ps.flat_ee).toFixed(1)}x the unpriced network with almost no throughput loss`],
  ["Density", `NE achieves ${pct(minmax(neShare)[0])}–${pct(minmax(neShare)[1])} of the optimum; PoA stable at about 2`],
  ["Cournot", `Competition costs ${pct(1 - CO.profit_ne / CO.profit_collusion)} of joint profit; bidding stable only for α < ${f3(CO.alpha_critical)}`],
  ["Stackelberg", "Owner withholds capacity when demand is low; price rises sharply once capacity binds"],
  ["Bargaining", "NBS balances throughput and fairness; weights let operators prioritise URLLC"],
], [2000, 7026], "Summary of results"));

// 8 Screenshots
add(H1("8. Screenshots"));
add(P("The screenshots below show the program running in Windows PowerShell. Figures 12 and 13 show the console output of main.py, which prints every result table used in this report. Figure 14 shows the unit-test run."));
add(figure(path.join(ASSETS, "console_1.png"), 6.3, "Program output, part 1: power-control game, price sweep and density experiments"));
add(figure(path.join(ASSETS, "console_2.png"), 6.3, "Program output, part 2: Cournot, Stackelberg and Nash bargaining experiments"));
add(figure(path.join(ASSETS, "console_tests.png"), 6.3, "All 14 unit tests pass"));

// 9 Applications
add(H1("9. Applications"));
add(bullet("**CBRS and shared-access frameworks:** a Spectrum Access System can use interference pricing (Model A) and Stackelberg pricing (Model C) to allocate the 3.5 GHz band among Priority Access and General Authorised Access users."));
add(bullet("**Private 5G networks:** factories, ports, campuses and hospitals leasing local spectrum from national operators form exactly the Cournot and Stackelberg markets studied here."));
add(bullet("**Network slicing:** Nash bargaining (Model D) gives a principled, tunable way to share RAN resources among eMBB, URLLC and mMTC slices with guaranteed minimums."));
add(bullet("**Dense small-cell and HetNet deployments:** distributed power control with pricing lets cells coordinate interference without a central controller, which matters for ultra-dense 6G networks."));
add(bullet("**Spectrum trading and secondary markets:** regulators and operators can use the Cournot and Stackelberg results to design prices and predict market outcomes, including the risk of collusion."));
add(bullet("**6G AI-native spectrum management:** game-theoretic utilities and equilibria provide the reward structure and stability guarantees for multi-agent reinforcement learning; the bifurcation result shows why learning rates must be bounded."));
add(bullet("**Terrestrial / non-terrestrial sharing:** the same leader–follower structure applies when satellite and terrestrial 6G systems share upper mid-band spectrum."));
add(bullet("**Green networking:** the price sweep shows how a spectrum manager can trade a small loss in throughput for large energy savings."));

// 10 Conclusion
add(H1("10. Conclusion and Future Scope"));
add(H2("10.1 Conclusion"));
add(P("This project modelled spectrum sharing in 5G/6G networks with four game-theoretic models covering the main sharing situations: selfish co-channel interference, competition between operators, pricing by a spectrum owner, and cooperative division among slices. A complete, tested Python implementation computes each equilibrium on a realistic 3GPP channel model and evaluates it against non-game baselines."));
add(P(`The results show that a well-designed game can turn self-interest into good network behaviour. A simple interference price moves the selfish power-control equilibrium to ${gainPct}% higher throughput and several times higher energy efficiency than uncoordinated transmission, while keeping roughly ${pct(minmax(neShare)[0])}–${pct(minmax(neShare)[1])} of the centrally optimal throughput without any central controller. The market models explain how spectrum prices form, why competition is less profitable than collusion, why adaptive bidding can become unstable, and how scarcity drives prices up. The Nash bargaining solution gives slices a fair, tunable compromise between throughput and fairness. Game theory therefore provides both the analysis and the mechanisms needed for flexible, efficient spectrum sharing in next-generation networks.`));
add(H2("10.2 Limitations"));
add(bullet("Players are assumed to know their own utilities and to observe interference or prices accurately; real systems have estimation errors and delays."));
add(bullet("The channel is static during each game; mobility and time-varying fading are not modelled."));
add(bullet("The models are studied separately rather than as one joint multi-layer game."));
add(H2("10.3 Future scope"));
add(bullet("Multi-agent reinforcement learning that learns equilibria without knowing the channel, using these models as the environment."));
add(bullet("Auctions (VCG, double auctions) for truthful spectrum trading and comparison with pricing."));
add(bullet("Joint power, bandwidth and beam allocation for mmWave and sub-THz 6G with directional antennas."));
add(bullet("Incomplete-information (Bayesian) games in which operators do not know each other's costs or channels."));
add(bullet("Integration with a system-level simulator or an O-RAN xApp for real-time spectrum management."));

// References
add(H1("References"));
const refs = [
  "J. Mitola III and G. Q. Maguire, \"Cognitive radio: making software radios more personal,\" IEEE Personal Communications, vol. 6, no. 4, pp. 13–18, 1999.",
  "S. Haykin, \"Cognitive radio: brain-empowered wireless communications,\" IEEE Journal on Selected Areas in Communications, vol. 23, no. 2, pp. 201–220, 2005.",
  "D. Niyato and E. Hossain, \"Competitive pricing for spectrum sharing in cognitive radio networks: dynamic game, inefficiency of Nash equilibrium, and collusion,\" IEEE Journal on Selected Areas in Communications, vol. 26, no. 1, pp. 192–202, 2008.",
  "R. D. Yates, \"A framework for uplink power control in cellular radio systems,\" IEEE Journal on Selected Areas in Communications, vol. 13, no. 7, pp. 1341–1347, 1995.",
  "C. U. Saraydar, N. B. Mandayam and D. J. Goodman, \"Efficient power control via pricing in wireless data networks,\" IEEE Transactions on Communications, vol. 50, no. 2, pp. 291–303, 2002.",
  "J. F. Nash, \"The bargaining problem,\" Econometrica, vol. 18, no. 2, pp. 155–162, 1950.",
  "Z. Han, D. Niyato, W. Saad, T. Başar and A. Hjørungnes, Game Theory in Wireless and Communication Networks: Theory, Models, and Applications. Cambridge University Press, 2012.",
  "3GPP TR 38.901, \"Study on channel model for frequencies from 0.5 to 100 GHz,\" Release 17.",
  "A. J. Goldsmith and S.-G. Chua, \"Variable-rate variable-power MQAM for fading channels,\" IEEE Transactions on Communications, vol. 45, no. 10, pp. 1218–1230, 1997.",
  "Federal Communications Commission, \"Citizens Broadband Radio Service,\" 47 CFR Part 96, 2015.",
  "R. Jain, D. Chiu and W. Hawe, \"A quantitative measure of fairness and discrimination for resource allocation in shared computer systems,\" DEC Research Report TR-301, 1984.",
  "E. Koutsoupias and C. Papadimitriou, \"Worst-case equilibria,\" in Proc. STACS, 1999, pp. 404–413.",
  "H. Yaïche, R. R. Mazumdar and C. Rosenberg, \"A game theoretic framework for bandwidth allocation and pricing in broadband networks,\" IEEE/ACM Transactions on Networking, vol. 8, no. 5, pp. 667–678, 2000.",
  "W. Saad, M. Bennis and M. Chen, \"A vision of 6G wireless systems: applications, trends, technologies, and open research problems,\" IEEE Network, vol. 34, no. 3, pp. 134–142, 2020.",
  "D. Monderer and L. S. Shapley, \"Potential games,\" Games and Economic Behavior, vol. 14, no. 1, pp. 124–143, 1996.",
  "H. von Stackelberg, Market Structure and Equilibrium (translation of Marktform und Gleichgewicht, 1934). Springer, 2011.",
];
refs.forEach((r, i) => add(new Paragraph({
  spacing: { after: 100, line: 280 }, indent: { left: 560, hanging: 560 },
  children: [new TextRun({ text: `[${i + 1}]\t`, bold: true }), new TextRun(r)],
  tabStops: [{ type: TabStopType.LEFT, position: 560 }],
})));

// ---------- document ----------
const doc = new Document({
  creator: "Arnav Anand, Aniket Mohanty, Aneesh Srivastava, Nihit Karanjawala, Shree Ganesh Manikandan",
  title: "Game-Theoretic Model for Spectrum Sharing in 5G/6G Networks",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 34, bold: true, font: "Cambria", color: ACCENT },
        paragraph: { spacing: { before: 120, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 27, bold: true, font: "Cambria", color: ACCENT },
        paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: "Calibri", color: "404040" },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: numberingConfigs },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: cover },
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, pageNumbers: { start: 1 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "Game-Theoretic Model for Spectrum Sharing in 5G/6G Networks", size: 17, color: "7F7F7F", italics: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], size: 18, color: "7F7F7F" })] })] }) },
      children: body },
  ],
});

const out = path.join(ROOT, "docs", "Project_Report.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out); });
