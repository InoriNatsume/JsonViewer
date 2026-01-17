export type KeyNode = {
  key: string;
  path: string;
  type: string;
  sample: string;
  value: unknown;
  children: KeyNode[];
  parentPath: string | null;
  childrenLoaded: boolean; // 자식이 로드되었는지 여부
};

export type TreeBuildOptions = {
  maxDepth?: number;
};

export type TreeBuildResult = {
  root: KeyNode;
  nodeCount: number;
  maxDepthSeen: number;
};

// 노드 하나만 생성 (자식은 로드하지 않음)
export function createNode(key: string, path: string, value: unknown, parentPath: string | null): KeyNode {
  return {
    key,
    path,
    type: describeType(value),
    sample: formatSample(value),
    value,
    children: [],
    parentPath,
    childrenLoaded: false,
  };
}

// 노드의 자식들을 로드
export function loadChildren(node: KeyNode): KeyNode[] {
  if (node.childrenLoaded) return node.children;
  
  const value = node.value;
  
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      node.children = value.map((childValue, index) => {
        const childPath = node.path === '(root)' ? `(root)[${index}]` : `${node.path}[${index}]`;
        return createNode(`[${index}]`, childPath, childValue, node.path);
      });
    } else {
      node.children = Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => {
        const childPath = node.path === '(root)' ? childKey : `${node.path}.${childKey}`;
        return createNode(childKey, childPath, childValue, node.path);
      });
    }
  } else if (typeof value === 'string') {
    const parsed = maybeParseJsonString(value);
    if (parsed) {
      const jsonPath = node.path === '(root)' ? '(json)' : `${node.path}(json)`;
      node.children = [createNode('(json)', jsonPath, parsed, node.path)];
    }
  }
  
  node.childrenLoaded = true;
  return node.children;
}

// 노드가 자식을 가질 수 있는지 확인
export function hasChildrenPotential(node: KeyNode): boolean {
  if (node.childrenLoaded) return node.children.length > 0;
  
  const value = node.value;
  if (value && typeof value === 'object') return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 && (trimmed[0] === '{' || trimmed[0] === '[');
  }
  return false;
}

// 초기 트리 빌드 (루트 + 1단계만)
export function buildKeyTree(obj: unknown, options: TreeBuildOptions = {}): TreeBuildResult | null {
  const root = createNode('(root)', '(root)', obj, null);
  loadChildren(root); // 1단계만 로드
  
  return {
    root,
    nodeCount: 1 + root.children.length,
    maxDepthSeen: root.children.length > 0 ? 1 : 0,
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

export type DepthSchema = {
  depth: number;
  keyCount: number;
  keys: string[];
}[];

export function calculateDepthSchema(root: KeyNode): DepthSchema {
  const depthMap = new Map<number, Set<string>>();
  
  function traverse(node: KeyNode, depth: number) {
    if (!depthMap.has(depth)) {
      depthMap.set(depth, new Set());
    }
    depthMap.get(depth)!.add(node.key);
    
    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  }
  
  traverse(root, 0);
  
  const result: DepthSchema = [];
  const maxDepth = Math.max(...depthMap.keys());
  
  for (let d = 0; d <= maxDepth; d++) {
    const keys = depthMap.get(d);
    result.push({
      depth: d,
      keyCount: keys ? keys.size : 0,
      keys: keys ? Array.from(keys) : [],
    });
  }
  
  return result;
}

// 원본 JSON 객체에서 직접 스키마 계산 (노드 제한 없음)
export function calculateDepthSchemaFromRaw(obj: unknown, maxDepth: number = 50): DepthSchema {
  const depthMap = new Map<number, Set<string>>();
  const visited = new WeakSet<object>();
  
  function traverse(value: unknown, key: string, depth: number) {
    if (depth > maxDepth) return;
    
    if (!depthMap.has(depth)) {
      depthMap.set(depth, new Set());
    }
    depthMap.get(depth)!.add(key);
    
    if (value && typeof value === 'object') {
      if (visited.has(value as object)) return;
      visited.add(value as object);
      
      if (Array.isArray(value)) {
        value.forEach((childValue, index) => {
          traverse(childValue, `[${index}]`, depth + 1);
        });
      } else {
        Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
          traverse(childValue, childKey, depth + 1);
        });
      }
    } else if (typeof value === 'string') {
      // 문자열 JSON 파싱 시도
      const trimmed = value.trim();
      if (trimmed && (trimmed[0] === '{' || trimmed[0] === '[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            traverse(parsed, '(json)', depth + 1);
          }
        } catch {
          // 파싱 실패 무시
        }
      }
    }
  }
  
  traverse(obj, '(root)', 0);
  
  const result: DepthSchema = [];
  if (depthMap.size === 0) return result;
  
  const maxDepthSeen = Math.max(...depthMap.keys());
  
  for (let d = 0; d <= maxDepthSeen; d++) {
    const keys = depthMap.get(d);
    result.push({
      depth: d,
      keyCount: keys ? keys.size : 0,
      keys: keys ? Array.from(keys) : [],
    });
  }
  
  return result;
}
