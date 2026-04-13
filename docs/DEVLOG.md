# para.Dice — 개발 진행 기록

> 마지막 업데이트: 2026-04-13

---

## 프로젝트 개요

**주사위 눈 합계 21을 6면에 자유 배치하는 전략형 1대1 웹 주사위 게임**

비추이적 주사위(Non-transitive Dice) 원리를 활용한 덱 빌딩 + 실시간 대전 서비스.

- **서비스 URL**: https://paradice.zangnan.games
- **서버**: https://para-dice-production.up.railway.app
- **레포지토리**: https://github.com/zangnangames/para-dice

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 클라이언트 | React 18, Vite, Zustand, Socket.io-client |
| 서버 | Fastify, Socket.io, Node.js (ESM) |
| DB (영구) | PostgreSQL + Prisma ORM |
| DB (휘발) | Redis (게임룸·세션·매칭큐) |
| 인증 | JWT (7일) + Google OAuth 2.0 (HMAC 무상태 state) |
| 번들 | tsup (server), Vite (client) |
| 배포 | Railway (서버·DB·Redis), Vercel (클라이언트) |

---

## 모노레포 구조

```
para.Dice/
├── packages/
│   ├── core/          # 순수 게임 로직 (공유)
│   ├── client/        # React + Vite 프론트엔드
│   └── server/        # Fastify + Socket.io 백엔드
├── docs/
│   ├── PHASE-1.md ~ PHASE-4.md   # 개발 계획
│   └── DEVLOG.md                 # 이 파일
├── Dockerfile         # 단일 스테이지 Alpine 빌드
├── railway.json
└── vercel.json
```

---

## Phase 1 — 게임 로직 + 로컬 시뮬레이터 ✅ 완료

### 구현 내용

**`@dice-game/core` 패키지**

| 파일 | 역할 |
|------|------|
| `types.ts` | Die, Deck, DraftPick, RollResult, GameState 타입 |
| `validator.ts` | validateDie (합계 21 검증), validateDeck, validateDraftPick |
| `engine.ts` | rollDie, rollRound, resolveRound (동점 재대결), applyRoundResult |

**핵심 게임 규칙 구현**
- 주사위 1개: 6면, 합계 반드시 21
- 덱: 주사위 4개 구성
- 드래프트: 4개 중 3개 선택 + 출전 순서 봉인
- 2선승제, 동점 시 동일 주사위로 재대결 (승패 결정까지 반복)

**클라이언트**
- 덱 빌더 UI (주사위 4개, 면 편집, 실시간 합계 표시)
- 로컬 시뮬레이터 (AI 상대와 전 과정 플레이 가능)
- 드래프트 페이즈 → 라운드 진행 → 결과 화면

---

## Phase 2 — 인증 + DB + 실시간 대전 ✅ 완료

### DB 스키마 (Prisma)

```
User ─┬─< Deck ─< Die
      │      └── DeckStats (승/패/총판)
      ├── UserStats (승/패/연승/최고연승)
      └─< Match >─ User
             └─< Round (라운드별 결과 JSON)
```

### 서버 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/auth/google` | Google OAuth 시작 |
| GET | `/auth/google/callback` | OAuth 콜백, JWT 발급 후 클라이언트 리다이렉트 |
| GET | `/auth/me` | 현재 유저 정보 |
| PATCH | `/auth/me` | 닉네임 수정 |
| GET | `/decks` | 내 덱 목록 (승률 포함) |
| POST | `/decks` | 덱 저장 |
| PUT | `/decks/:id` | 덱 수정 |
| DELETE | `/decks/:id` | 덱 삭제 |
| GET | `/stats/users/:id/stats` | 유저 통계 |
| GET | `/stats/users/:id/matches` | 대전 기록 (최신 10개) |
| GET | `/stats/decks/rankings` | 전체 덱 승률 랭킹 (5판↑, 상위 20) |
| GET | `/stats/decks/:id/stats` | 덱 통계 |
| POST | `/stats/ai-match` | AI 대전 결과 기록 |

### Socket.io 이벤트

| 방향 | 이벤트 | 설명 |
|------|--------|------|
| c→s | `queue:join` | 랜덤 매칭 큐 입장 |
| s→c | `queue:matched` | 매칭 성사, matchId 전달 |
| c→s | `room:join` | 게임룸 입장 |
| s→c | `room:ready` | 양쪽 입장 완료, 상대 정보·덱 전달 |
| c→s | `draft:pick` | 드래프트 선택 봉인 |
| s→c | `draft:done` | 양쪽 봉인 완료 |
| s→c | `draft:timeout` | 타임아웃 자동 선택 알림 |
| c→s | `round:roll` | 주사위 던지기 (클라 애니메이션 결과 전달) |
| s→c | `round:result` | 라운드 결과 (서버 검증) |
| s→c | `round:draw` | 동점, 재대결 필요 |
| s→c | `game:over` | 게임 종료 |
| c→s | `rematch:request` | 재대결 요청 |
| s→c | `rematch:matched` | 양쪽 수락, 새 matchId |
| c→s | `room:create` | 비공개 방 생성 |
| c→s | `room:enter` | 방 코드로 입장 |

