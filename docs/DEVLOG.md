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
| DB (휘발) | Redis (게임룸·세션·매칭큐·OAuth state) |
| 인증 | JWT (7일) + Google OAuth 2.0 |
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
| 주사위 3D 애니메이션 | 현재 CSS 2D 애니메이션 사용 |
| Rate limiting | `@fastify/rate-limit` 미적용 |
| Sentry 에러 모니터링 | 서버·클라이언트 모두 미연결 |
| GitHub Actions CI/CD | 현재 수동 push |
| Lighthouse 성능 최적화 | 미측정 |

---

## 주요 트러블슈팅

### 1. iOS Safari OAuth "invalid state" 오류

**원인**: Railway 서버와 Vercel 클라이언트가 다른 도메인. Safari ITP가 Railway 도메인 쿠키를 "제3자 추적 쿠키"로 분류해 OAuth 리다이렉트 중 state 쿠키 삭제.

**해결**: `@fastify/oauth2`의 `generateStateFunction` / `checkStateFunction`을 커스텀 구현해 **쿠키 대신 Redis에 state 저장**.

```ts
generateStateFunction: async () => {
  const state = crypto.randomBytes(16).toString('hex')
  await redis.set(`oauth:state:${state}`, '1', 'EX', 600) // 10분 TTL
  return state
},
checkStateFunction: async (req, callback) => {
  const state = req.query?.state
  const exists = await redis.get(`oauth:state:${state}`)
  if (exists) { await redis.del(`oauth:state:${state}`); callback() }
  else callback(new Error('Invalid or expired state'))
}
```

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
Phase 1  ████████████████████  100%  게임 로직 + 로컬 시뮬레이터
Phase 2  ████████████████████  100%  인증 + DB + 실시간 대전
Phase 3  █████████████████░░░   90%  매칭 + UX (3D 애니메이션 제외)
Phase 4  ████████████░░░░░░░░   55%  배포·덱통계·프로필 완료 / Rate limit·Sentry·CI/CD 미완
```

---

## 남은 작업 (백로그)

| 우선순위 | 항목 |
|----------|------|
| 중 | Rate limiting (`@fastify/rate-limit`) |
| 중 | GitHub Actions CI/CD |
| 하 | Sentry 에러 모니터링 |
| 하 | Lighthouse 성능 최적화 (목표 90+) |
| 하 | 주사위 CSS 3D 애니메이션 고도화 |

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
| 2026-04-12 | Redis 기반 OAuth state로 iOS Safari ITP 우회 |
| 2026-04-12 | Vercel 빌드 오류 수정 (avatarUrl TS2375) |
| 2026-04-13 | 드래프트 타임아웃 40초 설정 |
| 2026-04-13 | 덱 통계 화면 구현 (내 덱 통계 + 전체 랭킹) |
