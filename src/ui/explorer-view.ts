import { formatValue, loadChildren, hasChildrenPotential, type KeyNode, type TreeBuildResult } from '../core/tree';
import { copyToClipboard } from './dom';
import { expandMatches, focusOnNode, setAllDetails, updateChildRowHighlights } from './tree-helpers';
import type { NodeElementEntry } from './types';

export type ExplorerLabels = {
  treeTitle: string;
  treeNoteTruncated: string;
  treeNoteDefault: string;
  expandAll: string;
  collapseAll: string;
  expandMatches: string;
  searchTitle: string;
  recentTitle: string;
  schemaTitle: string;
  emptyDetail: string;
  copyPath: string;
  detailPath: string;
  detailType: string;
  detailSample: string;
  detailValue: string;
  childKey: string;
  childType: string;
  childSample: string;
};

export type ExplorerView = {
  nodeByPath: Map<string, KeyNode>;
  nodeElements: Map<string, NodeElementEntry>;
  childRowElements: Map<string, HTMLTableRowElement>;
  resultMetaEl: HTMLDivElement;
  resultListEl: HTMLDivElement;
  recentListEl: HTMLDivElement;
  schemaListEl: HTMLDivElement;
  openTab: (node: KeyNode, options?: { skipFocus?: boolean }) => void;
};

type ExplorerViewOptions = {
  explorerEl: HTMLElement;
  result: TreeBuildResult;
  flatNodes: KeyNode[];
  currentMatchPaths: Set<string>;
  pinnedPaths: Set<string>;
  isResultsOnlyActive: () => boolean;
  applyResultsOnlyVisibility: (matchPaths: Set<string>, enabled: boolean) => void;
  setCurrentLocation: (path: string) => void;
  setStatus: (text: string) => void;
  labels: ExplorerLabels;
};

