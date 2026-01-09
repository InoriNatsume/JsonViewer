import { buildKeyTree, flattenTree } from './core/tree';
import { buildMatcher, matchesNode, typeCategory, SearchMode } from './core/search';
import { buildExportCsv, buildExportJson } from './core/exporter';
import { copyToClipboard, downloadText, mustGet } from './ui/dom';
import { renderExplorerView, type ExplorerLabels } from './ui/explorer-view';
import { renderRecentPaths, renderSearchResults } from './ui/panels';
import {
  clearHighlights,
  focusOnNode,
  updateChildRowHighlights,
  updateHighlights,
  updateResultsOnlyVisibility,
} from './ui/tree-helpers';
import { NodeElementEntry } from './ui/types';

const DEFAULT_BUILD_OPTIONS = {
  maxNodes: 2800,
  maxDepth: 14,
};

const EXPLORER_LABELS: ExplorerLabels = {
  treeTitle: 'Tree',
  treeNoteTruncated: '노드 제한으로 일부만 표시됩니다.',
  treeNoteDefault: '클릭해서 세부 정보를 여세요.',
  expandAll: '전체 펼치기',
  collapseAll: '전체 접기',
  expandMatches: '결과 펼치기',
  searchTitle: '검색 결과',
  recentTitle: '최근 경로',
  emptyDetail: '왼쪽에서 항목을 선택하면 상세 정보가 표시됩니다.',
  copyPath: '경로 복사',
  detailPath: 'Path',
  detailType: 'Type',
  detailSample: 'Sample',
  detailValue: 'Value',
  childKey: 'Key',
  childType: 'Type',
  childSample: 'Sample',
};


const fileInput = mustGet<HTMLInputElement>('fileInput');
const clearButton = mustGet<HTMLButtonElement>('btn-clear');
const explorer = mustGet<HTMLElement>('explorer');
const fileNameEl = mustGet<HTMLSpanElement>('file-name');
const nodeCountEl = mustGet<HTMLSpanElement>('node-count');
const depthCountEl = mustGet<HTMLSpanElement>('depth-count');
const statusEl = mustGet<HTMLSpanElement>('status');

const searchInput = mustGet<HTMLInputElement>('searchInput');
const searchMode = mustGet<HTMLSelectElement>('searchMode');
const searchRegex = mustGet<HTMLInputElement>('searchRegex');
const searchCase = mustGet<HTMLInputElement>('searchCase');
const clearSearchButton = mustGet<HTMLButtonElement>('btn-clear-search');
const exportJsonButton = mustGet<HTMLButtonElement>('btn-export-json');
const exportCsvButton = mustGet<HTMLButtonElement>('btn-export-csv');
const resultsOnlyInput = mustGet<HTMLInputElement>('resultsOnly');
const typeFilterInputs = Array.from(document.querySelectorAll<HTMLInputElement>('.type-filter'));

let currentTree: ReturnType<typeof buildKeyTree> = null;
let flatNodes: ReturnType<typeof flattenTree> = [];
let nodeByPath = new Map<string, ReturnType<typeof flattenTree>[number]>();
let nodeElements = new Map<string, NodeElementEntry>();
let childRowElements = new Map<string, HTMLTableRowElement>();
let currentMatchPaths = new Set<string>();
let lastMatches: ReturnType<typeof flattenTree> = [];
let pinnedPaths = new Set<string>();
let recentPaths: string[] = [];
let searchTimer: number | null = null;
let openTabHandler: ((node: ReturnType<typeof flattenTree>[number]) => void) | null = null;

let resultMetaEl: HTMLDivElement | null = null;
let resultListEl: HTMLDivElement | null = null;
let recentListEl: HTMLDivElement | null = null;

init();

function init() {
  setEmptyState('JSON 파일을 올려주세요.', '드래그 & 드롭 또는 위 버튼을 사용하세요.');

  fileInput.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    await handleFile(file);
  });

  clearButton.addEventListener('click', () => {
    fileInput.value = '';
    currentTree = null;
    flatNodes = [];
    lastMatches = [];
    pinnedPaths.clear();
    updateMeta(null, null);
    setStatus('대기');
    setEmptyState('JSON 파일을 올려주세요.', '드래그 & 드롭 또는 위 버튼을 사용하세요.');
  });

  explorer.addEventListener('dragover', (event) => {
    event.preventDefault();
    explorer.classList.add('dragover');
  });

  explorer.addEventListener('dragleave', () => {
    explorer.classList.remove('dragover');
  });

  explorer.addEventListener('drop', async (event) => {
    event.preventDefault();
    explorer.classList.remove('dragover');
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    fileInput.value = '';
    await handleFile(file);
  });

  searchInput.addEventListener('input', () => scheduleSearch());
  searchMode.addEventListener('change', () => applySearch());
  searchRegex.addEventListener('change', () => applySearch());
  searchCase.addEventListener('change', () => applySearch());
  clearSearchButton.addEventListener('click', () => {
    searchInput.value = '';
    applySearch();
  });
  resultsOnlyInput.addEventListener('change', () => applySearch());
  exportJsonButton.addEventListener('click', () => exportMatches('json'));
  exportCsvButton.addEventListener('click', () => exportMatches('csv'));
  typeFilterInputs.forEach((input) => {
    input.addEventListener('change', () => applySearch());
  });
}

