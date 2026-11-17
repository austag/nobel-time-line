import { FIELDS, type Field } from './data';

export type Route =
  | { name: 'home'; field: Field | 'all'; year: number | 'all' }
  | { name: 'about' }
  | { name: 'experiment'; year: number; field: string; chapter?: string }
  | { name: 'notfound' };

// "#/", "#/?field=physics&year=2025", "#/2026/physics", "#/2026/physics?ch=3", "#/about" 를 해석한다.
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    const params = new URLSearchParams(query);
    const f = params.get('field');
    const y = Number(params.get('year'));
    return {
      name: 'home',
      field: FIELDS.includes(f as Field) ? (f as Field) : 'all',
      year: Number.isInteger(y) && y > 0 ? y : 'all',
    };
  }
  if (parts.length === 1 && parts[0] === 'about') return { name: 'about' };
  if (parts.length === 2 && /^\d{4}$/.test(parts[0])) {
    const ch = new URLSearchParams(query).get('ch');
    const route: Route = { name: 'experiment', year: Number(parts[0]), field: parts[1] };
    if (ch && /^[\w-]{1,20}$/.test(ch)) route.chapter = ch;
    return route;
  }
  return { name: 'notfound' };
}

export function homeHash(field: Field | 'all', year: number | 'all'): string {
  const params = new URLSearchParams();
  if (field !== 'all') params.set('field', field);
  if (year !== 'all') params.set('year', String(year));
  const q = params.toString();
  return q ? `#/?${q}` : '#/';
}

export function experimentHash(year: number, field: string, chapter?: string): string {
  return chapter ? `#/${year}/${field}?ch=${chapter}` : `#/${year}/${field}`;
}
