import type { Consent } from '../engine/constants';

export type RosterRow = { name: string; consent: Consent };

export function parseRoster(text: string): RosterRow[] {
  const rows: RosterRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(.*),\s*(yes|no)\s*$/i.exec(line);
    if (!match) {
      rows.push({ name: line, consent: null });
      continue;
    }
    const name = match[1].trim();
    if (!name) continue;
    rows.push({ name, consent: match[2].toLowerCase() === 'yes' ? 'yes' : 'no' });
  }
  return rows;
}