---

## Phase 3 — 매칭 시스템 + 게임 UX ✅ 완료 (3D 애니메이션 제외)

### 랜덤 매칭 시스템

- Redis List (`queue:waiting`)에 userId:socketId 형태로 큐잉
- 2명 대기 시 즉시 매칭, Match 레코드 생성 후 양쪽에 `queue:matched` emit
- 덱 없는 유저는 큐에서 제외 후 재삽입

### 게임 상태 관리

- **인메모리 Map** → **Redis** 이관 (서버 재시작·멀티 인스턴스 대비)
- 핵심 키 패턴:
  ```
  match:{matchId}            # 전체 룸 상태 JSON (TTL 1시간)
  match:{matchId}:player:0   # 플레이어 슬롯 (레이스 컨디션 방지용 개별 저장)
  match:{matchId}:player:1
  socket:{socketId}          # socketId → matchId 역방향 조회
  match:{matchId}:rematch    # 재대결 요청 상태 (TTL 30초)
  ```

### 드래프트 타임아웃

- 서버: 양쪽 입장 완료 시 **40초** 타이머 시작 (`setTimeout`, 프로세스 로컬)
- 미선택 플레이어: 덱 앞 3개 자동 선택 후 `draft:timeout` emit
- 클라이언트: 카운트다운 바 + 숫자 표시, 10초 이하 황색, 5초 이하 적색 + 점멸

### 연결 끊김 처리

| 상황 | 처리 |
|------|------|
| 드래프트 중 끊김 | 상대방에게 `opponent:disconnected` emit, 재접속 대기 |
| 게임 진행 중 끊김 | 나간 쪽 **자동 패배** 처리, 상대방에게 `game:over { forfeit: true }` |
| 재접속 | `room:restore`로 현재 phase·gameState 전달 |

### 매치 인트로 화면

- 매칭 성사 → 슬라이드인 애니메이션으로 양쪽 플레이어 카드 + VS 연출
- 별빛 파티클 배경, 2.9초 후 자동 전환

---

## Phase 4 — 출시 준비 🔶 진행 중

### ✅ 완료

#### 배포 인프라

**Railway (서버)**
- 단일 스테이지 Alpine Dockerfile
  ```dockerfile
  RUN apk add --no-cache openssl  # Prisma 의존성
  RUN corepack enable && corepack prepare pnpm@9 --activate
  CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
  ```
- `tsup`으로 `@dice-game/core`를 서버 번들에 인라인 (`noExternal: ['@dice-game/core']`)
- `trustProxy: true` (Railway 리버스 프록시 환경)
- Health check: `GET /health`

**Vercel (클라이언트)**
- `vercel.json` SPA 리라이트 설정
- 커스텀 도메인: `paradice.zangnan.games` (타 계정 도메인 TXT 레코드 인증)

#### 프로필 & 커스터마이징

- **프로필 화면**: 닉네임 수정, 아바타 색상 커스텀, 통계·대전기록 탭
- **아바타**: Google 프로필 이미지 제거 → 닉네임 첫 글자 + 단색 배경
  - 자동 색상: 닉네임 해시 → 8색 팔레트 인덱싱
  - 커스텀 색상: `profileStore` (Zustand persist) → localStorage 영구 저장
  - UI: 팔레트 선택 → pendingColor 미리보기 → "적용하기" 버튼으로 저장

#### 덱 통계 화면

- **내 덱 통계 탭**: 덱별 승률 원형 게이지, W/L, 총 판 수
  - 카드 펼치기 → 주사위 4개 상세 (면 시각화, 최대/최소/평균)
- **전체 랭킹 탭**: 5판 이상 플레이한 덱 상위 20개, 펼치기 시 주사위 구성 표시

---

### ❌ 미완료

| 항목 | 비고 |
|------|------|
| 주사위 3D 애니메이션 | Three.js 기반 구현 중, 물리 시뮬레이션 어색함 잔존 → Phase 6에서 고도화 |

---

## Phase 5 — 온보딩 튜토리얼 🔲 예정 (최우선)

> 첫 방문·첫 로그인 유저가 게임 룰을 직관적으로 이해하고 자연스럽게 첫 덱을 완성할 수 있도록 안내하는 오버레이형 튜토리얼.

