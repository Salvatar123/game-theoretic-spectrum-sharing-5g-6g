const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require("./apply_theme.js");

const ROOT = "C:/Users/Arnav Anand/Spectrum_Sharing_Game_Theory";
const RES = path.join(ROOT, "results");
const ASSETS = path.join(ROOT, "docs", "assets");
const S = JSON.parse(fs.readFileSync(path.join(RES, "summary.json"), "utf8"));
const OUT = path.join(ROOT, "docs", "Project_Presentation.pptx");

const THEME = {
  name: "Spectrum Navy",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "0E1A2B", lt1: "FFFFFF", dk2: "14213D", lt2: "EEF3F8",
    accent1: "1BA39C", accent2: "F2A541", accent3: "2A78D6", accent4: "EB6834",
    accent5: "6250D6", accent6: "E34948", hlink: "2A78D6", folHlink: "6250D6",
  },
};
const T = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "Game-Theoretic Model for Spectrum Sharing in 5G/6G Networks";
pres.author = "Arnav Anand, Aniket Mohanty, Aneesh Srivastava, Nihit Karanjawala, Shree Ganesh Manikandan";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const MUTED = "6B7280";

// ---------- helpers ----------
const f1 = (x) => Number(x).toFixed(1);
const f2 = (x) => Number(x).toFixed(2);
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
// fit an image inside a box, keeping aspect ratio, centred
function img(slide, file, x, y, w, h, name) {
  const s = pngSize(file);
  let iw = w, ih = (w * s.h) / s.w;
  if (ih > h) { ih = h; iw = (h * s.w) / s.h; }
  slide.addImage({ path: file, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, objectName: name, altText: name });
}
const iconCache = {};
async function icon(name, color) {
  const key = name + color;
  if (!iconCache[key]) {
    const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: 256 }));
    const png = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    iconCache[key] = "image/png;base64," + png.toString("base64");
  }
  return iconCache[key];
}
// icon in a coloured circle: the deck's motif
async function iconCircle(slide, name, x, y, d, fill = C.accent1, iconColor = "FFFFFF") {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: `circle-${name}` });
  const pad = d * 0.25;
  slide.addImage({ data: await icon(name, iconColor), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, objectName: `icon-${name}`, altText: name });
}
function card(slide, x, y, w, h, fill = C.background2) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12, objectName: "card" });
}
function text(slide, t, opts) {
  slide.addText(t, { isTextBox: true, fontSize: 15, color: C.text1, valign: "top", margin: 0, ...opts });
}
function stat(slide, value, label, x, y, w, color = C.accent1) {
  text(slide, value, { x, y, w, h: 0.75, fontSize: 40, bold: true, color, fontFace: THEME.headFontFace });
  text(slide, label, { x, y: y + 0.78, w, h: 0.6, fontSize: 13, color: MUTED });
}

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: T.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.55, w: 11.7, h: 1.9, fontSize: 42, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.6, w: 11.7, h: 0.7, fontSize: 20, color: C.accent1, margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: T.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 0.85, fontSize: 32, bold: true, color: C.text2, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Game-Theoretic Spectrum Sharing in 5G/6G", options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: MUTED, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: MUTED, align: "right" },
});
pres.defineSlideMaster({
  title: "SECTION_DARK",
  background: { color: T.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 0.85, fontSize: 32, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: "9FB3C8", align: "right" },
});

const content = (section, title) => {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
};

const members = [
  ["Arnav Anand", "2427030154"], ["Aniket Mohanty", "2427030143"], ["Aneesh Srivastava", "2427030086"],
  ["Nihit Karanjawala", "2427030145"], ["Shree Ganesh Manikandan", "2427030121"],
];

