import fs from 'node:fs';
import path from 'node:path';

export interface Part { type: string; text?: string; address?: string; children?: Part[] }
export interface Reference { ref: string; label: string | null; cert: string | null; erschlossen: string | null; annotationParts: Part[] }
export interface DateRecord { text: string; content: Part[]; when?: string; cert?: string }
export interface Event { type: 'sent' | 'received'; dates: DateRecord[]; persons: Reference[]; locations: Reference[] }
export interface Letter {
  letter: string; events: Event[]; groupId: string; personIds: string[]; placeIds: string[];
  traditions: {isOriginal: boolean; type: string}[]; hasOriginal: boolean; isDraft: boolean;
  pages: string[]; handRefs: string[]; sort: {key: number[]; value: string} | null;
}
export interface Sidenote { id: string; page: string; pos: string; annotation: string; html: string; anchorId: string | null; sourceOrder: number }
export interface Tradition { type: string; id?: string; ref?: string; name?: string; category?: string; html: string }
interface Definition { name: string; index: string }
interface Catalog {
  schemaVersion: number; letters: Letter[]; groups: {id: string; label: string; count: number}[];
  people: Record<string, Definition>; places: Record<string, Definition>;
}
const directory = path.resolve(process.cwd(), 'generated');
const status = JSON.parse(fs.readFileSync(path.join(directory, 'status.json'), 'utf8'));
if (status.state !== 'success') throw new Error('The Python export must succeed before building the edition.');
export const catalog: Catalog = JSON.parse(fs.readFileSync(path.join(directory, 'catalog.json'), 'utf8'));
export function letterFiles(id: string) {
  const dir = path.join(directory, 'letters', id);
  const grouped: Record<string, Sidenote[]> = JSON.parse(fs.readFileSync(path.join(dir, 'sidenotes.json'), 'utf8'));
  return {
    text: fs.readFileSync(path.join(dir, 'text.html'), 'utf8'),
    sidenotes: Object.values(grouped).flat().sort((a,b) => a.sourceOrder - b.sourceOrder),
    traditions: JSON.parse(fs.readFileSync(path.join(dir, 'traditions.json'), 'utf8')) as Tradition[],
  };
}
export const base = import.meta.env.BASE_URL;
export const letterUrl = (id: string) => `${base}briefe/${id}/`;
export function correspondents(letter: Letter, type: Event['type']) {
  return new Intl.ListFormat('de', {type:'conjunction'}).format(letter.events.filter(e => e.type === type).flatMap(e => e.persons.map(p => p.label || 'Unbekannt')));
}
export function titleFor(letter: Letter) {
  return `${correspondents(letter, 'sent')} an ${correspondents(letter, 'received')}`;
}
export function sourceLabel(letter: Letter) {
  if (letter.hasOriginal) return 'Original';
  const names: Record<string,string> = {manuscript: 'Handschrift', print: 'Druck', unknown: 'Quelle ungeklärt'};
  const sources = [...new Set(letter.traditions.map(s => names[s.type] || s.type))].join(' · ') || 'Quelle ungeklärt';
  return `Ohne Original · ${sources}`;
}
const escape = (text = '') => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function richText(parts: Part[] = []): string {
  return parts.map(p => {
    if (p.type === 'text') return escape(p.text);
    const children = richText(p.children);
    if (p.type === 'wwwlink' && /^https?:\/\//i.test(p.address || '')) {
      return `<a href="${escape(p.address)}" rel="noreferrer">${children}</a>`;
    }
    return children;
  }).join('');
}
export function filterOptions(kind: 'person' | 'place') {
  const ids = new Set(catalog.letters.flatMap(l => kind === 'person' ? l.personIds : l.placeIds));
  const definitions = kind === 'person' ? catalog.people : catalog.places;
  return [...ids].map(id => ({id, name: definitions[id]?.name || `Unbekannt (${id})`}))
    .sort((a,b) => a.name.localeCompare(b.name, 'de'));
}
