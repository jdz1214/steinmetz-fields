# Steinmetz Fields — sources and formula→page map

Every formula in the app links to the page below (archive.org `…/page/N/mode/1up`). Page numbers are the **printed** page
numbers of the edition named. All computed numbers use standard SI electromagnetics; Steinmetz is the source of the formulas
and the framing, and his CGS/"lines of force" forms are shown next to SI values.

## Primary sources (public domain)

| Key | Work | Edition | Public copy |
|---|---|---|---|
| EL | C. P. Steinmetz, *Elementary Lectures on Electric Discharges, Waves and Impulses, and Other Transients* | 1st ed., McGraw-Hill 1911 (pages identical to 2nd ed. 1914 through p. 66) | https://archive.org/details/elementarylectur00steirich (2nd ed.: https://archive.org/details/elementarylectur00stei) |
| TR | Steinmetz, *Theory and Calculation of Transient Electric Phenomena and Oscillations* | 3rd ed., 1920 | https://archive.org/details/theorycalctrans00steirich |
| ACP | Steinmetz, *Theory and Calculation of Alternating Current Phenomena* | 1st ed., 1897 | https://archive.org/details/theorycalcalt00steirich |
| TEC | Steinmetz, *Theory and Calculation of Electric Circuits* | 1st ed., 1917 | https://archive.org/details/theorycalccirc00steirich |

The hysteresis law was first published in Steinmetz, "On the Law of Hysteresis", *Trans. AIEE* 9 (1892); the app cites the
book restatements above (ACP 1897 §80, TEC 1917 §§ 41–44) because those have stable public page images.

## Formula → page

| In the app | Formula | Cite |
|---|---|---|
| Two energy stores | "The magnetic field and the electrostatic or 'dielectric' field represent stored energy." | EL p. 3 |
| Power vs energy | "…permanent phenomena are the phenomena of electric power, the transients the phenomena of electric energy." | EL p. 4 |
| Exchange of energy | magnetic ⇄ dielectric energy in a discharge | EL p. 9 |
| Figs. 8, 9 | lines of force between conductors (dielectric view presets) | EL pp. 10–11 |
| Inductance | Φ = L·i | EL p. 11, eq. (1); TR p. 5, eq. (2) |
| Self-induced voltage | e′ = L di/dt | EL p. 12, eq. (4) |
| Magnetic energy | w = L i²/2 | EL p. 12, eq. (5); TR p. 7, eq. (9) |
| Dielectric flux | Ψ = C·e | EL p. 12, eq. (6); TR p. 5, eq. (3) |
| Capacity current | i′ = C de/dt | EL p. 13, eq. (9) |
| Dielectric energy | w = C e²/2 | EL p. 13, eq. (11); TR p. 7, eq. (14) |
| Closed vs terminating lines | "All the lines of magnetic force are closed upon themselves, all the lines of dielectric force terminate at conductors" | EL p. 14 |
| Magnetomotive force | F = n·i | EL p. 14, eq. (12) |
| Field intensity | ℋ = 4πf/10 | EL p. 14, eq. (14) |
| Density, flux | B = μℋ, Φ = A·B | EL p. 15, eqs. (15)–(16) |
| Dielectric density | D = κK | EL p. 16 |
| Induced voltage | e′ = n dΦ/dt ·10⁻⁸ (Table I); gradient G = e/l | EL p. 17, Table I; p. 18, Table II |
| Total stored energy (LC chart) | W = L i²/2 + C e²/2 | EL p. 60, eq. (7) |
| Surge impedance | z₀ = √(L/C) | EL p. 61, eq. (9) |
| Natural frequency | f = 1/(2π√(LC)) | EL p. 66, eq. (19) |
| Two-wire field geometry | foci / superposition of the two conductors | EL pp. 119–120; TR pp. 4–5 ("conjugate pencils of circles") |
| Line inductance | L = 2(ln s/r + ¼)·10⁻⁹ H/cm | EL p. 123, eq. (14) |
| High-frequency case (Fig. 9 magnetic overlay) | magnetic lines = equipotentials when current is on the surface | EL p. 124 |
| Line capacity | C = 10⁹ / (2v² ln s/r) F/cm | EL p. 129, eq. (38) |
| Speed of propagation | C·L₁ = 1/v² | EL p. 129, eq. (39) |
| r, L, C as energy conversion | "…the three circuit constants r, L, C therefore appear as the components of the energy conversion into heat, magnetism, and electric stress, respectively." | TR p. 8 |
| Hysteresis law | W = η B^1.6 erg/cm³ per cycle; η: sheet iron .00124–.0055 ("fair mean" .0033), gray cast iron .013, cast steel .0032–.028, hardened steel .08 | ACP § 80, p. 116 |
| Hysteresis power, more η | P = η N V B^1.6 ·10⁻⁷ W; magnetite .023; nickel, cobalt ≈ cast iron | ACP p. 117 |
| Validity range | w = η B^1.6 for B = 1,000–12,000 | TEC p. 61, eq. (15) |
| Silicon steel | w = 0.824×10⁻³ B^1.6, rises above curve past ~10,000 | TEC p. 62, eq. (16) |
| Empirical status | "…entirely empirical, and no rational reason has yet been found…" | TEC p. 69, § 44 |

