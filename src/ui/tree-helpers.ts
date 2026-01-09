import { KeyNode } from '../core/tree';
import { NodeElementEntry } from './types';

export function updateHighlights(
  nodeElements: Map<string, NodeElementEntry>,
  matchPaths: Set<string>,
) {
  matchPaths.forEach((path) => {
    const entry = nodeElements.get(path);
    if (!entry) return;
    if (entry.isLeaf) {
      entry.container.classList.add('match-hit-leaf');
    } else {
      entry.label.classList.add('match-hit');
    }
  });
}

export function updateChildRowHighlights(
  childRowElements: Map<string, HTMLTableRowElement>,
  matchPaths: Set<string>,
) {
  childRowElements.forEach((row, path) => {
    row.classList.toggle('match-hit-row', matchPaths.has(path));
  });
}

export function clearHighlights(
  nodeElements: Map<string, NodeElementEntry>,
  childRowElements: Map<string, HTMLTableRowElement>,
) {
  nodeElements.forEach((entry) => {
    entry.label.classList.remove('match-hit');
    entry.container.classList.remove('match-hit-leaf');
  });
  childRowElements.forEach((row) => {
    row.classList.remove('match-hit-row');
  });
}

export function updateResultsOnlyVisibility(
  nodeElements: Map<string, NodeElementEntry>,
  childRowElements: Map<string, HTMLTableRowElement>,
  nodeByPath: Map<string, KeyNode>,
  rootPath: string | null,
  matchPaths: Set<string>,
  enabled: boolean,
  pinnedPaths: Set<string>,
) {
  if (!enabled) {
    nodeElements.forEach((entry) => {
      entry.container.style.display = '';
    });
    childRowElements.forEach((row) => {
      row.style.display = '';
    });
    return;
  }

  const visible = buildVisiblePaths(nodeByPath, rootPath, matchPaths, pinnedPaths);
  nodeElements.forEach((entry, path) => {
    entry.container.style.display = visible.has(path) ? '' : 'none';
  });
  childRowElements.forEach((row, path) => {
    row.style.display = matchPaths.has(path) ? '' : 'none';
  });
}

export function setAllDetails(allDetails: HTMLDetailsElement[], open: boolean) {
  allDetails.forEach((details) => {
    details.open = open;
  });
}

export function expandMatches(
  nodeElements: Map<string, NodeElementEntry>,
  matchPaths: Set<string>,
) {
  matchPaths.forEach((path) => {
    const entry = nodeElements.get(path);
    if (!entry) return;
    openAncestorDetails(entry.container);
  });
}

export function focusOnNode(
  nodeElements: Map<string, NodeElementEntry>,
  path: string,
) {
  const entry = nodeElements.get(path);
  if (!entry) return;
  openAncestorDetails(entry.container);
  entry.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function openAncestorDetails(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.tagName.toLowerCase() === 'details') {
      (current as HTMLDetailsElement).open = true;
    }
    current = current.parentElement;
  }
}

function buildVisiblePaths(
  nodeByPath: Map<string, KeyNode>,
  rootPath: string | null,
  matchPaths: Set<string>,
  pinnedPaths: Set<string>,
): Set<string> {
  const visible = new Set<string>();
  matchPaths.forEach((path) => addAncestors(nodeByPath, path, visible));
  pinnedPaths.forEach((path) => {
    addAncestors(nodeByPath, path, visible);
    const node = nodeByPath.get(path);
    if (node) addSubtree(node, visible);
  });
  if (rootPath) {
    visible.add(rootPath);
  }
  return visible;
}

function addAncestors(
  nodeByPath: Map<string, KeyNode>,
  path: string,
  visible: Set<string>,
) {
  let current = nodeByPath.get(path) ?? null;
  while (current) {
    visible.add(current.path);
    if (!current.parentPath) break;
    current = nodeByPath.get(current.parentPath) ?? null;
  }
}

function addSubtree(node: KeyNode, visible: Set<string>) {
  visible.add(node.path);
  node.children.forEach((child) => addSubtree(child, visible));
}
