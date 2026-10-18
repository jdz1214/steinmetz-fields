// Off-by-default interpretation layer. Text only: it never touches any computed value.
// Quotes transcribed from the page images of a 43-page scan of the Borderland Sciences
// reprint (1982 text). The reprint has no printed page numbers, so "p." means the page of
// that scan, with Dollard's section number.
export const DOLLARD = {
  short: 'Introduction to Dielectric & Magnetic Discharges in Electrical Windings',
  ref: 'Eric Dollard, “Introduction to Dielectric &amp; Magnetic Discharges in Electrical Windings” (© 1982; reprinted with J. M. Miller, “Electrical Oscillations in Antennae and Induction Coils”, Proc. IRE 1919, Borderland Sciences, Garberville, CA). Page numbers are pages of the 43-page PDF scan.',
  quotes: [
    { page: '5, § 4', text: 'All the lines of magnetic force are closed upon themselves, all dielectric lines of force terminate on conductors, but may form closed loops in electromagnetic radiation.',
      note: 'This restates Steinmetz (Elementary Lectures, p. 14) and adds the radiation case, which agrees with standard electromagnetics. In this app, which shows static fields, every dielectric line ends on a conductor.' },
    { page: '7, § 8', text: 'Inductance represents energy storage in space as a magnetic field. The lines of force orientate themselves in closed loops surrounding the axis of current flow that has given rise to them.' },
    { page: '7, § 9', text: 'The process of pushing these lines or loops outward, causing them to stretch, represents storing energy as in a rubber band.',
      note: 'A mechanical picture. In standard terms the energy is the field energy density B²/2μ₀ summed over space, which is what the magnetic view’s hover probe reports.' },
    { page: '11, § 13', text: 'Unlike magnetism the energy is forced or compressed inwards rather than outwards. … the smaller the space bounded by the conducting structure the more energy that can be stored.',
      note: 'In standard terms: at a fixed voltage, moving conductors closer raises the capacity C and so the stored energy Ce²/2. Drag the two wires together in the dielectric view to see it. (At a fixed charge instead, the energy falls.)' },
    { page: '11, § 14 (heading)', text: 'Voltage is to dielectricity as current is to magnetism.',
      note: 'The same pairing as Steinmetz’s Φ = Li and Ψ = Ce.' },
    { page: '4, § 2', text: 'Unfortunately, to a large extent in dealing with dielectric fields the prehistoric conception of the electrostatic charge (electron) on the conductor still exists…',
      note: 'Dollard is quoting Steinmetz here (Elementary Lectures, p. 13). The “(electron)” is Dollard’s insertion; Steinmetz’s original reads “the electrostatic charge on the conductor”.' },
  ],
};