async function handleFile(file: File) {
  setStatus('불러오는 중...');

  const text = await file.text();
  const parsed = parseJson(text);

  if (!parsed.ok) {
    currentTree = null;
    flatNodes = [];
    lastMatches = [];
    pinnedPaths.clear();
    updateMeta(file.name, null);
    setStatus('파싱 실패');
    setEmptyState('JSON 파싱에 실패했어요.', parsed.error);
    return;
  }

  const treeResult = buildKeyTree(parsed.value, DEFAULT_BUILD_OPTIONS);

  currentTree = treeResult;
  flatNodes = treeResult ? flattenTree(treeResult.root) : [];
  pinnedPaths.clear();

  updateMeta(file.name, treeResult);
  setStatus(treeResult?.truncated ? '일부만 표시됨' : '로드됨');
  renderExplorer(treeResult);
}

function renderExplorer(result: ReturnType<typeof buildKeyTree>) {
  nodeByPath = new Map();
  nodeElements = new Map();
  childRowElements = new Map();
  currentMatchPaths.clear();
  openTabHandler = null;
  resultMetaEl = null;
  resultListEl = null;
  recentListEl = null;

  if (!result) {
    explorer.classList.add('is-empty');
    setEmptyState('탐색 가능한 데이터가 없습니다.', 'JSON 구조를 확인해주세요.');
    return;
  }

  explorer.classList.remove('is-empty');

  const view = renderExplorerView({
    explorerEl: explorer,
    result,
    flatNodes,
    currentMatchPaths,
    pinnedPaths,
    isResultsOnlyActive,
    applyResultsOnlyVisibility,
    addRecentPath,
    setStatus,
    labels: EXPLORER_LABELS,
  });

  nodeByPath = view.nodeByPath;
  nodeElements = view.nodeElements;
  childRowElements = view.childRowElements;
  resultMetaEl = view.resultMetaEl;
  resultListEl = view.resultListEl;
  recentListEl = view.recentListEl;
  openTabHandler = view.openTab;

  renderRecentPaths(recentPaths, recentListEl, handleOpenPath, handleCopyPath);
  applySearch();
}

function updateMeta(fileName: string | null, result: ReturnType<typeof buildKeyTree>) {
  fileNameEl.textContent = fileName ?? '파일 없음';
  if (!result) {
    nodeCountEl.textContent = '노드: -';
    depthCountEl.textContent = '깊이: -';
    return;
  }
  nodeCountEl.textContent = result.truncated ? `노드: ${result.nodeCount}+` : `노드: ${result.nodeCount}`;
  depthCountEl.textContent = `깊이: ${result.maxDepthSeen}`;
}

function setStatus(text: string) {
  statusEl.textContent = text;
}

function setEmptyState(title: string, sub: string) {
  explorer.innerHTML = '';
  explorer.classList.add('is-empty');

  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';

  const titleEl = document.createElement('div');
  titleEl.className = 'empty-title';
  titleEl.textContent = title;

  const subEl = document.createElement('p');
  subEl.className = 'empty-sub';
  subEl.textContent = sub;

  const hintEl = document.createElement('div');
  hintEl.className = 'empty-hint';
  hintEl.textContent = 'JSON 안에 문자열 JSON이 있으면 자동으로 펼칩니다.';

  wrapper.appendChild(titleEl);
  wrapper.appendChild(subEl);
  wrapper.appendChild(hintEl);
  explorer.appendChild(wrapper);
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { ok: false, error: '내용이 비어 있습니다.' };
  }
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return { ok: false, error: `JSON 파싱 실패: ${message}` };
  }
}

function scheduleSearch() {
  if (searchTimer !== null) {
    window.clearTimeout(searchTimer);
  }
  searchTimer = window.setTimeout(() => {
    applySearch();
  }, 120);
}

