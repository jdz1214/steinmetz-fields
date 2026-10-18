# Steinmetz Fields

**Live:** https://jdz1214.github.io/steinmetz-fields/

An interactive 3D look at the two stores of a circuit's energy as Charles P. Steinmetz described them: the
**magnetic field Φ** around a coil (drag a permanent magnet through it and watch the induced EMF) and the
**dielectric field Ψ** between charged conductors (drag the wires; the number of lines drawn is proportional to Ψ = C·e).

- Fields are computed with standard SI electromagnetics: exact circular-loop Biot–Savart fields for the coil and magnet,
  and a charge-simulation method for the 2-D dielectric field.
- Live readouts: Φ = L·i, Ψ = C·e, ½Li², ½Ce², and the hysteresis law W = η·B^1.6.
- Every Steinmetz formula is cited to book and printed page, with links to public-domain scans on archive.org.
- An optional, off-by-default "Dollard's interpretation" toggle adds labelled quotes from Eric P. Dollard (1982). It is
  marked as not mainstream physics and never changes a computed number.

Static site with no tracking. The binary assets (`og.png` and the `.woff2` fonts) are stored as base64 text under `_b64/`
and decoded by the Pages workflow (`.github/workflows/pages.yml`) when the site is deployed.

## Sources

Public-domain primary sources (full formula-to-page map in [SOURCES.md](SOURCES.md)):

- C. P. Steinmetz, *Elementary Lectures on Electric Discharges, Waves and Impulses, and Other Transients*, 1st ed.,
  McGraw-Hill, 1911. https://archive.org/details/elementarylectur00steirich
- C. P. Steinmetz, *Theory and Calculation of Transient Electric Phenomena and Oscillations*, 3rd ed., McGraw-Hill, 1920.
  https://archive.org/details/theorycalctrans00steirich
- C. P. Steinmetz, *Theory and Calculation of Alternating Current Phenomena*, 1st ed., 1897.
  https://archive.org/details/theorycalcalt00steirich
- C. P. Steinmetz, *Theory and Calculation of Electric Circuits*, 1st ed., 1917.
  https://archive.org/details/theorycalccirc00steirich

Interpretation layer (copyrighted, short quotations only, no copy linked):

- Eric P. Dollard, *Introduction to Dielectric & Magnetic Discharges in Electrical Windings*, 1982 (Borderland Sciences
  reprint). Publisher listing: https://borderlandsciences.org/cart/tesla-tech/

## Credits

- [Three.js](https://threejs.org/) r170, MIT License (vendored in `vendor/`, see `vendor/THREE-LICENSE`).
- Inter and JetBrains Mono fonts, SIL Open Font License (vendored in `vendor/fonts/`).