### 설계 방향

- **트리거**: 첫 로그인 또는 덱이 0개인 유저 진입 시 자동 표시
- **형식**: 전체화면 오버레이 + 이미지/일러스트 + 텍스트 캐러셀 (스와이프·버튼 양쪽 지원)
- **완료 조건**: 마지막 슬라이드 확인 후 `localStorage`에 `tutorial:done` 플래그 저장 → 이후 재표시 없음. 프로필 화면에서 수동 재실행 가능.

### 슬라이드 구성 (안)

| # | 제목 | 내용 |
|---|------|------|
| 1 | para.Dice란? | 비추이적 주사위 개념 소개, "항상 이기는 주사위는 없다" |
| 2 | 주사위 만들기 | 6면의 합계가 반드시 21이어야 함, 덱 빌더 UI 하이라이트 |
| 3 | 덱 구성 | 주사위 4개로 덱 1개 구성, 저장 방법 안내 |
| 4 | 드래프트 페이즈 | 4개 중 3개 선택 + 출전 순서 봉인, 40초 타임아웃 |
| 5 | 대결 진행 | 2선승제, 동점 시 재대결 규칙 |
| 6 | 시작하기 | "첫 덱 만들러 가기" CTA → 덱 빌더로 이동 |

### 구현 체크리스트

- [ ] `TutorialOverlay` 컴포넌트 (캐러셀, 키보드·스와이프 지원)
- [ ] 슬라이드별 이미지/일러스트 에셋 제작 또는 인터랙티브 미니 데모로 대체
- [ ] `tutorialStore` (Zustand persist) — `isDone`, `replayTutorial()`
- [ ] 프로필 화면 "튜토리얼 다시 보기" 버튼

---

## Phase 6 — 게임 고도화 🔲 예정 (우선순위 1)

> 물리 엔진 기반 주사위 굴림 고도화와 대결 화면 연출 강화. 게임의 핵심 피드백 루프인 "굴리고 → 기다리고 → 결과 확인" 구간의 긴장감과 몰입감을 높임.

### 주사위 물리 엔진 고도화

현재 Three.js 기반 3D 렌더링을 유지하면서 굴림 물리 시뮬레이션의 어색함을 다듬음.

| 항목 | 현재 | 목표 |
|------|------|------|
| 굴림 표현 | Three.js 3D 회전 (어색한 궤도) | 자연스러운 바운스·텀블링 (속도·감속·튕김) |
| 착지 | 부자연스러운 정지 | 감속 후 자연스러운 안착 (wobble 효과) |
| 궤도 | 고정·반복 경로 | 매 굴림마다 랜덤 궤적·회전축 변화 |
| 소리 | 없음 | 굴림·착지 효과음 (추후 연계) |

**구현 방향**
- Three.js 씬 유지, 물리 파라미터만 개선 (별도 물리 라이브러리 도입 없이 Three.js 내에서 처리)
- 굴림 시작 시 랜덤 초기 각속도·회전축 부여, 커스텀 이징 커브로 자연스러운 감속 구현
- 바닥 충돌 시 바운스 횟수·높이를 랜덤화해 매번 다른 느낌 연출
- 착지 후 미세 wobble 애니메이션으로 안착감 표현
- 서버 검증 결과값과 클라 애니메이션 결과를 착지 시점에 동기화 (현행 구조 유지)

### 대결 화면 연출 고도화

라운드 결과 공개 시 긴장감 있는 순차 연출 도입.

#### 결과 공개 플로우 (현재 → 목표)

```
현재: 굴림 완료 → 즉시 숫자 표시
목표: 굴림 완료 → ? 마스킹 → 카운트다운 → 동시 오픈 → 승패 연출
```

#### 상세 연출 시퀀스

| 단계 | 설명 | 시간(안) |
|------|------|----------|
| 1. 굴림 | 양쪽 주사위 물리 애니메이션 | ~1.5s |
| 2. 착지·마스킹 | 주사위 착지 후 결과면을 **?** 로 가림 | 즉시 |
| 3. 대기 | 상대방 굴림 완료까지 대기 (이미 완료 시 스킵) | ~0s |
| 4. 긴장 연출 | 화면 살짝 어두워지며 카운트다운 (1초) 또는 진동 이펙트 | ~1s |
| 5. 동시 오픈 | 양쪽 ? → 숫자 플립 애니메이션 동시 공개 | ~0.4s |
| 6. 승패 강조 | 이긴 쪽 주사위 확대·빛 이펙트, 진 쪽 흔들림·어두워짐 | ~0.8s |
| 7. 라운드 결과 | 승/패/동점 텍스트 오버레이 표시 후 다음 라운드로 | ~1s |