function applySearch() {
  if (!currentTree) {
    renderSearchResults(
      { matches: [], message: 'JSON 파일을 올려주세요.', isError: false },
      resultMetaEl,
      resultListEl,
      handleOpenNode,
      handleCopyPath,
    );
    return;
  }

  const query = searchInput.value.trim();
  const mode = (searchMode.value || 'all') as SearchMode;
  const useRegex = searchRegex.checked;
  const caseSensitive = searchCase.checked;
  const activeTypes = getActiveTypeFilters();
  const resultsOnlyActive = isResultsOnlyActive();

  if (!resultsOnlyActive) {
    pinnedPaths.clear();
  }

  if (activeTypes.size === 0) {
    lastMatches = [];
    clearHighlights(nodeElements, childRowElements);
    currentMatchPaths.clear();
    applyResultsOnlyVisibility(currentMatchPaths, false);
    renderSearchResults(
      { matches: [], message: '타입 필터가 모두 꺼져 있습니다.', isError: true },
      resultMetaEl,
      resultListEl,
      handleOpenNode,
      handleCopyPath,
    );
    return;
  }

  if (!query) {
    lastMatches = [];
    clearHighlights(nodeElements, childRowElements);
    currentMatchPaths.clear();
    applyResultsOnlyVisibility(currentMatchPaths, false);
    renderSearchResults(
      { matches: [], message: '검색어를 입력하세요.', isError: false },
      resultMetaEl,
      resultListEl,
      handleOpenNode,
      handleCopyPath,
    );
    return;
  }

  const matcher = buildMatcher(query, useRegex, caseSensitive);
  if (!matcher.ok) {
    lastMatches = [];
    clearHighlights(nodeElements, childRowElements);
    currentMatchPaths.clear();
    applyResultsOnlyVisibility(currentMatchPaths, false);
    renderSearchResults(
      { matches: [], message: matcher.error, isError: true },
      resultMetaEl,
      resultListEl,
      handleOpenNode,
      handleCopyPath,
    );
    setStatus('정규식 오류');
    return;
  }

  const matches = flatNodes.filter((node) => {
    const category = typeCategory(node.type);
    if (!activeTypes.has(category)) return false;
    return matchesNode(node, matcher.test, mode);
  });

  lastMatches = matches;
  currentMatchPaths.clear();
  matches.forEach((node) => currentMatchPaths.add(node.path));
  clearHighlights(nodeElements, childRowElements);
  updateHighlights(nodeElements, currentMatchPaths);
  updateChildRowHighlights(childRowElements, currentMatchPaths);
  applyResultsOnlyVisibility(currentMatchPaths, resultsOnlyActive);

  const message = `검색 결과: ${matches.length}개`;
  renderSearchResults(
    { matches, message, isError: false },
    resultMetaEl,
    resultListEl,
    handleOpenNode,
    handleCopyPath,
  );
}

function isResultsOnlyActive(): boolean {
  return resultsOnlyInput.checked && searchInput.value.trim() !== '';
}

function getRootPath(): string | null {
  return currentTree?.root?.path ?? null;
}

function applyResultsOnlyVisibility(matchPaths: Set<string>, enabled: boolean) {
  updateResultsOnlyVisibility(
    nodeElements,
    childRowElements,
    nodeByPath,
    getRootPath(),
    matchPaths,
    enabled,
    pinnedPaths,
  );
}

function handleCopyPath(path: string) {
  copyToClipboard(path, setStatus);
}

function handleOpenNode(node: ReturnType<typeof flattenTree>[number]) {
  if (openTabHandler) {
    openTabHandler(node);
  } else {
    focusOnNode(nodeElements, node.path);
  }
}

function handleOpenPath(path: string) {
  const node = nodeByPath.get(path);
  if (node && openTabHandler) {
    openTabHandler(node);
  } else {
    focusOnNode(nodeElements, path);
  }
}

function getActiveTypeFilters(): Set<string> {
  const set = new Set<string>();
  typeFilterInputs.forEach((input) => {
    if (input.checked) set.add(input.value);
  });
  return set;
}

function addRecentPath(path: string) {
  recentPaths = [path, ...recentPaths.filter((item) => item !== path)].slice(0, 8);
  renderRecentPaths(recentPaths, recentListEl, handleOpenPath, handleCopyPath);
}

function exportMatches(format: 'json' | 'csv') {
  if (!currentTree) {
    setStatus('먼저 JSON 파일을 올려주세요.');
    return;
  }
  if (lastMatches.length === 0) {
    setStatus('내보낼 검색 결과가 없습니다.');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (format === 'json') {
    const content = buildExportJson(lastMatches);
    downloadText(`json-search-${timestamp}.json`, content, 'application/json');
    setStatus('JSON 저장됨');
    return;
  }

  const content = buildExportCsv(lastMatches);
  downloadText(`json-search-${timestamp}.csv`, content, 'text/csv');
  setStatus('CSV 저장됨');
}




