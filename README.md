# JSON 필드 탐색기

## 로컬 실행 (Vite)
```cmd
cd C:\Users\kazuk\Downloads\exifviewer
npm install
npm run dev
```
- 브라우저에서 `http://localhost:5173/` 접속
- TypeScript를 직접 실행할 수 없어서 단순 `python -m http.server`만으로는 동작하지 않습니다.

## 빌드
```cmd
npm run build
npm run preview
```
- 프리뷰는 `http://localhost:4173/`

## GitHub Pages
- `pages.yml` 워크플로가 빌드 후 `dist/`를 Pages로 배포합니다.
- 저장소 설정에서 Pages를 활성화하세요.