**동점(재대결) 연출**
- 양쪽 동시 오픈 후 "DRAW" 텍스트 + 화면 전체 플래시
- 재대결 안내 메시지 후 자동으로 다음 굴림으로 전환

**2선승 달성 연출**
- 승자 쪽 주사위가 화면 중앙으로 이동 + 승리 파티클 폭발
- 패자 쪽 페이드아웃

### 구현 체크리스트

**물리 엔진 (Three.js 기반 유지)**
- [ ] 굴림 초기 각속도·회전축 랜덤화 (`diceRollConfig.ts`)
- [ ] 커스텀 이징 커브 적용 (감속 곡선 자연스럽게 조정)
- [ ] 바운스 횟수·높이 랜덤화로 매 굴림 궤적 차별화
- [ ] 착지 wobble 애니메이션 추가 (Three.js 애니메이션 루프 내 처리)
- [ ] 기존 `round:roll` 이벤트 흐름과 통합 (결과값은 서버 기준 유지)

**결과 공개 연출**
- [ ] `RoundRevealOverlay` 컴포넌트 — ? 마스킹 → 플립 오픈 시퀀스
- [ ] 양쪽 굴림 완료 신호 수신 후 동시 오픈 타이밍 동기화 (`round:result` 이벤트 활용)
- [ ] 승패 강조 이펙트 (CSS filter / framer-motion)
- [ ] 동점 재대결 전용 연출
- [ ] 2선승 달성 승리 연출 (파티클 + 카메라 줌)

---

## Phase 7 — 심화 커스터마이징 🔲 예정 (우선순위 1)

> 아바타와 주사위 비주얼을 유저가 직접 꾸밀 수 있는 커스터마이징 시스템. 상점/뽑기 시스템(Phase 8)과 연계해 유료·무료 아이템을 적용하는 기반이 됨.

### 아바타 커스터마이징 확장

현재 닉네임 첫 글자 + 단색 배경에서 아래로 확장:

- 아바타 프레임 (테두리 모양·색상·애니메이션 효과)
- 배경 패턴 (단색 외 그라디언트·패턴 선택)
- 닉네임 뱃지 표시 위치 커스텀 (Phase 8 업적 시스템과 연계)

### 게임판(Map) 커스터마이징

주사위가 굴러가는 대전 배경 맵의 비주얼을 커스터마이징.

| 옵션 | 설명 |
|------|------|
| 테마 | 나무 테이블(기본), 대리석, 천(펠트), 우주, 사막, 얼음 등 프리셋 테마 |
| 배경색·패턴 | 단색, 그라디언트, 텍스처 이미지 |
| 테두리 | 판 외곽 테두리 스타일 (없음, 단순 선, 장식형 프레임) |
| 파티클 효과 | 굴림 시 발생하는 이펙트 (먼지, 불꽃, 별 등 프리셋 / 없음) |
| 배경 애니메이션 | 정적(기본) 또는 루프 애니메이션 (파도, 별빛 흐름 등) |

### 주사위 비주얼 커스터마이징

주사위 외형을 **면(Face)·눈(Pip)** 두 레이어로 커스터마이징.

#### 면(Face) 디자인

| 옵션 | 설명 |
|------|------|
| 단색 | 기본. 색상 피커로 자유 선택 |
| 그라디언트 | 2색 선형/방사형 그라디언트 |
| 패턴 | 도트, 스트라이프, 체크 등 프리셋 |
| 테두리 | 면 외곽선 색상·두께 |

#### 눈(Pip) 디자인

| 옵션 | 설명 |
|------|------|
| 모양 | 원형(기본), 다이아몬드, 별, 하트 등 |
| 크기 | 소·중·대 프리셋 또는 슬라이더 |
| 배치 | 클래식(표준 주사위 배열), 그리드, 센터 정렬 등 |
| 숫자 모드 | 눈 대신 아라비아 숫자 폰트로 표시 (폰트·색상 선택 가능) |

### DB 스키마 추가 (안)

```
DiceAppearance
  id          String   @id
  userId      String
  name        String           # 스킨 이름
  faceStyle   Json             # { type, color, gradient, pattern, border }
  pipStyle    Json             # { shape, size, layout, color, numberMode, font }
  isEquipped  Boolean
  source      String           # "default" | "shop" | "gacha" | "achievement"
  createdAt   DateTime

MapAppearance
  id          String   @id
  userId      String
  name        String           # 스킨 이름
  theme       String           # "wood" | "marble" | "felt" | "space" | ...
  bgStyle     Json             # { type, color, gradient, texture }
  borderStyle Json             # { type, color }
  particleFx  String           # "none" | "dust" | "fire" | "star" | ...
  bgAnimation String           # "none" | "wave" | "starfield" | ...
  isEquipped  Boolean
  source      String           # "default" | "shop" | "gacha" | "achievement"
  createdAt   DateTime

AvatarAppearance
  id          String   @id
  userId      String
  frameStyle  Json
  bgStyle     Json
  isEquipped  Boolean
  source      String
```