export function renderExplorerView(options: ExplorerViewOptions): ExplorerView {
  const {
    explorerEl,
    result,
    flatNodes,
    currentMatchPaths,
    pinnedPaths,
    isResultsOnlyActive,
    applyResultsOnlyVisibility,
    setCurrentLocation,
    setStatus,
    labels,
  } = options;

  explorerEl.innerHTML = '';

  const nodeByPath = new Map<string, KeyNode>();
  const nodeElements = new Map<string, NodeElementEntry>();
  const childRowElements = new Map<string, HTMLTableRowElement>();
  const allDetails: HTMLDetailsElement[] = [];

  const layout = document.createElement('div');
  layout.className = 'explorer-layout';

  const treePane = document.createElement('div');
  treePane.className = 'tree-pane';

  const treeHeader = document.createElement('div');
  treeHeader.className = 'tree-header';
  const treeHeaderLeft = document.createElement('div');
  treeHeaderLeft.className = 'tree-header-left';
  const treeTitle = document.createElement('div');
  treeTitle.className = 'tree-title';
  treeTitle.textContent = labels.treeTitle;
  const treeNote = document.createElement('div');
  treeNote.className = 'tree-note';
  treeNote.textContent = result.truncated ? labels.treeNoteTruncated : labels.treeNoteDefault;
  treeHeaderLeft.appendChild(treeTitle);
  treeHeaderLeft.appendChild(treeNote);

  const treeActions = document.createElement('div');
  treeActions.className = 'tree-actions';
  const expandAllBtn = document.createElement('button');
  expandAllBtn.className = 'action-btn';
  expandAllBtn.textContent = labels.expandAll;
  const collapseAllBtn = document.createElement('button');
  collapseAllBtn.className = 'action-btn';
  collapseAllBtn.textContent = labels.collapseAll;
  const expandMatchBtn = document.createElement('button');
  expandMatchBtn.className = 'action-btn';
  expandMatchBtn.textContent = labels.expandMatches;
  treeActions.appendChild(expandAllBtn);
  treeActions.appendChild(collapseAllBtn);
  treeActions.appendChild(expandMatchBtn);

  treeHeader.appendChild(treeHeaderLeft);
  treeHeader.appendChild(treeActions);
  treePane.appendChild(treeHeader);

  const detailPane = document.createElement('div');
  detailPane.className = 'detail-pane';

  const detailPanel = document.createElement('div');
  detailPanel.className = 'detail-panel';

  const searchPanel = document.createElement('div');
  searchPanel.className = 'panel-block';
  const searchTitle = document.createElement('div');
  searchTitle.className = 'panel-title';
  searchTitle.textContent = labels.searchTitle;
  const searchMeta = document.createElement('div');
  searchMeta.className = 'result-meta';
  const searchList = document.createElement('div');
  searchList.className = 'result-list';
  searchPanel.appendChild(searchTitle);
  searchPanel.appendChild(searchMeta);
  searchPanel.appendChild(searchList);

  const recentPanel = document.createElement('div');
  recentPanel.className = 'panel-block';
  const recentTitle = document.createElement('div');
  recentTitle.className = 'panel-title';
  recentTitle.textContent = labels.recentTitle;
  const recentList = document.createElement('div');
  recentList.className = 'recent-list';
  recentPanel.appendChild(recentTitle);
  recentPanel.appendChild(recentList);

  const schemaPanel = document.createElement('div');
  schemaPanel.className = 'panel-block schema-panel';
  const schemaTitleEl = document.createElement('div');
  schemaTitleEl.className = 'panel-title';
  schemaTitleEl.textContent = labels.schemaTitle;
  const schemaList = document.createElement('div');
  schemaList.className = 'schema-list';
  schemaPanel.appendChild(schemaTitleEl);
  schemaPanel.appendChild(schemaList);

  detailPanel.appendChild(searchPanel);
  detailPanel.appendChild(schemaPanel);
  detailPanel.appendChild(recentPanel);

  const detailContent = document.createElement('div');
  detailContent.className = 'key-detail-content';
  const emptyState = document.createElement('div');
  emptyState.className = 'key-empty';
  emptyState.textContent = labels.emptyDetail;

  detailPane.appendChild(detailPanel);
  detailPane.appendChild(detailContent);
  detailPane.appendChild(emptyState);

  layout.appendChild(treePane);
  layout.appendChild(detailPane);
  explorerEl.appendChild(layout);

  let currentNode: KeyNode | null = null;

  function showDetail(node: KeyNode) {
    currentNode = node;
    detailContent.innerHTML = '';
    detailContent.appendChild(buildDetail(node));
    emptyState.style.display = 'none';
    detailContent.style.display = 'block';
  }

  function openTab(node: KeyNode, options: { skipFocus?: boolean } = {}) {
    const id = node.path || '(root)';
    showDetail(node);
    setCurrentLocation(id);
    if (!options.skipFocus) {
      focusOnNode(nodeElements, id);
    }
    if (isResultsOnlyActive()) {
      pinnedPaths.add(id);
      applyResultsOnlyVisibility(currentMatchPaths, true);
    }
  }

  function buildDetail(node: KeyNode) {
    const wrap = document.createElement('div');
    wrap.className = 'key-detail-body';

    const copyRow = document.createElement('div');
    copyRow.className = 'copy-row';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'mini-btn';
    copyBtn.textContent = labels.copyPath;
    copyBtn.addEventListener('click', () => copyToClipboard(node.path, setStatus));
    copyRow.appendChild(copyBtn);

    const metaTable = document.createElement('table');
    metaTable.className = 'key-detail-table';
    metaTable.appendChild(makeDetailRow(labels.detailPath, node.path));
    metaTable.appendChild(makeDetailRow(labels.detailType, node.type));
    metaTable.appendChild(makeDetailRow(labels.detailSample, node.sample));

    const value = formatValue(node.value);
    if (value !== '') {
      metaTable.appendChild(makeDetailRow(labels.detailValue, value, true));
    }

    wrap.appendChild(copyRow);
    wrap.appendChild(metaTable);

    if (node.children.length > 0) {
      const childrenTable = document.createElement('table');
      childrenTable.className = 'key-children-table';
      const head = document.createElement('tr');
      [labels.childKey, labels.childType, labels.childSample].forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        head.appendChild(th);
      });
      const thead = document.createElement('thead');
      thead.appendChild(head);
      childrenTable.appendChild(thead);

      const tbody = document.createElement('tbody');
      node.children.forEach((child) => {
        const tr = document.createElement('tr');
        tr.className = 'key-child-row';
        tr.dataset.path = child.path;
        const tdKey = document.createElement('td');
        tdKey.textContent = child.key;
        const tdType = document.createElement('td');
        tdType.textContent = child.type;
        const tdSample = document.createElement('td');
        tdSample.textContent = child.sample;
        tr.appendChild(tdKey);
        tr.appendChild(tdType);
        tr.appendChild(tdSample);
        tr.addEventListener('click', () => openTab(child));
        tbody.appendChild(tr);
        childRowElements.set(child.path, tr);
      });
      childrenTable.appendChild(tbody);
      wrap.appendChild(childrenTable);
    }

    updateChildRowHighlights(childRowElements, currentMatchPaths);
    applyResultsOnlyVisibility(currentMatchPaths, isResultsOnlyActive());

    return wrap;
  }

  function makeDetailRow(label: string, value: string, isPre = false) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = label;
    const td = document.createElement('td');
    if (isPre) {
      const pre = document.createElement('pre');
      pre.textContent = value;
      td.appendChild(pre);
    } else {
      td.textContent = value;
    }
    tr.appendChild(th);
    tr.appendChild(td);
    return tr;
  }

  // 경로에서 깊이 계산
  function getDepthFromPath(path: string): number {
    if (path === '(root)') return 0;
    let depth = 1; // 첫 번째 키부터 깊이 1
    for (let i = 0; i < path.length; i++) {
      if (path[i] === '.' || path[i] === '[') {
        depth++;
      }
    }
    // '['로 시작하는 경우 보정 (예: (root)[0])
    if (path.includes('(root)[')) {
      depth--; // (root)[ 후의 첫 번째가 깊이 1
    }
    return depth;
  }

  function renderNode(node: KeyNode, parent: HTMLElement) {
    const hasPotentialChildren = hasChildrenPotential(node);
    const depth = getDepthFromPath(node.path);
    
    if (hasPotentialChildren) {
      const details = document.createElement('details');
      details.className = 'key-node';
      details.dataset.path = node.path;
      if (node.path === '(root)') details.open = true;
      
      const summary = document.createElement('summary');
      
      // 깊이 뱃지 추가
      const depthBadge = document.createElement('span');
      depthBadge.className = 'tree-depth-badge';
      depthBadge.textContent = String(depth);
      
      const nodeText = document.createTextNode(` ${node.key} (${node.type})`);
      summary.appendChild(depthBadge);
      summary.appendChild(nodeText);
      
      summary.addEventListener('click', (e) => {
        // 상세 탭 열기
        openTab(node, { skipFocus: true });
      });
      details.appendChild(summary);
      
      const childWrap = document.createElement('div');
      childWrap.className = 'key-children';
      childWrap.dataset.loaded = 'false';
      details.appendChild(childWrap);
      
      // 펼칠 때 자식 로드 (선택적 로딩)
      details.addEventListener('toggle', () => {
        if (details.open && childWrap.dataset.loaded === 'false') {
          childWrap.dataset.loaded = 'true';
          const children = loadChildren(node);
          children.forEach((child) => {
            nodeByPath.set(child.path, child);
            renderNode(child, childWrap);
          });
        }
      });
      
      // 루트는 이미 열려있으므로 즉시 자식 로드
      if (node.path === '(root)') {
        childWrap.dataset.loaded = 'true';
        const children = loadChildren(node);
        children.forEach((child) => {
          nodeByPath.set(child.path, child);
          renderNode(child, childWrap);
        });
      }
      
      parent.appendChild(details);
      allDetails.push(details);
      nodeElements.set(node.path, { label: summary, container: details, isLeaf: false });
      return;
    }

    const item = document.createElement('div');
    item.className = 'key-leaf';
    item.dataset.path = node.path;
    
    // 깊이 뱃지 추가
    const depthBadge = document.createElement('span');
    depthBadge.className = 'tree-depth-badge';
    depthBadge.textContent = String(depth);
    item.appendChild(depthBadge);
    item.appendChild(document.createTextNode(` ${node.key} (${node.type})`));
    
    item.addEventListener('click', () => openTab(node));
    parent.appendChild(item);
    nodeElements.set(node.path, { label: item, container: item, isLeaf: true });
  }

  flatNodes.forEach((node) => nodeByPath.set(node.path, node));
  renderNode(result.root, treePane);

  expandAllBtn.addEventListener('click', () => {
    // 현재 로드된 노드만 펼침 (선택적 로딩이므로 전체 펼치기는 로드된 것만)
    setAllDetails(allDetails, true);
    setStatus('로드된 노드만 펼쳐집니다');
  });
  collapseAllBtn.addEventListener('click', () => setAllDetails(allDetails, false));
  expandMatchBtn.addEventListener('click', () => expandMatches(nodeElements, currentMatchPaths));

  return {
    nodeByPath,
    nodeElements,
    childRowElements,
    resultMetaEl: searchMeta,
    resultListEl: searchList,
    recentListEl: recentList,
    schemaListEl: schemaList,
    openTab,
  };
}
