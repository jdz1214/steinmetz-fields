// Every Steinmetz citation used in the UI. Page numbers are the printed page
// numbers of the edition named; links open that page of a public-domain scan on archive.org.
// EL is the 1st ed. (1911); TR is the 3rd ed. (1920).
export const BOOKS = {
  EL: { short: 'Elementary Lectures', title: 'Elementary Lectures on Electric Discharges, Waves and Impulses, and Other Transients', ed: '1st ed., McGraw-Hill, 1911', yr: '1911', id: 'elementarylectur00steirich' },
  TR: { short: 'Transient Phenomena', title: 'Theory and Calculation of Transient Electric Phenomena and Oscillations', ed: '3rd ed., McGraw-Hill, 1920', yr: '1920', id: 'theorycalctrans00steirich' },
  ACP: { short: 'AC Phenomena', title: 'Theory and Calculation of Alternating Current Phenomena', ed: '1st ed., W. J. Johnston Co., 1897', yr: '1897', id: 'theorycalcalt00steirich' },
  TEC: { short: 'Electric Circuits', title: 'Theory and Calculation of Electric Circuits', ed: '1st ed., McGraw-Hill, 1917', yr: '1917', id: 'theorycalccirc00steirich' },
};
export function cite(book, page, extra = '') {
  const b = BOOKS[book];
  const url = `https://archive.org/details/${b.id}/page/${page}/mode/1up`;
  return `<a class="cite" href="${url}" target="_blank" rel="noopener" title="Steinmetz, ${b.title}, ${b.ed}, p. ${page}">Steinmetz, <i>${b.short}</i> (${b.yr}), p.&nbsp;${page}${extra ? ', ' + extra : ''}</a>`;
}