### 구현 체크리스트

- [ ] `DiceCustomizer` 컴포넌트 — 면·눈 탭 분리, 실시간 미리보기
- [ ] `MapCustomizer` 컴포넌트 — 테마 프리셋 선택 + 세부 옵션, 미니 게임판 미리보기
- [ ] `AvatarCustomizer` 컴포넌트 확장
- [ ] 커스텀 렌더러: `DiceFaceRenderer` — `faceStyle`·`pipStyle` 기반 SVG/Canvas 렌더링
- [ ] 커스텀 렌더러: `MapRenderer` — 테마·파티클·애니메이션 적용 (CSS / Canvas)
- [ ] DB 마이그레이션: `DiceAppearance`, `MapAppearance`, `AvatarAppearance` 테이블
- [ ] API: `GET/POST/PUT /customization/dice`, `/customization/map`, `/customization/avatar`
- [ ] 게임 인게임 화면에 커스텀 스킨 적용 (상대방 주사위·맵 모두 반영)

---

## Phase 8 — 업적·랭크·상점·뽑기 시스템 🔲 예정 (우선순위 2)

> 장기 플레이 동기 부여를 위한 메타게임 레이어. 업적 달성·랭크 진급 보상으로 커스터마이징 아이템을 획득하고, 상점/뽑기로 추가 수집 가능.

### 업적 & 뱃지

- 조건 기반 자동 달성 (예: "첫 승리", "연승 5회", "AI 10판 플레이" 등)
- 달성 시 토스트 알림 + 프로필에 뱃지 표시
- 일부 업적에 커스터마이징 아이템 보상 연계

### 랭크 시스템

| 티어 | 조건(안) |
|------|----------|
| 브론즈 | 기본 |
| 실버 | 랭크전 10승 |
| 골드 | 랭크전 30승 + 승률 50%↑ |
| 플래티넘 | 랭크전 70승 + 승률 55%↑ |
| 다이아 | 상위 10% |

- 랭크 아이콘·프레임 자동 부여 → 아바타에 표시
- 시즌제 도입 검토 (시즌 종료 시 보상 지급 후 리셋)

### 상점 시스템

- **무료 탭**: 업적·랭크 달성 보상 수령
- **유료 탭**: 포인트(또는 실결제) 기반 스킨 구매
  - 결제 연동은 추후 검토 (초기에는 포인트만 운영)
- 아이템 종류: 주사위 스킨 세트, 아바타 프레임, 배경 테마

### 뽑기 시스템

- 포인트 소모로 무작위 스킨 획득
- 확률 공개 (레어·에픽·레전더리 등급)
- 천장(pity) 시스템 적용 검토

### DB 스키마 추가 (안)

```
Achievement
  id          String   @id
  key         String   @unique   # "first_win", "win_streak_5" 등
  title       String
  description String
  rewardItemId String?

UserAchievement
  userId       String
  achievementId String
  unlockedAt   DateTime

RankRecord
  userId       String
  season       Int
  tier         String
  wins         Int
  losses       Int

ShopItem
  id           String   @id
  name         String
  type         String   # "dice_skin" | "avatar_frame" | "bg_theme"
  price        Int
  rarity       String
  assetKey     String

UserInventory
  userId       String
  itemId       String
  acquiredAt   DateTime
  source       String   # "shop" | "gacha" | "achievement" | "rank_reward"
```

### 구현 체크리스트

- [ ] 업적 정의 테이블 + 달성 조건 엔진 (게임 종료 훅에서 평가)
- [ ] 랭크 계산 로직 + 전용 매칭 큐 (`queue:ranked`)
- [ ] 상점 UI + API (`GET /shop/items`, `POST /shop/purchase`)
- [ ] 뽑기 UI + 확률 테이블 + API (`POST /gacha/pull`)
- [ ] 인벤토리 관리 API (`GET /inventory`, `PATCH /inventory/:id/equip`)

---

## Phase 9 — 더블 배틀 게임 모드 🔲 예정 (우선순위 3)

> 기존 1주사위 대결에서 2주사위 동시 굴림으로 확장하는 새 게임 모드.

### 규칙

- 라운드마다 양쪽이 주사위를 **2개씩** 동시에 굴림
- 두 주사위 결과가 나온 뒤, 원하는 주사위 **1개**를 **1회에 한해** 재굴림 가능
- 재굴림 여부는 비공개로 동시 결정 (봉인 방식) → 결과 공개
- 두 주사위의 합산으로 승패 결정, 이후 기본 규칙(2선승제, 동점 재대결) 동일