(async () => {
  const pg = S.power_game, NE = pg["Nash eq. (priced)"], FLAT = pg["No pricing (P_max)"], OPT = pg["Social optimum"];
  const ps = S.price_sweep, D = S.density, CO = S.cournot, ST = S.stackelberg, BA = S.bargaining;
  const gainPct = (NE.sum_rate_mbps / FLAT.sum_rate_mbps - 1) * 100;
  const eeNE = NE.sum_rate_mbps / (NE.total_power_w + 0.6), eeFlat = FLAT.sum_rate_mbps / (FLAT.total_power_w + 0.6);
  const share = D.ne_rate.map((r, i) => r / D.opt_rate[i]);
  const pct = (x) => `${Math.round(x * 100)}%`;

  // ===== 1. Title =====
  pres.addSection({ title: "Introduction" });
  let s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Introduction" });
  s.addText("Game-Theoretic Model for Spectrum Sharing in 5G/6G Networks", { placeholder: "title" });
  s.addText("Power control · Cournot competition · Stackelberg pricing · Nash bargaining", { placeholder: "body" });
  members.forEach(([n, r], i) => {
    const x = 0.8 + i * 2.38;
    text(s, n, { x, y: 5.15, w: 2.25, h: 0.35, fontSize: 14, bold: true, color: C.background1 });
    text(s, r, { x, y: 5.5, w: 2.25, h: 0.3, fontSize: 13, color: "9FB3C8" });
  });
  text(s, "Project Presentation  |  October 2026", { x: 0.8, y: 6.55, w: 6, h: 0.3, fontSize: 12, color: "9FB3C8" });
  s.addNotes("Introduce the team and the project: a game-theoretic framework, implemented in Python, for sharing spectrum among users and operators in 5G and 6G networks.");

  // ===== 2. Agenda =====
  s = content("Introduction", "Agenda");
  const agenda = [
    ["FaBroadcastTower", "Background & problem"], ["FaBullseye", "Objectives"], ["FaChessKnight", "Why game theory"],
    ["FaProjectDiagram", "System model & methodology"], ["FaCode", "Implementation"], ["FaChartLine", "Results"],
    ["FaIndustry", "Applications"], ["FaFlagCheckered", "Conclusion & future scope"],
  ];
  for (let i = 0; i < agenda.length; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.9 + col * 6.1, y = 1.65 + row * 1.25;
    await iconCircle(s, agenda[i][0], x, y, 0.8);
    text(s, `${String(i + 1).padStart(2, "0")}`, { x: x + 1.05, y: y + 0.02, w: 0.6, h: 0.35, fontSize: 13, bold: true, color: C.accent1 });
    text(s, agenda[i][1], { x: x + 1.05, y: y + 0.32, w: 4.6, h: 0.45, fontSize: 20, color: C.text1 });
  }
  s.addNotes("Walk through the structure of the talk.");

  // ===== 3. Background =====
  s = content("Introduction", "Spectrum is scarce, yet often idle");
  const bg = [
    ["FaSignal", "Demand keeps growing", "5G NR (n78, 3.3–3.8 GHz; mmWave) and 6G (7–24 GHz, sub-THz) need ever wider channels for eMBB, URLLC and massive IoT."],
    ["FaClock", "Licensed bands are under-used", "A band congested downtown at noon can be nearly idle in the suburbs at night: exclusive licences waste capacity."],
    ["FaShareAlt", "Dynamic sharing is the answer", "LTE–NR DSS, CBRS with its Spectrum Access System, Licensed Shared Access and local private-5G licences let many parties share one band."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * 4.1;
    card(s, x, 1.6, 3.85, 4.7);
    await iconCircle(s, bg[i][0], x + 0.35, 1.95, 0.85);
    text(s, bg[i][1], { x: x + 0.35, y: 3.05, w: 3.2, h: 0.85, fontSize: 22, bold: true, color: C.text2, fontFace: THEME.headFontFace });
    text(s, bg[i][2], { x: x + 0.35, y: 4.0, w: 3.2, h: 2.1, fontSize: 17, color: C.text1 });
  }
  s.addNotes("Spectrum is the scarcest resource in mobile networks. Utilisation measurements show licensed spectrum is idle much of the time, so regulators and operators are moving to dynamic spectrum sharing.");

  // ===== 4. Problem statement =====
  s = content("Introduction", "Problem statement");
  card(s, 0.6, 1.55, 12.1, 1.55, C.text2);
  text(s, "How should a limited band and transmit power be shared among self-interested 5G/6G users and operators so the outcome is efficient, fair, profitable and stable, without a central controller that knows everything?",
    { x: 0.95, y: 1.75, w: 11.4, h: 1.2, fontSize: 19, italic: true, color: C.background1, valign: "middle", fontFace: THEME.headFontFace });
  const probs = [
    ["FaWifi", "Co-channel interference", "Small cells on one carrier: what powers emerge, and can a price help?"],
    ["FaExchangeAlt", "Competition for spectrum", "Operators buying leased bandwidth: how much, and is bidding stable?"],
    ["FaTags", "Owner pricing", "What price should the licence holder set as demand grows?"],
    ["FaBalanceScale", "Fair slicing", "How should eMBB, URLLC and mMTC slices split one band?"],
  ];
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + i * 3.06;
    await iconCircle(s, probs[i][0], x, 3.5, 0.75, C.accent2);
    text(s, probs[i][1], { x, y: 4.45, w: 2.8, h: 0.45, fontSize: 18, bold: true, color: C.text2 });
    text(s, probs[i][2], { x, y: 4.95, w: 2.8, h: 1.5, fontSize: 15 });
  }
  s.addNotes("The general problem, and the four concrete instances we model.");

  // ===== 5. Objectives =====
  s = content("Introduction", "Objectives");
  const objs = [
    "Model a realistic 5G radio environment (3GPP TR 38.901 UMi, 3.5 GHz)",
    "Formulate four games: power control, Cournot, Stackelberg, Nash bargaining",
    "Compute equilibria with best response, backward induction and convex optimisation",
    "Verify every equilibrium automatically against its definition",
    "Evaluate sum rate, energy efficiency, fairness, profit and Price of Anarchy",
    "Study learning stability, network density and market size",
  ];
  objs.forEach((o, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.1, y = 1.6 + row * 1.7;
    card(s, x, y, 5.9, 1.45);
    text(s, String(i + 1), { x: x + 0.3, y: y + 0.25, w: 0.8, h: 0.9, fontSize: 40, bold: true, color: C.accent1, fontFace: THEME.headFontFace, valign: "middle" });
    text(s, o, { x: x + 1.2, y: y + 0.2, w: 4.45, h: 1.05, fontSize: 17, valign: "middle" });
  });
  s.addNotes("Six objectives, from modelling through verification to evaluation.");

  // ===== 6. Why game theory =====
  pres.addSection({ title: "Approach" });
  s = content("Approach", "Why game theory?");
  const gt = [
    ["FaUsers", "Players", "radios, small cells, operators, network slices"],
    ["FaSlidersH", "Strategies", "transmit power, bandwidth requested, price announced"],
    ["FaCoins", "Utilities", "throughput or profit minus the cost of power, spectrum or interference"],
    ["FaAnchor", "Equilibrium", "a stable outcome where nobody gains by deviating alone; it predicts distributed behaviour"],
  ];
  for (let i = 0; i < 4; i++) {
    const y = 1.55 + i * 1.3;
    await iconCircle(s, gt[i][0], 0.7, y, 0.85);
    text(s, gt[i][1], { x: 1.8, y: y + 0.05, w: 2.6, h: 0.45, fontSize: 21, bold: true, color: C.text2 });
    text(s, gt[i][2], { x: 1.8, y: y + 0.48, w: 5.2, h: 0.75, fontSize: 15 });
  }
  card(s, 7.5, 1.55, 5.2, 5.05);
  text(s, "Three families of games", { x: 7.85, y: 1.8, w: 4.6, h: 0.5, fontSize: 20, bold: true, color: C.text2 });
  text(s, [
    { text: "Non-cooperative", options: { bold: true, breakLine: true } },
    { text: "selfish, distributed decisions (power control, Cournot)", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Hierarchical (Stackelberg)", options: { bold: true, breakLine: true } },
    { text: "a licence holder moves first, others react", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Cooperative (bargaining)", options: { bold: true, breakLine: true } },
    { text: "parties agree on a fair, efficient division" },
  ], { x: 7.85, y: 2.45, w: 4.6, h: 3.9, fontSize: 16 });
  s.addNotes("Spectrum sharing has many decision makers with conflicting goals. Game theory gives us players, strategies, utilities and equilibria. We use one model from each family.");

  // ===== 7. System model =====
  s = content("Approach", "System model");
  img(s, path.join(ASSETS, "system_model.png"), 0.6, 1.45, 8.2, 5.3, "System model diagram");
  text(s, [
    { text: "Primary MNO", options: { bold: true, breakLine: true, color: C.text2 } },
    { text: "holds the licensed n78 band and idle capacity W", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Spectrum manager / SAS", options: { bold: true, breakLine: true, color: C.text2 } },
    { text: "sets prices and rules, computes equilibria", options: { breakLine: true } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Four sharing games", options: { bold: true, breakLine: true, color: C.text2 } },
    { text: "three non-cooperative, one cooperative" },
  ], { x: 9.2, y: 1.9, w: 3.5, h: 4.5, fontSize: 16 });
  s.addNotes("One licensed band, a spectrum manager playing the role of a CBRS SAS, and four sharing situations underneath.");

  // ===== 8. Methodology =====
  s = content("Approach", "Methodology and channel model");
  img(s, path.join(ASSETS, "methodology.png"), 0.6, 1.4, 12.1, 2.5, "Methodology flow");
  const ch = [
    ["Path loss", "PL = 32.4 + 21 log10(d) + 20 log10(fc)  (3GPP UMi)"],
    ["Fading", "4 dB log-normal shadowing + Rayleigh"],
    ["Noise", "−174 dBm/Hz + NF 7 dB → −94 dBm over 20 MHz"],
    ["Spectral efficiency", "k = log2(1 + K·SNR), K = 1.5 / ln(0.2/BER)"],
  ];
  ch.forEach(([a, b], i) => {
    const x = 0.6 + (i % 2) * 6.1, y = 4.3 + Math.floor(i / 2) * 1.2;
    card(s, x, y, 5.9, 1.0);
    text(s, a, { x: x + 0.3, y: y + 0.12, w: 5.3, h: 0.35, fontSize: 15, bold: true, color: C.accent1 });
    text(s, b, { x: x + 0.3, y: y + 0.48, w: 5.3, h: 0.4, fontSize: 15 });
  });
  s.addNotes("Six-step method. The channel follows 3GPP TR 38.901 Urban Micro at 3.5 GHz, so the numbers are realistic for 5G small cells.");

  // ===== 9. Four models =====
  s = content("Approach", "Four game models");
  const models = [
    ["FaWifi", "A. Power-control game", "uᵢ = B·log2(1+SINRᵢ) − c·pᵢ", "Best response: water-filling, BRᵢ = [B/(c ln2) − (Iᵢ+N₀)/Gᵢᵢ] clipped to [0, Pmax]. Unique NE (Yates)."],
    ["FaExchangeAlt", "B. Cournot market", "πᵢ = r·kᵢ·bᵢ − bᵢ·(x + y·B)", "Operators buy bᵢ MHz; price rises with total demand. Dynamic bidding bᵢ ← bᵢ + α·bᵢ·∂πᵢ/∂bᵢ."],
    ["FaTags", "C. Stackelberg pricing", "Uᵢ = wᵢ ln(1 + gᵢbᵢ) − p·bᵢ", "Followers: bᵢ* = wᵢ/p − 1/gᵢ. Leader maximises (p − c)·Σbᵢ*(p) s.t. Σbᵢ* ≤ W."],
    ["FaHandshake", "D. Nash bargaining", "max Σ aᵢ ln(sᵢbᵢ − dᵢ)", "Slices get their minimum dᵢ/sᵢ, then share the surplus in proportion to bargaining power aᵢ."],
  ];
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + (i % 2) * 6.1, y = 1.5 + Math.floor(i / 2) * 2.7;
    card(s, x, y, 5.9, 2.5);
    await iconCircle(s, models[i][0], x + 0.3, y + 0.3, 0.7, [C.accent3, C.accent4, C.accent1, C.accent2][i]);
    text(s, models[i][1], { x: x + 1.2, y: y + 0.38, w: 4.5, h: 0.5, fontSize: 20, bold: true, color: C.text2 });
    text(s, models[i][2], { x: x + 0.3, y: y + 1.1, w: 5.4, h: 0.4, fontSize: 16, italic: true, fontFace: "Cambria Math", color: C.text1 });
    text(s, models[i][3], { x: x + 0.3, y: y + 1.55, w: 5.4, h: 0.85, fontSize: 14, color: MUTED });
  }
  s.addNotes("Formulation of each model. A: utility is throughput minus an interference price. B: Cournot with linear inverse demand. C: leader price, follower best responses, backward induction. D: weighted Nash bargaining with minimum-rate guarantees.");

  // ===== 10. Implementation =====
  s = content("Approach", "Implementation in Python");
  const stack = [["Python 3.13", "language"], ["NumPy", "vectorised SINR & channels"], ["SciPy", "L-BFGS-B, SLSQP, Brent"], ["Matplotlib", "colour-blind-safe figures"], ["unittest", "14 equilibrium tests"]];
  stack.forEach(([a, b], i) => {
    const y = 1.55 + i * 0.98;
    card(s, 0.6, y, 4.0, 0.82);
    text(s, a, { x: 0.85, y: y + 0.1, w: 3.6, h: 0.35, fontSize: 17, bold: true, color: C.text2 });
    text(s, b, { x: 0.85, y: y + 0.45, w: 3.6, h: 0.3, fontSize: 13, color: MUTED });
  });
  const files = [
    ["channel.py", "3GPP path loss, fading, deployment"], ["power_game.py", "best response, Nash solver, social optimum"],
    ["cournot_game.py", "equilibrium, collusion, dynamics, stability"], ["stackelberg_game.py", "backward induction with capacity"],
    ["bargaining.py", "closed-form & numerical NBS, baselines"], ["metrics.py", "Jain, PoA, energy efficiency"],
    ["main.py", "6 experiments → figures + summary.json"], ["tests/test_games.py", "checks every equilibrium definition"],
  ];
  s.addTable([[{ text: "Module", options: { bold: true, color: C.background1, fill: { color: C.text2 } } },
    { text: "Responsibility", options: { bold: true, color: C.background1, fill: { color: C.text2 } } }],
    ...files.map(([a, b], i) => [{ text: a, options: { fontFace: "Consolas", fontSize: 13, fill: { color: i % 2 ? C.background1 : C.background2 } } },
      { text: b, options: { fill: { color: i % 2 ? C.background1 : C.background2 } } }])],
  { x: 5.0, y: 1.55, w: 7.7, colW: [2.9, 4.8], fontSize: 14, color: C.text1, border: { type: "solid", pt: 0.5, color: "D5DCE4" }, rowH: 0.5, valign: "middle", objectName: "module-table" });
  s.addNotes("A modular Python package: one module per game plus channel and metrics, a driver that runs six experiments, and a test suite that checks the equilibrium conditions directly.");

  // ===== 11. Verification =====
  s = content("Approach", "Every equilibrium is verified");
  img(s, path.join(ASSETS, "console_tests.png"), 0.6, 1.5, 7.6, 4.2, "Unit test output");
  const checks = [
    ["Power game", "no unilateral deviation helps; same NE from any start"],
    ["Cournot", "matches closed form; stable only below α*"],
    ["Stackelberg", "followers best-respond; leader price optimal"],
    ["Bargaining", "closed form = SLSQP; minimums met"],
  ];
  for (let i = 0; i < checks.length; i++) {
    const y = 1.55 + i * 1.12;
    await iconCircle(s, "FaCheck", 8.6, y + 0.05, 0.55, C.accent1);
    text(s, checks[i][0], { x: 9.35, y, w: 3.4, h: 0.38, fontSize: 17, bold: true, color: C.text2 });
    text(s, checks[i][1], { x: 9.35, y: y + 0.4, w: 3.4, h: 0.6, fontSize: 14 });
  }
  text(s, "14 / 14 tests pass", { x: 0.6, y: 6.0, w: 7.6, h: 0.6, fontSize: 24, bold: true, color: C.accent1, fontFace: THEME.headFontFace });
  s.addNotes("We do not just check that the code runs: each test checks the mathematical definition of the equilibrium.");

  // ===== 12. Result: power game =====
  pres.addSection({ title: "Results" });
  s = content("Results", "Pricing turns selfish power control into a better network");
  img(s, path.join(RES, "fig02_power_convergence.png"), 0.6, 1.45, 6.6, 4.2, "Best-response convergence");
  text(s, `Best-response dynamics reach the unique Nash equilibrium in ${pg.iterations} rounds; two weak links price themselves out.`,
    { x: 0.6, y: 5.8, w: 6.6, h: 0.8, fontSize: 14, color: MUTED });
  s.addChart(pres.charts.BAR, [{ name: "Sum rate (Mbps)", labels: ["Full power", "Nash eq. (priced)", "Social optimum"],
    values: [FLAT.sum_rate_mbps, NE.sum_rate_mbps, OPT.sum_rate_mbps].map((v) => +v.toFixed(1)) }], {
    x: 7.6, y: 1.45, w: 5.1, h: 3.0, barDir: "bar", chartColors: [T.accent3], showTitle: true, title: "Sum rate (Mbps)",
    titleFontSize: 14, titleColor: C.text2, titleFontFace: "+mn-lt", showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12,
    dataLabelColor: C.text1, dataLabelFontFace: "+mn-lt", catAxisLabelColor: C.text1, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt",
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 45, objectName: "sum-rate-chart",
  });
  stat(s, `+${gainPct.toFixed(1)}%`, "sum rate vs full power", 7.6, 4.75, 2.5);
  stat(s, `${(eeNE / eeFlat).toFixed(1)}×`, "energy efficiency", 10.3, 4.75, 2.4, C.accent2);
  s.addNotes(`Six small cells, price 40 Mbps per watt. Pricing gives ${gainPct.toFixed(1)} percent more throughput with 63 percent less power. The central optimum is higher still but switches weak links off, so it is the least fair.`);

  // ===== 13. Price sweep =====
  s = content("Results", "The interference price is a single control knob");
  img(s, path.join(RES, "fig03_price_sweep.png"), 0.6, 1.4, 7.9, 5.45, "Price sweep");
  const reg = [
    ["c < 10", "everyone near full power, like an unpriced network"],
    ["10 < c < 10⁴", "weak links drop out; powers scale down, SINR and sum rate hold"],
    ["c > 10⁵", "signals approach the noise floor and the rate collapses"],
  ];
  reg.forEach(([a, b], i) => {
    const y = 1.5 + i * 1.08;
    text(s, a, { x: 8.9, y, w: 3.8, h: 0.38, fontSize: 17, bold: true, color: C.text2 });
    text(s, b, { x: 8.9, y: y + 0.38, w: 3.8, h: 0.62, fontSize: 14 });
  });
  stat(s, `${(ps.best_ee / ps.flat_ee).toFixed(1)}×`, `peak energy efficiency vs unpriced, still ${f1(ps.sum_rate_at_best)} Mbps`, 8.9, 4.85, 3.8, C.accent2);
  s.addNotes("Sweeping the price from 1 to one million. Because the network is interference-limited, there is a wide range where power falls by orders of magnitude while throughput is unchanged.");

  // ===== 14. Density =====
  s = content("Results", "Decentralised play stays close to the optimum");
  img(s, path.join(RES, "fig04_density.png"), 0.6, 1.4, 12.1, 4.1, "Density Monte Carlo");
  stat(s, `${pct(Math.min(...share))}–${pct(Math.max(...share))}`, "of the optimal sum rate, reached selfishly", 0.6, 5.6, 4.0);
  stat(s, "≈ 2", "Price of Anarchy, flat as density grows", 4.9, 5.6, 3.6, C.accent2);
  stat(s, "< 26", "average best-response rounds to converge", 8.8, 5.6, 3.9, C.accent3);
  s.addNotes("40 random networks per size. Full power saturates as interference grows; the priced equilibrium keeps scaling.");

  // ===== 15. Cournot =====
  s = content("Results", "Cournot: competition overbuys, fast learning destabilises");
  img(s, path.join(RES, "fig05_cournot_dynamics.png"), 0.6, 1.4, 7.4, 3.0, "Cournot dynamics");
  img(s, path.join(RES, "fig06_cournot_bifurcation.png"), 0.6, 4.45, 7.4, 2.45, "Bifurcation diagram");
  card(s, 8.4, 1.45, 4.3, 5.4);
  stat(s, `${f1(CO.profit_ne)} vs ${f1(CO.profit_collusion)}`, "total profit: competition vs collusion", 8.7, 1.75, 3.8, C.accent4);
  stat(s, `α* = ${CO.alpha_critical.toFixed(3)}`, "stability limit for adaptive bidding", 8.7, 3.35, 3.8, C.accent1);
  text(s, "Above α*: 2-cycle → period doubling → chaos. AI bidding agents need bounded learning rates.",
    { x: 8.7, y: 4.95, w: 3.8, h: 1.6, fontSize: 15 });
  s.addNotes("Three secondary operators. Each overbuys because it ignores the price rise it causes for others, so competition is less profitable than collusion. The dynamic game converges only below the stability limit.");

  // ===== 16. Stackelberg =====
  s = content("Results", "Stackelberg: the owner prices for scarcity");
  img(s, path.join(RES, "fig07_stackelberg.png"), 0.6, 1.4, 7.2, 2.75, "Stackelberg equilibrium");
  img(s, path.join(RES, "fig08_stackelberg_scaling.png"), 0.6, 4.2, 7.2, 2.65, "Stackelberg scaling");
  card(s, 8.2, 1.45, 4.5, 5.4);
  stat(s, `p* = ${f2(ST.price)}`, "optimal price per MHz with 5 followers", 8.5, 1.75, 4.0, C.accent1);
  stat(s, `${f1(ST.demand.reduce((a, b) => a + b, 0))} / 100 MHz`, "leased: the owner withholds capacity", 8.5, 3.3, 4.0, C.accent4);
  text(s, `Once demand fills the band (N ≥ 10), price climbs from 3.2 to ${f2(ST.scaling.price[ST.scaling.price.length - 1])} at N = 30.`,
    { x: 8.5, y: 4.95, w: 4.0, h: 1.6, fontSize: 15 });
  s.addNotes("Backward induction. Followers buy where marginal value equals price; the leader picks the profit-maximising price. With few users it withholds capacity; once demand saturates the band, the price rises steeply.");

  // ===== 17. Bargaining =====
  s = content("Results", "Nash bargaining balances throughput and fairness");
  const order = ["Nash bargaining", "Weighted NBS (URLLC x2)", "Equal split", "Proportional", "Max sum-rate"];
  const short = ["Nash bargaining", "Weighted NBS", "Equal split", "Proportional", "Max sum-rate"];
  s.addChart(pres.charts.BAR, ["eMBB", "URLLC", "mMTC"].map((n, j) => ({ name: n, labels: short, values: order.map((k) => +BA[k].bandwidth[j].toFixed(1)) })), {
    x: 0.6, y: 1.4, w: 7.4, h: 5.3, barDir: "col", barGrouping: "clustered", chartColors: [T.accent3, T.accent4, T.accent1],
    showTitle: true, title: "Bandwidth per slice (MHz)", titleFontSize: 14, titleColor: C.text2, titleFontFace: "+mn-lt",
    showLegend: true, legendPos: "t", legendFontSize: 12, legendFontFace: "+mn-lt", legendColor: C.text1,
    catAxisLabelColor: C.text1, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: MUTED, valAxisLabelFontSize: 11, valAxisLabelFontFace: "+mn-lt",
    valGridLine: { color: "E1E0D9", size: 0.5 }, catGridLine: { style: "none" }, barGapWidthPct: 60, objectName: "bargaining-chart",
  });
  const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 }, align: "center" } });
  s.addTable([[hdr("Scheme"), hdr("Sum rate"), hdr("Jain of gains")],
    ...order.map((k, i) => {
      const hl = i === 0;
      const o = { fill: { color: hl ? "D6F0EE" : (i % 2 ? C.background1 : C.background2) }, bold: hl };
      return [{ text: short[i], options: o }, { text: f1(BA[k].sum_rate), options: { ...o, align: "center" } }, { text: BA[k].jain_gain.toFixed(3), options: { ...o, align: "center" } }];
    })],
  { x: 8.3, y: 1.5, w: 4.4, colW: [1.9, 1.1, 1.4], fontSize: 14, color: C.text1, rowH: 0.48, valign: "middle", border: { type: "solid", pt: 0.5, color: "D5DCE4" }, objectName: "bargaining-table" });
  text(s, "Max sum-rate starves URLLC and mMTC; equal split wastes eMBB. NBS sits between them and maximises the Nash product.",
    { x: 8.3, y: 4.65, w: 4.4, h: 1.9, fontSize: 15 });
  s.addNotes("Three slices share 100 megahertz with minimum guarantees. Nash bargaining is the axiomatic compromise. Doubling URLLC's bargaining power shifts about 8 megahertz to it.");

  // ===== 18. Screenshots =====
  s = content("Results", "Program output");
  img(s, path.join(ASSETS, "console_1.png"), 0.6, 1.4, 6.0, 5.45, "Console output part 1");
  img(s, path.join(ASSETS, "console_2.png"), 6.75, 1.4, 6.0, 5.45, "Console output part 2");
  s.addNotes("Output of python main.py: every table in the report is printed here. The full run takes about 25 seconds.");

  // ===== 19. Applications =====
  pres.addSection({ title: "Wrap-up" });
  s = content("Wrap-up", "Applications");
  const apps = [
    ["FaServer", "CBRS / SAS", "interference & Stackelberg pricing for 3.5 GHz sharing"],
    ["FaIndustry", "Private 5G", "factories, ports and campuses leasing local spectrum"],
    ["FaLayerGroup", "Network slicing", "fair eMBB / URLLC / mMTC resource split"],
    ["FaBroadcastTower", "Dense small cells", "distributed interference coordination"],
    ["FaChartBar", "Spectrum markets", "price design, collusion risk, trading"],
    ["FaRobot", "AI-native 6G", "rewards & stability limits for multi-agent RL"],
    ["FaSatellite", "NTN sharing", "satellite and terrestrial 6G in one band"],
    ["FaLeaf", "Green networks", "trade small throughput loss for big energy gains"],
  ];
  for (let i = 0; i < apps.length; i++) {
    const x = 0.6 + (i % 4) * 3.06, y = 1.55 + Math.floor(i / 4) * 2.65;
    card(s, x, y, 2.85, 2.45);
    await iconCircle(s, apps[i][0], x + 0.3, y + 0.3, 0.7);
    text(s, apps[i][1], { x: x + 0.3, y: y + 1.12, w: 2.3, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
    text(s, apps[i][2], { x: x + 0.3, y: y + 1.55, w: 2.3, h: 0.8, fontSize: 14 });
  }
  s.addNotes("Where these models apply in practice.");

  // ===== 20. Conclusion =====
  s = pres.addSlide({ masterName: "SECTION_DARK", sectionTitle: "Wrap-up" });
  s.addText("Conclusion and future scope", { placeholder: "title" });
  const concl = [
    `A simple interference price gives +${gainPct.toFixed(0)}% throughput and ${(eeNE / eeFlat).toFixed(0)}× energy efficiency`,
    `Decentralised equilibria reach ${pct(Math.min(...share))}–${pct(Math.max(...share))} of the optimum without a central controller`,
    "Markets explain prices, the cost of competition and why fast learning destabilises",
    "Nash bargaining gives slices a fair, tunable split",
  ];
  text(s, "What we showed", { x: 0.6, y: 1.5, w: 6.5, h: 0.45, fontSize: 20, bold: true, color: C.accent1 });
  text(s, concl.map((c, i) => ({ text: c, options: { bullet: true, breakLine: i < concl.length - 1, paraSpaceAfter: 10 } })),
    { x: 0.6, y: 2.05, w: 6.3, h: 2.7, fontSize: 17, color: C.background1 });
  const fut = ["Multi-agent reinforcement learning", "Auctions (VCG, double auctions)", "Joint power, bandwidth and beams for mmWave / sub-THz", "Bayesian games with hidden costs", "O-RAN xApp integration"];
  text(s, "Next steps", { x: 7.6, y: 1.5, w: 5.1, h: 0.45, fontSize: 20, bold: true, color: C.accent2 });
  text(s, fut.map((c, i) => ({ text: c, options: { bullet: true, breakLine: i < fut.length - 1, paraSpaceAfter: 10 } })),
    { x: 7.6, y: 2.05, w: 5.1, h: 2.7, fontSize: 17, color: C.background1 });
  const keys = [[`+${gainPct.toFixed(1)}%`, "throughput from pricing", C.accent1], [`${(ps.best_ee / ps.flat_ee).toFixed(1)}×`, "peak energy efficiency", C.accent2],
    [`α* = ${CO.alpha_critical.toFixed(3)}`, "bidding stability limit", C.accent1], ["14 / 14", "equilibrium tests pass", C.accent2]];
  keys.forEach(([v, l, c], i) => {
    const x = 0.6 + i * 3.06;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.0, w: 2.85, h: 1.6, fill: { color: "1E2E52" }, line: { color: "1E2E52" }, rectRadius: 0.12, objectName: "key-card" });
    text(s, v, { x: x + 0.25, y: 5.2, w: 2.4, h: 0.7, fontSize: 32, bold: true, color: c, fontFace: THEME.headFontFace });
    text(s, l, { x: x + 0.25, y: 5.95, w: 2.4, h: 0.45, fontSize: 14, color: "C9D6E3" });
  });
  s.addNotes("Summarise the findings and the directions for future work.");

  // ===== 21. Thank you =====
  s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Wrap-up" });
  s.addText("Thank you", { placeholder: "title" });
  s.addText("Questions?", { placeholder: "body" });
  members.forEach(([n, r], i) => {
    const x = 0.8 + i * 2.38;
    text(s, n, { x, y: 5.15, w: 2.25, h: 0.35, fontSize: 14, bold: true, color: C.background1 });
    text(s, r, { x, y: 5.5, w: 2.25, h: 0.3, fontSize: 13, color: "9FB3C8" });
  });
  s.addNotes("Invite questions.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
