# Phase 4 — 소셜 + 메타게임 + 출시 준비

**목표:** 공개 URL로 누구나 접속 가능한 정식 서비스  
**기간:** 2~3주  
**선행 조건:** Phase 3 완료 (랜덤 매칭 + 전체 UX 완성)

---

## 체크리스트

- [ ] 4-1. 전적 & 프로필 페이지
- [ ] 4-2. 덱 통계 (주사위별 승률 분석)
- [ ] 4-3. 친구 초대 링크 / 비공개 방
- [ ] 4-4. Docker 컨테이너화
- [ ] 4-5. GitHub Actions CI/CD 파이프라인
- [ ] 4-6. Railway / Fly.io 배포
- [ ] 4-7. Rate limiting + 어뷰징 감지
- [ ] 4-8. 에러 모니터링 (Sentry)
- [ ] 4-9. Lighthouse 성능 최적화

---

## 4-1. 전적 & 프로필

### API

```
GET /profile/:userId        유저 기본 정보 + 통계
GET /profile/:userId/matches  최근 전적 (페이지네이션)
```

### 통계 계산 (Prisma 쿼리)

```typescript
// src/routes/profile.ts
const stats = await prisma.match.aggregate({
  where: {
    state: 'FINISHED',
    OR: [{ playerAId: userId }, { playerBId: userId }],
  },
  _count: { id: true },
})

const wins = await prisma.match.count({
  where: { winnerId: userId },
})

return {
  totalGames: stats._count.id,
  wins,
  losses: stats._count.id - wins,
  winRate: stats._count.id > 0
    ? Math.round((wins / stats._count.id) * 100)
    : 0,
}
```

### 프로필 화면 구성

```
프로필 페이지
├── 닉네임 + 가입일
├── 통계 카드 (승 / 패 / 승률)
├── 최근 10게임 전적
│   └── [날짜] vs [상대닉네임] — 승 / 패 | 사용덱: [덱이름]
└── 내 덱 목록 (공개된 덱 한정)
```

---

## 4-2. 덱 통계 (메타게임)

비추이적 관계를 플레이어가 직접 발견하도록 데이터 제공.

### 주사위별 승률 분석

```typescript
// 특정 주사위가 출전한 라운드의 승률 계산
// Round.rolls JSON에서 집계
async function getDieWinRate(dieId: string) {
  const rounds = await prisma.round.findMany({
    where: {
      match: {
        OR: [
          { deckA: { dice: { some: { id: dieId } } } },
          { deckB: { dice: { some: { id: dieId } } } },
        ]
      }
    }
  })
  // rounds를 순회하며 해당 주사위가 이긴 라운드 수 계산
}
```

### 화면 구성

```
덱 상세 페이지
├── 덱 이름 + 주사위 4개 시각화
├── 전체 덱 승률
└── 주사위별 통계 테이블
    ├── 주사위 A — 출전 32회, 승 18회 (56%)
    └── 주사위 B — 출전 28회, 승 14회 (50%)
```

---

## 4-3. 친구 초대 링크 / 비공개 방

### 방 코드 생성

```typescript
// 6자리 랜덤 코드
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Redis에 코드 → matchId 매핑 (10분 TTL)
await redis.set(`room:code:${code}`, matchId, 'EX', 600)
```

### 소켓 이벤트 추가

```
client→server   room:create     { deckId }          비공개 방 생성
server→client   room:code       { code, matchId }   방 코드 발급
client→server   room:enter      { code, deckId }    코드로 입장
server→client   room:ready      { ... }             양쪽 입장 완료
```

### 공유 URL 형태

```
https://dicegame.example.com/room/ABC123
```

---

## 4-4. Docker 컨테이너화

### `packages/server/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml tsconfig.base.json package.json pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @dice-game/server build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### `docker-compose.yml` (로컬 개발용)

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: dicegame
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - '5432:5432'
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

volumes:
  pg_data:
```

---

## 4-5. GitHub Actions CI/CD

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## 4-6. 배포 구성

### 권장 구성 (비용 최소화)

| 서비스 | 플랫폼 | 비용 |
|--------|--------|------|
| 클라이언트 | Vercel | 무료 |
| 서버 | Fly.io | $5~10/월 |
| PostgreSQL | Fly.io Postgres | $5/월 |
| Redis | Upstash | 무료 (소규모) |

### Fly.io 배포

```bash
# 초기 설정
fly launch --name dice-game-server

# 환경변수 설정
fly secrets set DATABASE_URL="..." JWT_SECRET="..." REDIS_URL="..."

# 배포
fly deploy
```

### Vercel 배포 (클라이언트)

```bash
cd packages/client
vercel --prod
```

환경변수 설정:
```
VITE_SERVER_URL=https://dice-game-server.fly.dev
```

---

## 4-7. Rate Limiting + 어뷰징 감지

```typescript
// src/plugins/rateLimit.ts
import rateLimit from '@fastify/rate-limit'

await app.register(rateLimit, {
  max: 100,          // 1분당 최대 요청
  timeWindow: '1m',
  keyGenerator: (req) => req.ip,
})

// Socket.io — 비정상 이벤트 감지
socket.use((packet, next) => {
  const [event] = packet
  const rateLimitKey = `socket:ratelimit:${socket.id}:${event}`
  // Redis로 이벤트 빈도 체크
  next()
})
```

---

## 4-8. 에러 모니터링

```bash
pnpm add @sentry/node @sentry/react
```

```typescript
// server: src/index.ts
import * as Sentry from '@sentry/node'
Sentry.init({ dsn: process.env.SENTRY_DSN })

// client: src/main.tsx
import * as Sentry from '@sentry/react'
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })
```

---

## 4-9. 성능 체크리스트

| 항목 | 목표 | 도구 |
|------|------|------|
| Lighthouse Performance | 90+ | Chrome DevTools |
| 첫 로드 JS 번들 | < 200KB gzip | Vite Bundle Analyzer |
| API 응답 (P95) | < 200ms | Fastify logger |
| WebSocket 지연 | < 100ms | 직접 측정 |

### Vite 번들 분석

```bash
cd packages/client
pnpm add -D rollup-plugin-visualizer
# vite.config.ts에 플러그인 추가 후
pnpm build -- --report
```

---

## 완료 기준 (Definition of Done)

1. 공개 URL 접속 → 회원가입 → 매칭 → 게임 → 결과 전 과정 정상 동작
2. GitHub push → 자동 테스트 → 자동 배포 파이프라인 동작
3. Lighthouse Performance 점수 90 이상
4. 동시 접속 10명 기준 서버 응답 P95 < 200ms
5. Sentry 에러 대시보드 연결 확인

---

## 이후 개선 방향 (백로그)

- 시즌제 랭킹 시스템
- 스펙테이터 모드 (관전)
- 덱 공유 / 커뮤니티 덱 탐색
- 토너먼트 모드
- 모바일 앱 (React Native + 공유 core 패키지)
