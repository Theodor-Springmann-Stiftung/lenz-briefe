/** Use the same edition prefix in page titles and sharing metadata. */
export function pageTitle(label) {
  return `LKB – ${label.trim()}`;
}

/** Describe the actual letter without claiming commentary or an original. */
export function letterDescription(letter, correspondence) {
  const kind = letter.isDraft ? 'Briefentwurf' : 'Brief';
  return `${kind} ${letter.letter}: ${correspondence}, ${letterDateLabel(letter.events)}. Digitale Edition mit Brieftext und Überlieferung in der kritischen Lenz-Briefausgabe.`;
}

/** Keep editorial date ranges and qualifications, omitting the place prefixes. */
export function letterDateLabel(events) {
  const dates = events.filter((event) => event.type === 'sent').flatMap((event) =>
    event.dates.map((date) => date.text
      .replace(/^[^,]*,\s*/, '')
      .replace(/;\s*[^,;]+,\s*/g, '; ')
      .replace(/(\sund\s)[^\d,;]+,\s*/g, '$1')
      .trim()).filter(Boolean),
  );
  return [...new Set(dates)].join(' · ') || 'Ohne Datierung';
}
