# [PRD] SnapQuest [F7] 엔딩 개인화 네컷 티켓 & 전리품 캔버스 합성 기능

## 1. 프로젝트 개요 & 목표
- **기능명**: [F7] 엔딩 네컷 티켓 (SnapQuest MVP 킬러 기능)
- **목표**: 호스트가 `[파티 종료]`(파티 상태 `ended`)를 트리거했을 때, 게스트가 본인 사진 4장을 선택(또는 상위 4장 규칙 기반 자동 추천)하여 **HTML5 Canvas**를 통해 **`[내 사진 4장 + AI 캐릭터 + F6 칭호 + 닉네임 + 프레임]`**이 인스타 스토리 규격(9:16)으로 1초 만에 0원 원가로 자동 합성되고, 폰 갤러리에 다운로드하거나 SNS로 공유할 수 있는 엔딩 전리품 시스템을 구축한다.
- **기술 스택**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide-React, HTML5 Canvas API, `html2canvas` (또는 순수 캔버스 렌더러)

---

## 2. 에이전트 운영 규칙 (Loop Rules)
1. **작업 디렉토리 준수**: 모든 파일 생성/수정/테스트/커밋은 반드시 현재 프로젝트 루트 디렉토리 내부에서만 수행한다.
2. **단일 태스크 처리 원칙**: 한 번의 반복(Iteration)에서 **오직 1개의 미완료 태스크(`- [ ]`)만** 처리한다.
3. **자가 검증 필수**: 코드를 수정한 뒤 반드시 빌드(`npm run build`) 또는 테스트를 실행하여 정상 작동을 확인한다.
4. **상태 기록 및 커밋**:
   - 태스크 완료 후 `progress.txt`에 작업 내역을 상세히 append한다.
   - `PRD_F7.md`의 해당 태스크 체크박스를 `- [x]`로 변경한다.
   - 의미 있는 커밋 메시지로 git commit을 실행한다 (예: `feat: [F7] Task 1 - 네컷 티켓 및 프레임 데이터 모델 정의`).

---

## 3. 세부 구현 태스크 목록 (Checklist)

- [x] **Task 1: F7 네컷 티켓 및 프레임 데이터 타입 정의 & 프리셋 구축**
  - `types/ticket.ts`:
    - `TicketFrame`: `id`, `name`, `theme`, `backgroundColor`, `borderColor`, `isLocked`, `unlockCondition`
    - `TicketComposition`: `roomId`, `participantId`, `participantName`, `titleText`, `avatarUrl`, `photoUrls[4]`, `frameId`, `composedImageUrl`, `createdAt`
  - `data/preset-frames.ts`: 기본 무료 프레임 3종(클래식 영수증, 네온 파티, 레트로 롤필름) + 해금 프레임 2종(골드 트로피, 사이버펑크)
  - *Done when*: 타입 에러 없이 import 가능 및 TypeScript 컴파일 성공

- [ ] **Task 2: 캔버스 결정적 합성 유틸리티 구현 (`lib/ticket-composer.ts`)**
  - 순수 HTML5 Canvas API 기반 1080×1920 (9:16 인스타 스토리 규격) 합성 엔진
  - 사진 4장을 2×2 또는 1×4 세로 그리드로 배치 (부족한 칸은 캐릭터 아바타 및 칭호 엠블럼으로 자동 채움)
  - 상단/하단 텍스트 오버레이: 파티 날짜, 방 코드, 닉네임, F6 칭호("K-케미장인"), D-7 보관 만료 문구
  - CORS 이미지 로딩 에러 방지 처리 및 고화질 PNG DataURL / Blob 변환
  - *Done when*: 더미 사진 4장과 칭호 텍스트를 전달했을 때 1080×1920 PNG 이미지 DataURL이 0.5초 내로 생성됨

- [ ] **Task 3: 게스트용 네컷 사진 선택 & 프레임 커스텀 UI (`components/ticket/TicketCustomizer.tsx`)**
  - 모바일 최적화된 사진 4장 선택 그리드 (원클릭 AI 상위 4장 자동 추천 버튼 포함)
  - 프레임 테마 선택 슬라이더/탭 (실시간 캔버스 미리보기)
  - 4장 미만 선택 시 캐릭터 카드로 자동 채워지는 시각적 안내
  - *Done when*: 사용자가 사진과 프레임을 고르면 실시간 티켓 프리뷰가 즉각 갱신됨

- [ ] **Task 4: 완성된 네컷 티켓 저장 & 공유 뷰 구현 (`components/ticket/TicketResultView.tsx`)**
  - 영수증 스타일의 네컷 티켓 완성 팝업 연출 (티켓이 인쇄되어 나오는 애니메이션)
  - **[이미지 저장]** 원클릭 다운로드 버튼 (`<a> download`)
  - **[인스타 스토리 공유]** 모바일 웹 공유 API(`navigator.share`) 연동 (미지원 브라우저는 클립보드 링크 복사 폴백)
  - *Done when*: 다운로드 클릭 시 `snapquest-ticket-[code].png` 파일이 정상 저장됨

- [ ] **Task 5: TV 스크린 엔딩 전리품 전시 뷰 (`components/ticket/TvEndingView.tsx`)**
  - 파티 상태가 `ended`일 때 TV 대형 화면 연출
  - 참가자들의 완성된 네컷 티켓들이 롤필름 형태로 벽면에 서서히 채워지는 앤딩 크레딧 갤러리 렌더링
  - 방 링크 7일 보관 안내 및 단체 전리품 프레임 자동 노출
  - *Done when*: TV 스크린에 참가자들의 네컷 티켓 카드들이 아름다운 그리드로 전시됨

- [ ] **Task 6: F9 파티 종료(`status: ended`) 생애주기 통합 및 전체 빌드 검증**
  - `app/room/[id]/page.tsx`:
    - 호스트가 `[파티 종료]`를 누르면 TV는 `TvEndingView`로, 게스트는 `TicketCustomizer` ➔ `TicketResultView`로 자동 라우팅
  - `npm run build`를 통한 전체 애플리케이션 빌드 검증
  - *Done when*: `npm run build` 성공 및 방 생성부터 포토월, 시상식, 네컷 티켓 합성까지 0 에러 완주 확인
