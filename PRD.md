# [PRD] SnapQuest [F4] 라이브 포토월 + 사회자 기능

## 1. 프로젝트 개요 & 목표
- **기능명**: [F4] 라이브 포토월 + 사회자 (SnapQuest MVP 코어 기능)
- **목표**: 게스트가 미션 인증한 사진과 캡션이 현장 TV 스크린(`?role=tv`)에 실시간 렌더링되고, AI 사회자 리액션 멘트가 부착되며, 호스트 폰 화면(`?role=host`)에서 원치 않는 사진을 즉시 숨김 처리할 수 있는 반응형 웹 화면 및 상태 관리 시스템을 구축한다.
- **기술 스택**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide-React

---

## 2. 에이전트 운영 규칙 (Loop Rules)
1. **작업 디렉토리 준수**: 모든 파일 생성/수정/테스트/커밋은 반드시 현재 프로젝트 루트 디렉토리 내부에서만 수행한다.
2. **단일 태스크 처리 원칙**: 한 번의 반복(Iteration)에서 **오직 1개의 미완료 태스크(`- [ ]`)만** 처리한다.
3. **자가 검증 필수**: 코드를 수정한 뒤 반드시 빌드(`npm run build`) 또는 테스트를 실행하여 정상 작동을 확인한다.
4. **상태 기록 및 커밋**:
   - 태스크 완료 후 `progress.txt`에 작업 내역, 해결한 문제, 다음 태스크를 상세히 append한다 (기존 내용 절대 삭제 금지).
   - `PRD.md`의 해당 태스크 체크박스를 `- [x]`로 변경한다.
   - 의미 있는 커밋 메시지로 git commit을 실행한다 (예: `feat: [F4] Task 2 - 타입 및 시드 데이터 작성`).

---

## 3. 세부 구현 태스크 목록 (Checklist)

- [x] **Task 1: Next.js + Tailwind CSS 프로젝트 기반 환경 구성**
  - Next.js (App Router), TypeScript, Tailwind CSS, Lucide-React 설치 및 기본 디렉토리 구조 설정
  - 글로벌 스타일(`app/globals.css`), 레이아웃(`app/layout.tsx`) 구성
  - *Done when*: `npm run build` 성공 및 기본 개발 서버 에러 없음

- [ ] **Task 2: F4 데이터 타입 정의 및 시드/프리셋 데이터 구축**
  - `types/photowall.ts`: `PhotoItem` (id, photoUrl, caption, participantName, participantAvatar, missionTitle, timestamp, isHidden), `ReactionMessage` (id, text, type, createdAt) 타입 정의
  - `data/preset-reactions.ts`: AI 사회자 호출 실패/지연 시 사용할 카테고리별 프리셋 멘트 목록 (텐션업, 감탄, 케미칭찬 등 15개 이상)
  - `data/seed-photos.ts`: 사진이 0장일 때 빈 화면을 방지할 봇/시드 사진 및 캡션 데이터 6개 이상 구성
  - *Done when*: 타입 에러 없이 import 가능하고 단위 테스트 또는 TypeScript 컴파일 성공

- [ ] **Task 3: TV 스크린용 라이브 포토월 뷰 구현 (`?role=tv`)**
  - `components/photowall/TvPhotoWall.tsx`: 
    - 빔프로젝터/대형 화면에 최적화된 다크 테마 기반 그리드/메이슨리 레이아웃
    - 신규 사진 도착 시 화면 중앙 강조 팝업 및 부드러운 페이드인/스케일 애니메이션
    - 상단/하단 실시간 사회자 리액션 멘트 롤링 배너 (`components/photowall/HostReactionBanner.tsx`)
    - 숨김(`isHidden: true`) 처리된 사진은 실시간 필터링되어 화면에서 즉시 제거
    - 사진 0장일 때 시드 콘텐츠 표시
    - 조작 버튼이 전혀 없는 표시 전용(Display-only) UI
  - *Done when*: `TvPhotoWall` 컴포넌트가 목(Mock) 데이터로 레이아웃과 애니메이션을 정상 렌더링함

- [ ] **Task 4: 호스트용 폰 컨트롤 뷰 구현 (`?role=host`)**
  - `components/photowall/HostPhotoWallControl.tsx`:
    - 모바일 화면에 최적화된 업로드 사진 카드 리스트
    - 각 사진별 **[숨김 / 복구]** 원클릭 토글 버튼
    - 숨김 상태 표시 배지 및 필터 (전체 / 노출 중 / 숨김)
    - 수동 사회자 멘트 트리거 또는 테스트용 사진 추가 버튼 (개발/데모용)
  - *Done when*: `HostPhotoWallControl`에서 숨김 버튼 클릭 시 상태가 즉시 토글되는 인터랙션 확인

- [ ] **Task 5: 포토월 상태 관리 훅 (`usePhotoWall`) 및 실시간 동기화 연동**
  - `hooks/usePhotoWall.ts`:
    - 방 ID(`roomId`)별 사진 목록, 숨김 목록, 사회자 멘트 상태 관리
    - 사진 추가(`addPhoto`), 사진 숨김 토글(`toggleHidePhoto`), 멘트 추가(`addReaction`) 액션 제공
    - Supabase Realtime 채널 구독 연동 준비 (환경변수 없을 경우 로컬 상태/BroadcastChannel 폴백 지원)
    - 탭 비활성화 후 복귀 시 자동 재동기화(`visibilitychange` 이벤트 리스너)
  - *Done when*: 훅을 통해 사진 추가 및 숨김 처리 시 `TvPhotoWall`과 `HostPhotoWallControl`에 즉시 동기화 반영

- [ ] **Task 6: 통합 라우팅 페이지 구성 및 전체 검증**
  - `app/room/[id]/page.tsx`:
    - URL 쿼리 파라미터 `role`에 따라 화면 분기 (`?role=tv` → `TvPhotoWall`, `?role=host` → `HostPhotoWallControl`, 기본값은 게스트 뷰)
    - 시드 데이터 리셋 및 데모 시뮬레이터 기능 포함
  - 전체 프로젝트 빌드(`npm run build`) 및 린트 검증
  - *Done when*: `npm run build` 성공 및 `/room/test-room?role=tv`, `/room/test-room?role=host` 페이지가 정상 작동함
