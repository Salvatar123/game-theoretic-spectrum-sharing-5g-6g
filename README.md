# Game-Theoretic Model for Spectrum Sharing in 5G/6G Networks

Group: Arnav Anand (2427030154), Aniket Mohanty (2427030143), Aneesh Srivastava (2427030086),
Nihit Karanjawala (2427030145), Shree Ganesh Manikandan (2427030121)

A Python framework that models spectrum sharing in 5G/6G networks with four games, computes
their equilibria on a 3GPP TR 38.901 channel model, and evaluates them.

| Model | Players | Solution |
|---|---|---|
| Power control with interference pricing | co-channel small cells | best-response dynamics → unique Nash equilibrium |
| Cournot spectrum market | secondary operators | Nash equilibrium, collusion benchmark, dynamic-game stability |
| Stackelberg pricing | primary MNO (leader) vs secondary users | backward induction with a capacity constraint |
| Nash bargaining | eMBB / URLLC / mMTC slices | closed-form weighted NBS vs baselines |

## Run

```
pip install -r requirements.txt
python main.py                          # six experiments -> results/ (about 25 s)
python main.py --quick                  # fewer Monte Carlo drops
python -m unittest tests.test_games -v  # 14 equilibrium checks
python tools/make_doc_assets.py         # diagrams + console screenshots -> docs/assets/
```

## Layout

- `spectrum_game/` – channel model, the four games, metrics, plot style
- `main.py` – experiment driver (prints result tables, saves figures and `summary.json`)
- `tests/` – verifies each equilibrium against its definition
- `results/` – generated figures, console log, `summary.json`
- `docs/Project_Report.docx` (+ `.pdf`) – project report
- `docs/Project_Presentation.pptx` – presentation
- `docs/build/` – Node scripts that regenerate the report and deck from `results/`
  (`npm install docx pptxgenjs react react-dom react-icons sharp` in that folder, then
  `node build_report.js` / `node build_deck.js`)
