import { SearchOutcome } from '../core/search';
import { KeyNode, DepthSchema } from '../core/tree';

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

export function renderCurrentLocation(
  currentPath: string,
  recentListEl: HTMLDivElement | null,
  onOpenPath: (path: string) => void,
  onCopyPath: (path: string) => void,
) {
  if (!recentListEl) return;
  recentListEl.innerHTML = '';

  if (!currentPath) {
    const empty = document.createElement('div');
    empty.className = 'result-sub';
    empty.textContent = '선택된 항목이 없습니다.';
    recentListEl.appendChild(empty);
    return;
  }

  // 경로를 파싱하여 브레드크럼 형태로 분리
  // 예: module.assets[0].name → [module, assets, [0], name]
  // 깊이는 1부터 시작 (root가 0이므로)
  const segments = parsePathToSegments(currentPath);
  
  const breadcrumbContainer = document.createElement('div');
  breadcrumbContainer.className = 'breadcrumb-container';
  
  let accumulatedPath = '';
  
  // (root)인 경우 깊이 0
  const isRoot = currentPath === '(root)';
  const startDepth = isRoot ? 0 : 1;
  
  segments.forEach((segment, idx) => {
    // 누적 경로 생성
    if (idx === 0) {
      accumulatedPath = segment;
    } else if (segment.startsWith('[')) {
      accumulatedPath += segment;
    } else {
      accumulatedPath += '.' + segment;
    }
    
    const crumb = document.createElement('span');
    crumb.className = 'breadcrumb-item';
    
    // 깊이 표시 추가 (root가 0이므로 첫 번째 키는 1부터)
    const depth = startDepth + idx;
    const depthSpan = document.createElement('span');
    depthSpan.className = 'breadcrumb-depth';
    depthSpan.textContent = String(depth);
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'breadcrumb-name';
    nameSpan.textContent = segment;
    
    crumb.appendChild(depthSpan);
    crumb.appendChild(nameSpan);
    crumb.title = `깊이 ${depth}: ${accumulatedPath}`;
    
    const pathForClick = accumulatedPath;
    crumb.addEventListener('click', () => {
      onOpenPath(pathForClick);
    });
    
    breadcrumbContainer.appendChild(crumb);
    
    // 구분자 추가 (마지막 제외)
    if (idx < segments.length - 1) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '›';
      breadcrumbContainer.appendChild(separator);
    }
  });
  
  // 복사 버튼
  const copyBtn = document.createElement('button');
  copyBtn.className = 'mini-btn breadcrumb-copy';
  copyBtn.textContent = '복사';
  copyBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onCopyPath(currentPath);
  });
  
  recentListEl.appendChild(breadcrumbContainer);
  recentListEl.appendChild(copyBtn);
}

// 경로를 세그먼트로 분리하는 헬퍼 함수
function parsePathToSegments(path: string): string[] {
  const segments: string[] = [];
  let current = '';
  let i = 0;
  
  while (i < path.length) {
    const char = path[i];
    
    if (char === '.') {
      if (current) {
        segments.push(current);
        current = '';
      }
      i++;
    } else if (char === '[') {
      if (current) {
        segments.push(current);
        current = '';
      }
      // 배열 인덱스 찾기
      let bracketContent = '[';
      i++;
      while (i < path.length && path[i] !== ']') {
        bracketContent += path[i];
        i++;
      }
      if (i < path.length) {
        bracketContent += ']';
        i++;
      }
      segments.push(bracketContent);
    } else {
      current += char;
      i++;
    }
  }
  
  if (current) {
    segments.push(current);
  }
  
  return segments;
}

export function renderDepthSchema(
  schema: DepthSchema,
  schemaListEl: HTMLDivElement | null,
) {
  if (!schemaListEl) return;
  schemaListEl.innerHTML = '';

  if (schema.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'result-sub';
    empty.textContent = '스키마 정보가 없습니다.';
    schemaListEl.appendChild(empty);
    return;
  }

  const MAX_DISPLAY_KEYS = 50; // 최대 표시 개수

  // 벡터 컨테이너 (한 줄로 표시)
  const vectorContainer = document.createElement('div');
  vectorContainer.className = 'schema-vector';

  const openParen = document.createElement('span');
  openParen.className = 'schema-paren';
  openParen.textContent = '(';
  vectorContainer.appendChild(openParen);

  let selectedIndex: number | null = null;

  // 키 상세 표시 영역
  const keysDetail = document.createElement('div');
  keysDetail.className = 'schema-keys-detail';
  keysDetail.style.display = 'none';

  schema.forEach((item, idx) => {
    const element = document.createElement('span');
    element.className = 'schema-element';
    element.textContent = String(item.keyCount);
    element.title = `깊이 ${item.depth}: ${item.keyCount}개 키`;
    
    element.addEventListener('click', () => {
      // 이전 선택 해제
      vectorContainer.querySelectorAll('.schema-element').forEach(el => {
        el.classList.remove('selected');
      });
      
      if (selectedIndex === idx) {
        // 같은 것 클릭하면 닫기
        selectedIndex = null;
        keysDetail.style.display = 'none';
      } else {
        // 새로 선택
        selectedIndex = idx;
        element.classList.add('selected');
        
        keysDetail.innerHTML = '';
        keysDetail.style.display = 'block';
        
        const header = document.createElement('div');
        header.className = 'schema-keys-header';
        header.textContent = `깊이 [${item.depth}]의 키 (${item.keys.length}개)`;
        keysDetail.appendChild(header);
        
        const keysList = document.createElement('div');
        keysList.className = 'schema-keys-list';
        
        // 최대 개수까지만 표시
        const displayCount = Math.min(item.keys.length, MAX_DISPLAY_KEYS);
        
        for (let i = 0; i < displayCount; i++) {
          const keyEl = document.createElement('span');
          keyEl.className = 'schema-key-item';
          keyEl.textContent = item.keys[i];
          keysList.appendChild(keyEl);
        }
        
        // 생략 표시
        if (item.keys.length > MAX_DISPLAY_KEYS) {
          const omitted = document.createElement('span');
          omitted.className = 'schema-key-omitted';
          omitted.textContent = `... 외 ${item.keys.length - MAX_DISPLAY_KEYS}개`;
          keysList.appendChild(omitted);
        }
        
        keysDetail.appendChild(keysList);
      }
    });

    vectorContainer.appendChild(element);

    if (idx < schema.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'schema-comma';
      comma.textContent = ', ';
      vectorContainer.appendChild(comma);
    }
  });

  const closeParen = document.createElement('span');
  closeParen.className = 'schema-paren';
  closeParen.textContent = ')';
  vectorContainer.appendChild(closeParen);

  schemaListEl.appendChild(vectorContainer);
  schemaListEl.appendChild(keysDetail);
}
