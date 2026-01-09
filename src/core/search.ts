import { KeyNode } from './tree';

export type SearchMode = 'all' | 'key' | 'value';

export type SearchOutcome = {
  matches: KeyNode[];
  message: string;
  isError: boolean;
};

export function buildMatcher(query: string, useRegex: boolean, caseSensitive: boolean):
  | { ok: true; test: (value: string) => boolean }
  | { ok: false; error: string } {
  if (useRegex) {
    try {
      const regex = new RegExp(query, caseSensitive ? '' : 'i');
      return { ok: true, test: (value: string) => regex.test(value) };
    } catch (error) {
      const message = error instanceof Error ? error.message : '정규식 오류';
      return { ok: false, error: `정규식 오류: ${message}` };
    }
  }

  const needle = caseSensitive ? query : query.toLowerCase();
  return {
    ok: true,
    test: (value: string) => {
      const hay = caseSensitive ? value : value.toLowerCase();
      return hay.includes(needle);
    },
  };
}

export function matchesNode(node: KeyNode, test: (value: string) => boolean, mode: SearchMode): boolean {
  if (mode !== 'value') {
    if (test(node.key)) return true;
    if (test(node.path)) return true;
  }

  if (mode !== 'key') {
    if (test(node.sample)) return true;
    const valueText = stringifyForSearch(node.value);
    if (valueText && test(valueText)) return true;
  }

  return false;
}

export function stringifyForSearch(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const text = JSON.stringify(value);
    return text.length > 5000 ? text.slice(0, 5000) : text;
  } catch {
    return String(value);
  }
}

export function typeCategory(typeLabel: string): string {
  if (typeLabel.startsWith('array')) return 'array';
  if (typeLabel === 'object') return 'object';
  if (typeLabel === 'string') return 'string';
  if (typeLabel === 'number') return 'number';
  if (typeLabel === 'boolean') return 'boolean';
  if (typeLabel === 'null') return 'null';
  if (typeLabel === 'undefined') return 'undefined';
  return 'other';
}