### 변경되는 드래프트 규칙

- 덱에서 **매 라운드 2개 쌍** 선택 (사전 봉인 또는 라운드 시작 시 선택 — 설계 결정 필요)
- 재굴림 타임아웃: **10초** 이내 결정, 미결정 시 재굴림 없음으로 처리

### `@dice-game/core` 변경 사항

- `RollResult` 타입 확장: `dice: [number, number]`, `rerolled: boolean`
- `rollDoubleBattle(die1, die2): DoubleBattleRoll`
- `resolveDoubleBattle(p1Roll, p2Roll): RoundResult`
- 신규 `GameMode` 타입: `'classic' | 'double'`

### Socket.io 이벤트 추가

| 방향 | 이벤트 | 설명 |
|------|--------|------|
| s→c | `round:double_rolled` | 양쪽 2주사위 결과 공개 |
| c→s | `round:reroll` | 재굴림 선택 제출 (주사위 인덱스 0 or 1, 혹은 패스) |
| s→c | `round:reroll_done` | 양쪽 재굴림 결과 공개 후 라운드 결과 |

### 구현 체크리스트

- [ ] `core` 패키지 더블 배틀 로직 추가 및 단위 테스트
- [ ] 서버: 모드별 분기 처리 (`gameMode` 필드 Match 레코드에 추가)
- [ ] 클라이언트: 더블 배틀 전용 게임 화면 (`DoubleBattleGameScreen`)
- [ ] 재굴림 선택 UI (10초 카운트다운 + 주사위 선택 버튼)
- [ ] 매칭 큐 모드 선택 UI (클래식 / 더블 배틀)

---

## Phase 10 — 관리자 웹사이트 🔲 예정 (우선순위 4)

> 회원 관리, 게임 현황 모니터링, 상점·뽑기 아이템 관리, 신고 처리를 위한 내부 관리 도구.

### 관리자 사이트 구성

- **별도 서브도메인** 또는 **독립 레포지토리** 운영 (`admin.paradice.zangnan.games`)
- 인증: 별도 Admin 계정 (Google OAuth + 관리자 역할 검증), 일반 유저 접근 차단

### 주요 기능

#### 회원 관리
- 유저 목록 검색·필터 (닉네임, 가입일, 랭크, 정지 여부)
- 유저 상세: 통계, 대전 기록, 보유 아이템, 신고 내역
- 계정 정지·해제, 닉네임 강제 변경

#### 게임 현황 모니터링
- 실시간 접속자 수, 진행 중인 매치 수
- 일별/주별 신규 가입·대전 수 차트
- 비정상 플레이 패턴 탐지 (어뷰징 의심 계정 플래그)

#### 콘텐츠 관리
- 상점 아이템 등록·수정·노출 여부 토글
- 뽑기 풀 구성 및 확률 테이블 편집
- 업적 정의 추가·수정

#### 신고 처리
- 신고 큐 목록, 상태(대기/처리중/완료) 관리
- 신고 내용 + 해당 대전 기록 연동 조회
- 처리 결과 메모 작성

### 기술 구성 (안)

| 항목 | 기술 |
|------|------|
| 프레임워크 | React 18 + Vite (별도 패키지) |
| UI 라이브러리 | shadcn/ui 또는 Ant Design |
| 차트 | Recharts |
| 서버 | 기존 Fastify 서버에 `/admin/*` 라우트 추가, Admin Role 미들웨어 |

### DB 스키마 추가 (안)

```
AdminUser
  id       String @id
  email    String @unique
  role     String   # "superadmin" | "moderator"
  createdAt DateTime

Report
  id           String @id
  reporterId   String
  targetUserId String
  matchId      String?
  reason       String
  status       String   # "pending" | "reviewing" | "resolved"
  resolvedBy   String?
  note         String?
  createdAt    DateTime
```

### 구현 체크리스트

- [ ] `packages/admin` 패키지 scaffolding
- [ ] Admin Role 미들웨어 (서버)
- [ ] 유저 관리 API (`GET /admin/users`, `PATCH /admin/users/:id`)
- [ ] 통계 대시보드 API (`GET /admin/stats/realtime`, `GET /admin/stats/daily`)
- [ ] 콘텐츠 관리 API (상점·뽑기·업적 CRUD)
- [ ] 신고 처리 API (`GET /admin/reports`, `PATCH /admin/reports/:id`)
- [ ] Admin 사이트 배포 (Vercel 별도 프로젝트)

---

## 주요 트러블슈팅

