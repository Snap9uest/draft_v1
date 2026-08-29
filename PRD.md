# [PRD] SnapQuest [F9] 호스트 진행 도구 (Host Facilitator)

## 1. 프로젝트 개요 & 목표
- **기능명**: [F9] 호스트 진행 도구 (SnapQuest MVP 코어 기능)
- **목표**: 호스트가 로그인 없이 3번의 클릭 이내로 방을 생성하고 QR/방코드를 발급받아 TV에 띄우며, 폰 컨트롤 뷰(`?role=host`)에서 파티의 전체 생애주기(로비 → 진행 → 시상 → 종료)를 손쉽게 제어할 수 있는 호스트 전용 진행 도구를 구축한다.
- **기술 스택**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide-React, `qrcode.react` (또는 QR 생성기)

---

## 2. 에이전트 운영 규칙 (Loop Rules)
1. **작업 디렉토리 준수**: 모든 파일 생성/수정/테스트/커밋은 반드시 현재 프로젝트 루트 디렉토리 내부에서만 수행한다.
2. **단일 태스크 처리 원칙**: 한 번의 반복(Iteration)에서 **오직 1개의 미완료 태스크(`- [ ]`)만** 처리한다.
3. **자가 검증 필수**: 코드를 수정한 뒤 반드시 빌드(`npm run build`) 또는 테스트를 실행하여 정상 작동을 확인한다.
4. **상태 기록 및 커밋**:
   - 태스크 완료 후 `progress.txt`에 작업 내역을 상세히 append한다.
   - `PRD_F9.md`의 해당 태스크 체크박스를 `- [x]`로 변경한다.
   - 의미 있는 커밋 메시지로 git commit을 실행한다 (예: `feat: [F9] Task 1 - 방 생성 및 호스트 토큰 모델 정의`).

---

## 3. 세부 구현 태스크 목록 (Checklist)

- [x] **Task 1: F9 방 및 파티 생애주기 데이터 타입 & 상태 모델 정의**
  - `types/room.ts`:
    - `RoomStatus`: `'lobby' | 'live' | 'award' | 'ended'`
    - `TonePreset`: `'icebreaking' | 'casual' | 'drinking' | 'workshop'`
    - `Room`: `id`, `code` (6자리 영숫자), `hostToken` (UUID/랜덤키), `tonePreset`, `rewardToggle` (boolean), `status`, `createdAt`, `updatedAt`
  - `lib/room-storage.ts`: 호스트 토큰 로컬스토리지 저장 및 검증 유틸리티
  - *Done when*: 타입 에러 없이 import 가능 및 TypeScript 컴파일 성공

- [x] **Task 2: 초간단 방 생성 플로우 UI 구현 (`/create` 또는 메인 랜딩)**
  - `components/room/CreateRoomModal.tsx` 또는 `app/create/page.tsx`:
    - 클릭 2~3회로 방 생성 (방 이름/톤 프리셋 선택 → 즉시 방 생성 완료)
    - 방 생성 시 고유 `roomId`, `code`, `hostToken` 자동 생성
    - 생성 완료 후 호스트를 `/room/[id]?role=host&token=[hostToken]`으로 자동 이동
  - *Done when*: 방 만들기 버튼 클릭 시 정상적으로 방이 생성되고 호스트 페이지로 라우팅됨

- [x] **Task 3: TV 대기/로비 화면 QR 및 방코드 렌더러 (`?role=tv`)**
  - `components/room/TvLobbyView.tsx`:
    - 대형 스크린에 최적화된 고화질 QR 코드 및 6자리 입장 코드 표시
    - 게스트 입장 URL 안내 (`/join/[code]` 또는 `/room/[id]`)
    - 파티 상태가 `lobby`일 때 입장 대기 연출, `live`로 전환 시 게임/포토월 화면으로 자동 전환
    - 호스트 조작 버튼은 전혀 표시되지 않는 표시 전용(Display-only) 화면
  - *Done when*: `?role=tv` 접속 시 QR 코드와 방 코드가 선명하게 표시되고 상태 변화에 반응함

- [ ] **Task 4: 호스트 폰 컨트롤 패널 UI (`?role=host`)**
  - `components/host/HostControlPanel.tsx`:
    - 모바일 최적화 헤더 (방 코드, 현재 파티 상태 배지, 참가자 수)
    - **파티 생애주기 컨트롤 버튼**:
      - `[파티 시작]` (lobby → live)
      - `[시상식 시작]` (live → award)
      - `[파티 종료]` (award → ended, 확인 팝업 포함)
    - **부가 설정 토글**:
      - 미션 톤 프리셋 변경 드롭다운
      - 현장 리워드(음료 교환권 등) 온/오프 토글 (기본값: false)
    - 호스트 토큰 인증 실패 시 "권한 없음" 안내 화면 표시
  - *Done when*: 호스트 패널에서 버튼 클릭 시 파티 상태(`status`)가 순차적으로 변경됨

- [ ] **Task 5: 파티 생애주기 실시간 동기화 훅 (`useRoomSession`)**
  - `hooks/useRoomSession.ts`:
    - 방 상태(`status`), 톤 프리셋, 리워드 토글 관리
    - `changeStatus(nextStatus)`, `updateTonePreset(tone)`, `toggleReward(bool)` 액션 제공
    - TV 뷰와 호스트 뷰 간 상태 실시간 동기화 (BroadcastChannel 또는 Supabase 채널 연동)
    - 호스트 재접속 시 로컬 토큰 검증 및 이전 진행 상태 복원
  - *Done when*: 호스트가 상태를 변경하면 TV 화면이 실시간으로 로비 → 포토월 → 시상 → 엔딩으로 즉시 전환됨

- [ ] **Task 6: F9 전체 플로우 통합 및 빌드 검증**
  - `/create` → `/room/[id]?role=tv` & `/room/[id]?role=host` 플로우 연동
  - 리워드 토글이 꺼져 있을 때 게스트 화면에 리워드 문구가 노출되지 않는 비즈니스 규칙 검증
  - 전체 프로젝트 빌드(`npm run build`) 확인
  - *Done when*: `npm run build` 성공 및 방 생성부터 파티 상태 전환까지 에러 없이 동작 확인
