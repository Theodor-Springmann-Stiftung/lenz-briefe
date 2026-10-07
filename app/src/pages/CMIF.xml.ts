import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  const xml = await readFile(path.resolve(process.cwd(), 'generated/CMIF.xml'), 'utf8');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