### 1. iOS Safari OAuth "invalid state" 오류

**원인**: Railway 서버와 Vercel 클라이언트가 다른 도메인. Safari ITP(Intelligent Tracking Prevention)가 Railway 도메인 쿠키를 "제3자 추적 쿠키"로 분류해 OAuth 리다이렉트 중 state 쿠키를 삭제.

**1차 시도 (실패)**: `@fastify/oauth2` v7의 `checkStateFunction`은 첫 번째 인자로 **Fastify Request 객체**를 받는데, v8 API처럼 state 문자열을 첫 인자로 받는다고 잘못 작성. 결과적으로 `returnedState.lastIndexOf is not a function` 에러 발생.

```ts
// ❌ 잘못된 코드 (v8 API 혼용)
checkStateFunction: (returnedState: string, callback) => {
  const dot = returnedState.lastIndexOf('.')  // TypeError: request object에 이 메서드 없음
  ...
}
```

**최종 해결**: **HMAC 서명 기반 무상태(Stateless) state** — Redis·쿠키 모두 불필요.

```ts
// state = "<16-byte nonce>.<HMAC-SHA256 signature>"
generateStateFunction: (_req) => {
  const nonce = crypto.randomBytes(16).toString('hex')
  return `${nonce}.${sign(nonce, JWT_SECRET)}`
},
checkStateFunction: (request, callback) => {
  // v7: 첫 번째 인자는 Fastify Request 객체
  const state = (request as any).query?.state as string
  const dot = state.lastIndexOf('.')
  const nonce = state.slice(0, dot)
  const sig   = state.slice(dot + 1)
  if (sig === sign(nonce, JWT_SECRET)) callback()
  else callback(new Error('Invalid state signature'))
}
```

**장점**: 완전 동기 처리, 외부 저장소 의존 없음, Safari ITP 영향 없음.

---

### 2. JWT 토큰이 URL에 노출

**원인**: OAuth 콜백 URL(`/auth/callback?token=...`)을 React state가 이미 렌더링 후에 정리해, URL이 잠깐 노출되고 브라우저 히스토리에 남음.

**해결**: `AuthCallback` 컴포넌트에서 비동기 작업 전에 즉시 URL 정리.

```ts
// 비동기 호출 전에 먼저 URL 클리어
window.history.replaceState({}, '', '/')
const me = await api.auth.me()
```

`isAuthCallback` 상태도 `useState(() => ...)` 초기값으로 고정해 재렌더 시 콜백 화면이 다시 뜨지 않도록 처리.

---

### 3. 드래프트 동점 재대결 오버레이 미표시

**원인**: `OnlineGameScreen`에서 `{isRoundDraw && ...}` 블록이 `{isRoundResult && <>...</>}` 안에 중첩돼 있었음. 두 상태는 상호 배타적이므로 오버레이가 절대 렌더링되지 않았음.

**해결**: `isRoundDraw` 블록을 `isRoundResult` 블록과 동일 레벨로 분리.

---

### 4. 덱 저장 "Not found" 오류

**원인**: Zustand `persist`로 `serverId`가 localStorage에 보존되는데, 계정 변경·DB 초기화 등으로 서버에 해당 덱이 없어졌을 때 PUT 요청이 404 반환.

**해결**: PUT 실패 시 404면 `serverId`를 null로 초기화하고 POST로 새로 생성.

```ts
try {
  await api.decks.update(serverId, name, dice)
} catch (err: any) {
  if (err.message?.includes('Not found') || err.message?.includes('404')) {
    setServerId(null)
    const created = await api.decks.create(name, dice) as any
    setServerId(created.id)
  } else throw err
}
```

---

### 5. Railway 배포 초기 실패들

| 오류 | 원인 | 해결 |
|------|------|------|
| `prisma: openssl not found` | Alpine 이미지에 OpenSSL 없음 | `RUN apk add --no-cache openssl` |
| `DATABASE_URL not found` | Railway 참조 변수 미설정 | Variables 탭에서 `${{Postgres.DATABASE_URL}}` 수동 추가 |
| `redirect_uri_mismatch` | Google Console 허용 URI 누락 | Railway URL을 Authorized redirect URIs에 추가 |
| `localhost:3001 호출` | `VITE_SERVER_URL` 빌드 후 설정 | 캐시 없이 재배포 |

---

### 6. Vercel 빌드 오류 (exit code 2)

**원인**: `tsconfig`의 `exactOptionalPropertyTypes: true` 옵션. `user?.avatarUrl`의 타입이 `string | null | undefined`인데, `AvatarProps.avatarUrl?: string | null`은 `undefined` 불허.

