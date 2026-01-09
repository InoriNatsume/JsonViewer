import { SearchOutcome } from '../core/search';
import { KeyNode } from '../core/tree';

export function renderSearchResults(
  outcome: SearchOutcome,
  resultMetaEl: HTMLDivElement | null,
  resultListEl: HTMLDivElement | null,
  onOpenNode: (node: KeyNode) => void,
  onCopyPath: (path: string) => void,
) {
  if (!resultMetaEl || !resultListEl) return;

  resultMetaEl.textContent = outcome.message;
  resultListEl.innerHTML = '';

  if (outcome.matches.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'result-sub';
    empty.textContent = outcome.isError ? '검색 설정을 확인해주세요.' : '검색 결과가 없습니다.';
    resultListEl.appendChild(empty);
    return;
  }

  const maxItems = 200;
  outcome.matches.slice(0, maxItems).forEach((node) => {
    const item = document.createElement('div');
    item.className = 'result-item';

    const left = document.createElement('div');
    const path = document.createElement('div');
    path.className = 'result-path';
    path.textContent = node.path;
    const sub = document.createElement('div');
    sub.className = 'result-sub';
    sub.textContent = `${node.type} · ${node.sample}`;
    left.appendChild(path);
    left.appendChild(sub);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'mini-btn';
    copyBtn.textContent = '복사';
    copyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      onCopyPath(node.path);
    });

    item.appendChild(left);
    item.appendChild(copyBtn);
    item.addEventListener('click', () => {
      onOpenNode(node);
    });

    resultListEl.appendChild(item);
  });

  if (outcome.matches.length > maxItems) {
    const more = document.createElement('div');
    more.className = 'result-sub';
    more.textContent = `상위 ${maxItems}개만 표시합니다.`;
    resultListEl.appendChild(more);
  }
}

export function renderRecentPaths(
  recentPaths: string[],
  recentListEl: HTMLDivElement | null,
  onOpenPath: (path: string) => void,
  onCopyPath: (path: string) => void,
) {
  if (!recentListEl) return;
  recentListEl.innerHTML = '';

  if (recentPaths.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'result-sub';
    empty.textContent = '최근 경로가 없습니다.';
    recentListEl.appendChild(empty);
    return;
  }

  recentPaths.forEach((pathValue) => {
    const item = document.createElement('div');
    item.className = 'recent-item';

    const path = document.createElement('div');
    path.className = 'recent-path';
    path.textContent = pathValue;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'mini-btn';
    copyBtn.textContent = '복사';
    copyBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      onCopyPath(pathValue);
    });

    item.appendChild(path);
    item.appendChild(copyBtn);
    item.addEventListener('click', () => {
      onOpenPath(pathValue);
    });

    recentListEl.appendChild(item);
  });
}
