import type { DateRecord, Letter } from './edition';

const germanDate = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});
const germanList = new Intl.ListFormat('de', { type: 'conjunction' });

export function citationDate(date: DateRecord): string {
  if (date.when && /^\d{4}-\d{2}-\d{2}$/.test(date.when)) {
    const parsed = new Date(`${date.when}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date.when)
      return germanDate.format(parsed);
  }
  const comma = date.text.indexOf(', ');
  return (comma < 0 ? date.text : date.text.slice(comma + 2)).trim();
}

/** The citation body is generated once; only the access date belongs to the browser. */
export function citationFor(letter: Letter): string {
  const sent = letter.events.filter((event) => event.type === 'sent');
  const received = letter.events.filter((event) => event.type === 'received');
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
  const parties = (events: typeof sent) =>
    germanList.format(
      unique(events.flatMap((event) => event.persons.map((p) => p.label || 'Unbekannt'))),
    ) || 'Unbekannt';
  const places = (events: typeof sent) =>
    germanList.format(
      unique(events.flatMap((event) => event.locations.map((p) => p.label || 'Unbekannter Ort'))),
    );
  const dates =
    unique(sent.flatMap((event) => event.dates.map(citationDate))).join('; ') || 'Ohne Datierung';
  return (
    [parties(sent), places(sent), `an ${parties(received)}`, places(received), dates]
      .filter(Boolean)
      .join(', ') +
    ', in: Jakob Michael Reinhold Lenz: Kritische Briefausgabe, hrsg. v. Gregor Babelotzky (Heidelberg 2026ff).'
  );
}
