import { KeyNode } from './tree';

export function buildExportJson(matches: KeyNode[]): string {
  const payload = matches.map((node) => ({
    path: node.path,
    key: node.key,
    type: node.type,
    sample: node.sample,
    value: stringifyValue(node.value),
  }));
  return JSON.stringify(payload, null, 2);
}

export function buildExportCsv(matches: KeyNode[]): string {
  const header = ['path', 'key', 'type', 'sample', 'value'];
  const rows = matches.map((node) => [
    node.path,
    node.key,
    node.type,
    node.sample,
    stringifyValue(node.value),
  ]);
  const lines = [
    header.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  return lines.join('\n');
}

function stringifyValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function csvCell(value: string): string {
  const safe = value.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n');
  return `"${safe.replace(/"/g, '""')}"`;
}

