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