**해결**: Avatar 컴포넌트에서 `avatarUrl` prop 완전 제거 (Google 이미지 제거 방침과 일치), 호출부 4곳 정리.

---

## 현재 완료 상태 요약

```
Phase 1   ████████████████████  100%  게임 로직 + 로컬 시뮬레이터
Phase 2   ████████████████████  100%  인증 + DB + 실시간 대전
Phase 3   █████████████████░░░   90%  매칭 + UX (3D 애니메이션 제외)
Phase 4   ███████████████████░   95%  Rate limit·Sentry·CI/CD·Lighthouse 완료 / 3D 애니메이션 제외
Phase 5   ████████████████████  100%  온보딩 튜토리얼
Phase 6   ████████████████████  100%  게임 고도화 (물리엔진·결과 연출)
Phase 7   ░░░░░░░░░░░░░░░░░░░░    0%  심화 커스터마이징 (아바타·주사위·게임판)
Phase 8   ░░░░░░░░░░░░░░░░░░░░    0%  업적·랭크·상점·뽑기
Phase 9   ░░░░░░░░░░░░░░░░░░░░    0%  더블 배틀 게임 모드
Phase 10  ░░░░░░░░░░░░░░░░░░░░    0%  관리자 웹사이트
```

---

## 남은 작업 (백로그)

### Phase 4 잔여

| 우선순위 | 항목 |
|----------|------|
| 중 | Rate limiting (`@fastify/rate-limit`) |
| 중 | GitHub Actions CI/CD |
| 하 | Sentry 에러 모니터링 |
| 하 | Lighthouse 성능 최적화 (목표 90+) |
| 하 | 주사위 CSS 3D 애니메이션 고도화 |

### 신규 로드맵

| 우선순위 | Phase | 항목 |
|----------|-------|------|
| 최우선 | 5 | 온보딩 튜토리얼 (캐러셀 오버레이) |
| 1 | 6 | 게임 고도화 (물리엔진 다듬기, 결과 공개 긴장감 연출) |
| 2 | 7 | 심화 커스터마이징 (아바타 프레임, 주사위 면·눈, 게임판 테마) |
| 3 | 8 | 업적·뱃지·랭크 시스템 + 상점·뽑기 |
| 4 | 9 | 더블 배틀 게임 모드 |
| 5 | 10 | 관리자 웹사이트 |

---

## 커밋 히스토리

| 날짜 | 커밋 |
|------|------|
| 2026-04-10 | 초기 배포 설정 (Dockerfile, railway.json, vercel.json) |
| 2026-04-10 | Alpine OpenSSL 추가, trustProxy 설정, OAuth 에러 로깅 |
| 2026-04-10 | 페이지 타이틀 "파라다이스" 변경 |
| 2026-04-11 | `@fastify/cookie` 등록으로 모바일 OAuth state 쿠키 수정 |
| 2026-04-11 | 단색 이니셜 아바타 도입 |
| 2026-04-11 | 덱 저장 404 폴백 처리 |
| 2026-04-11 | OAuth 콜백 URL 즉시 클리어, trustProxy 수정 |
| 2026-04-11 | draw 오버레이 렌더링 버그 수정 |
| 2026-04-11 | 아바타 배경색 커스텀 (프로필 화면) |
| 2026-04-11 | 아바타 색상 적용하기 버튼 UX 개선 |
| 2026-04-11 | Google 프로필 이미지 제거, 커스텀 아바타 전환 |
| 2026-04-12 | Redis 기반 OAuth state로 iOS Safari ITP 우회 (1차 시도) |
| 2026-04-12 | Vercel 빌드 오류 수정 (avatarUrl TS2375) |
| 2026-04-13 | 드래프트 타임아웃 40초 설정 |
| 2026-04-13 | 덱 통계 화면 구현 (내 덱 통계 + 전체 랭킹) |
| 2026-04-13 | OAuth 로그인 무반응 수정 — generateStateFunction 동기화 (async 제거) |
| 2026-04-13 | HMAC 서명 기반 무상태 OAuth state로 전환 (Redis·쿠키 완전 제거, v7 API 정합) |
| 2026-04-13 | 로드맵 업데이트 (Phase 5~10 추가) |
| 2026-04-13 | Phase 4 잔여 완료: Rate limiting, Sentry, GitHub Actions CI, Lighthouse CI, 번들 청크 분리 |
| 2026-04-13 | Phase 5 온보딩 튜토리얼 완료: TutorialOverlay (6슬라이드 + 인터랙티브 데모), tutorialStore, 프로필 재실행 버튼 |
| 2026-04-14 | Phase 6 게임 고도화: ? 마스킹→플립 공개 연출, 결과 플래시, 승리 파티클 오버레이, 상대 투척 다변화, wobble 착지 |