(In the 1914 2nd edition of EL, the pp. 119–129 items are on pp. ~128–138.)

## Dollard's interpretation (toggle, OFF by default)

Eric P. Dollard, *Introduction to Dielectric & Magnetic Discharges in Electrical Windings* (1982; Borderland Sciences
reprint, bound with J. M. Miller, "Electrical Oscillations in Antennae and Induction Coils", *Proc. IRE*, 1919). Still in
print and under copyright, so no copy is linked; publisher listing (product B0020, "Dielectric & Magnetic Discharges in
Electrical Windings"): https://borderlandsciences.org/cart/tesla-tech/ . Quotes are short excerpts transcribed from a
43-page scan of that reprint. The printed pages are unnumbered, so cites are **scan page numbers**
plus Dollard's section numbers: p. 4 § 2, p. 5 § 4, p. 7 §§ 8–9, p. 11 §§ 13–14.

In the app the toggle only (a) shows a violet "Dollard's interpretation · not mainstream physics" badge with a link here,
(b) adds violet quote labels on some readouts, and (c) shows the quotes, each followed by a plain-language note comparing it
with standard physics. **It never changes any computed number** and makes no energy-gain claims.

## Plain notes

- The "two energy stores" framing is Steinmetz's: energy moves between the magnetic and dielectric fields and is lost to
  resistance; total energy never grows. Nothing here claims free energy or over-unity; the LC chart shows the total decaying.
- Physics: exact circular-loop fields (elliptic integrals, Biot–Savart superposition); magnet = equivalent surface-current
  solenoid (K = Br/μ₀); coil L from loop self- and Maxwell mutual inductances (73.1 µH vs Nagaoka 72.6 µH in a test case);
  EMF = −n dΦ/dt from the magnet's flux linkage while dragging; 2-D dielectric field by the charge-simulation method
  (matches exact 2πε₀/acosh(s/2r) to 1e-9; Steinmetz's ln(s/r) form is ~0.6 % lower at s/r = 10, shown on the chart).

## Stylized (labelled in the app)

- Moving dots on magnetic lines and flowing dashes on dielectric lines (direction only; speed is not physical).
- Which/how many magnetic lines are drawn (24–48 seed lines; brightness does encode |B|). The dielectric line count IS ∝ Ψ.
- B–H loop shape on the hysteresis tab (only its area is physical: ∮H dB/4π = η B^1.6).
- Three-phase animation runs in slow motion.
- "Magnetic lines (Fig. 9)" overlay is the high-frequency (surface-current) case.

## Software

Three.js r170 (MIT, vendored in `vendor/`), Inter and JetBrains Mono (SIL OFL, vendored in `vendor/fonts/`).
