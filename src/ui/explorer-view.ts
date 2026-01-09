import { formatValue, type KeyNode, type TreeBuildResult } from '../core/tree';
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
  addRecentPath: (path: string) => void;
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
    addRecentPath,
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

  detailPanel.appendChild(searchPanel);
  detailPanel.appendChild(recentPanel);

  const tabsBar = document.createElement('div');
  tabsBar.className = 'key-tabs';
  const contents = document.createElement('div');
  contents.className = 'key-tab-contents';
  const emptyState = document.createElement('div');
  emptyState.className = 'key-empty';
  emptyState.textContent = labels.emptyDetail;

  detailPane.appendChild(detailPanel);
  detailPane.appendChild(tabsBar);
  detailPane.appendChild(contents);
  detailPane.appendChild(emptyState);

  layout.appendChild(treePane);
  layout.appendChild(detailPane);
  explorerEl.appendChild(layout);

  const openTabs = new Map<string, { tab: HTMLElement; btn: HTMLButtonElement; content: HTMLElement }>();
  let activeId: string | null = null;

  function setActive(id: string) {
    activeId = id;
    openTabs.forEach((tab, key) => {
      tab.btn.classList.toggle('active', key === id);
      tab.content.classList.toggle('active', key === id);
    });
    emptyState.style.display = openTabs.size > 0 ? 'none' : 'block';
  }

  function closeTab(id: string) {
    const tab = openTabs.get(id);
    if (!tab) return;
    tab.tab.remove();
    tab.content.remove();
    openTabs.delete(id);
    if (activeId === id) {
      const next = openTabs.keys().next().value ?? null;
      if (next) {
        setActive(next);
      } else {
        emptyState.style.display = 'block';
      }
    }
  }

  function openTab(node: KeyNode, options: { skipFocus?: boolean } = {}) {
    const id = node.path || '(root)';
    if (!openTabs.has(id)) {
      const tab = document.createElement('div');
      tab.className = 'key-tab';
      const btn = document.createElement('button');
      btn.className = 'key-tab-btn';
      btn.textContent = id;
      const close = document.createElement('button');
      close.className = 'key-tab-close';
      close.textContent = 'x';
      tab.appendChild(btn);
      tab.appendChild(close);
      tabsBar.appendChild(tab);

      const content = document.createElement('div');
      content.className = 'key-tab-content';
      content.dataset.tabId = id;
      content.appendChild(buildDetail(node));
      contents.appendChild(content);

      btn.addEventListener('click', () => setActive(id));
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        closeTab(id);
      });

      openTabs.set(id, { tab, btn, content });
    }
    setActive(id);
    addRecentPath(id);
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

  function renderNode(node: KeyNode, parent: HTMLElement) {
    const hasChildren = node.children.length > 0;
    if (hasChildren) {
      const details = document.createElement('details');
      details.className = 'key-node';
      details.dataset.path = node.path;
      if (node.path === '(root)') details.open = true;
      const summary = document.createElement('summary');
      summary.textContent = `${node.key} (${node.type})`;
      summary.addEventListener('click', () => {
        openTab(node, { skipFocus: true });
      });
      details.appendChild(summary);
      const childWrap = document.createElement('div');
      childWrap.className = 'key-children';
      node.children.forEach((child) => renderNode(child, childWrap));
      details.appendChild(childWrap);
      parent.appendChild(details);
      allDetails.push(details);
      nodeElements.set(node.path, { label: summary, container: details, isLeaf: false });
      return;
    }

    const item = document.createElement('div');
    item.className = 'key-leaf';
    item.dataset.path = node.path;
    item.textContent = `${node.key} (${node.type})`;
    item.addEventListener('click', () => openTab(node));
    parent.appendChild(item);
    nodeElements.set(node.path, { label: item, container: item, isLeaf: true });
  }

  flatNodes.forEach((node) => nodeByPath.set(node.path, node));
  renderNode(result.root, treePane);

  expandAllBtn.addEventListener('click', () => setAllDetails(allDetails, true));
  collapseAllBtn.addEventListener('click', () => setAllDetails(allDetails, false));
  expandMatchBtn.addEventListener('click', () => expandMatches(nodeElements, currentMatchPaths));

  return {
    nodeByPath,
    nodeElements,
    childRowElements,
    resultMetaEl: searchMeta,
    resultListEl: searchList,
    recentListEl: recentList,
    openTab,
  };
}
