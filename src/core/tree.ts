export type KeyNode = {
  key: string;
  path: string;
  type: string;
  sample: string;
  value: unknown;
  children: KeyNode[];
  parentPath: string | null;
};

export type TreeBuildOptions = {
  maxNodes?: number;
  maxDepth?: number;
};

export type TreeBuildResult = {
  root: KeyNode;
  nodeCount: number;
  maxDepthSeen: number;
  truncated: boolean;
};

export function buildKeyTree(obj: unknown, options: TreeBuildOptions = {}): TreeBuildResult | null {
  const maxNodes = options.maxNodes ?? 2800;
  const maxDepth = options.maxDepth ?? 14;
  const visited = new WeakSet<object>();
  let nodeCount = 0;
  let truncated = false;
  let maxDepthSeen = 0;

  function makeNode(key: string, path: string, value: unknown, depth: number, parentPath: string | null): KeyNode | null {
    if (nodeCount >= maxNodes) {
      truncated = true;
      return null;
    }

    nodeCount += 1;
    maxDepthSeen = Math.max(maxDepthSeen, depth);

    const node: KeyNode = {
      key,
      path,
      type: describeType(value),
      sample: formatSample(value),
      value,
      children: [],
      parentPath,
    };

    if (depth >= maxDepth) return node;

    if (value && typeof value === 'object') {
      if (visited.has(value as object)) return node;
      visited.add(value as object);

      if (Array.isArray(value)) {
        value.forEach((childValue, index) => {
          const childPath = `${path}[${index}]`;
          const child = makeNode(`[${index}]`, childPath, childValue, depth + 1, path);
          if (child) node.children.push(child);
        });
      } else {
        Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
          const nextPath = path && path !== '(root)' ? `${path}.${childKey}` : childKey;
          const child = makeNode(childKey, nextPath, childValue, depth + 1, path);
          if (child) node.children.push(child);
        });
      }
      return node;
    }

    if (typeof value === 'string') {
      const parsed = maybeParseJsonString(value);
      if (parsed) {
        const jsonPath = path && path !== '(root)' ? `${path}(json)` : '(json)';
        const child = makeNode('(json)', jsonPath, parsed, depth + 1, path);
        if (child) node.children.push(child);
      }
    }

    return node;
  }

  const root = makeNode('(root)', '(root)', obj, 0, null);
  if (!root) return null;

  return {
    root,
    nodeCount,
    maxDepthSeen,
    truncated,
  };
}

export function flattenTree(root: KeyNode): KeyNode[] {
  const list: KeyNode[] = [];
  const stack: KeyNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    list.push(node);
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i]);
    }
  }
  return list;
}

export function formatSample(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  } catch {
    return String(value);
  }
}

export function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function maybeParseJsonString(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    return null;
  }
  return null;
}
