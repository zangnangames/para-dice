# Phase 2 — 인증 + DB + 실시간 1대1 매칭

**목표:** 두 브라우저 탭으로 실제 1대1 게임 완주 가능
**기간:** 2~3주
**선행 조건:** Phase 1 완료 (core 단위 테스트 전부 통과)

---

## 체크리스트

- [x] 2-1. PostgreSQL + Prisma 스키마 설계
- [x] 2-2. `@dice-game/server` 패키지 초기화 (Fastify)
- [x] 2-3. Google OAuth 인증 (로그인 / 신규 계정 생성)
- [x] 2-4. 덱 CRUD API
- [x] 2-5. Socket.io 게임룸 기본 구조
- [x] 2-6. 드래프트 이벤트 (3개 선택 + 순서 봉인 동기화)
- [x] 2-7. 라운드 진행 이벤트 (서버 검증 + 결과 브로드캐스트)
- [x] 2-8. 게임 결과 DB 저장 + 유저/덱 통계 갱신
- [x] 2-9. 클라이언트 — 인증 UI + 실시간 연결
- [x] 2-10. 전적 / 대전기록 / 덱 승률 조회 API

---

## 2-1. DB 스키마

### ERD 개요

```
users ─┬─< decks ─< dice
       │      └──── deck_stats (덱별 승률)
       ├── user_stats (계정별 전적)
       └─< matches >─ users (player_a / player_b)
              └─< rounds
```

### `packages/server/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── 유저 ──────────────────────────────────────────────────────
model User {
  id         String   @id @default(cuid())
  googleId   String   @unique          // Google OAuth sub
  email      String   @unique
  nickname   String
  avatarUrl  String?
  createdAt  DateTime @default(now())

  decks      Deck[]
  stats      UserStats?
  matchesAsA Match[]   @relation("PlayerA")
  matchesAsB Match[]   @relation("PlayerB")
}

// ── 계정 전적 (1:1) ──────────────────────────────────────────
model UserStats {
  id            String @id @default(cuid())
  userId        String @unique
  totalWins     Int    @default(0)
  totalLosses   Int    @default(0)
  currentStreak Int    @default(0)   // 현재 연승
  maxStreak     Int    @default(0)   // 역대 최고 연승

  user User @relation(fields: [userId], references: [id])
}

// ── 덱 ───────────────────────────────────────────────────────
model Deck {
  id        String   @id @default(cuid())
  name      String
  userId    String
  createdAt DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id])
  dice      Die[]
  stats     DeckStats?
  matchesAsA Match[]  @relation("DeckA")
  matchesAsB Match[]  @relation("DeckB")
}

// ── 덱 승률 (1:1) ────────────────────────────────────────────
model DeckStats {
  id          String @id @default(cuid())
  deckId      String @unique
  totalGames  Int    @default(0)
  wins        Int    @default(0)
  losses      Int    @default(0)
  // winRate = wins / totalGames — 조회 시 계산

  deck Deck @relation(fields: [deckId], references: [id])
}

// ── 주사위 ───────────────────────────────────────────────────
model Die {
  id      String @id @default(cuid())
  deckId  String
  faces   Int[]  // 길이 6, 합계 21 — 저장 전 server에서 검증
  order   Int    // 덱 내 순서 0~3

  deck Deck @relation(fields: [deckId], references: [id])
}

// ── 대전 ─────────────────────────────────────────────────────
model Match {
  id          String     @id @default(cuid())
  playerAId   String
  playerBId   String
  deckAId     String
  deckBId     String
  winnerId    String?    // 승자 userId
  state       MatchState @default(DRAFT)
  createdAt   DateTime   @default(now())
  finishedAt  DateTime?

  playerA User   @relation("PlayerA", fields: [playerAId], references: [id])
  playerB User   @relation("PlayerB", fields: [playerBId], references: [id])
  deckA   Deck   @relation("DeckA", fields: [deckAId], references: [id])
  deckB   Deck   @relation("DeckB", fields: [deckBId], references: [id])
  rounds  Round[]
}

// ── 라운드 ───────────────────────────────────────────────────
model Round {
  id       String @id @default(cuid())
  matchId  String
  number   Int    // 1 | 2 | 3
  winnerId String // playerAId | playerBId
  rolls    Json   // RollResult[] 직렬화

  match Match @relation(fields: [matchId], references: [id])
}

enum MatchState {
  DRAFT
  IN_PROGRESS
  FINISHED
}
```

### 마이그레이션

```bash
cd packages/server
pnpm prisma migrate dev --name init
pnpm prisma generate
```

---

## 2-2. `@dice-game/server` 초기화

```bash
cd packages/server
pnpm init
pnpm add fastify @fastify/cors @fastify/jwt @fastify/oauth2 socket.io
pnpm add @prisma/client prisma
pnpm add @dice-game/core
pnpm add -D typescript tsx @types/node vitest
```

### 폴더 구조

```
packages/server/src/
├── index.ts
├── plugins/
│   ├── auth.ts           ← JWT 플러그인
│   ├── oauth.ts          ← Google OAuth 플러그인
│   └── db.ts             ← Prisma 클라이언트 싱글턴
├── routes/
│   ├── auth.ts           ← GET /auth/google, /auth/google/callback
│   ├── decks.ts          ← GET/POST/DELETE /decks
│   └── stats.ts          ← GET /users/:id/stats, /users/:id/matches, /decks/:id/stats
├── socket/
│   ├── index.ts
│   ├── matchRoom.ts
│   └── gameEngine.ts
└── lib/
    ├── errors.ts
    └── statsUpdater.ts   ← 통계 갱신 공통 함수
```

---

## 2-3. Google OAuth 인증

`@fastify/oauth2` 플러그인으로 구현.
로그인 = 신규 계정 자동 생성 (email 기준 upsert).

### 흐름

```
클라이언트 → GET /auth/google
  → Google 로그인 페이지
  → 콜백: GET /auth/google/callback
  → 서버: Google API로 유저 정보 조회
  → DB upsert (신규면 UserStats, DeckStats 초기화)
  → JWT 발급 → 클라이언트 리다이렉트
```

### `src/plugins/oauth.ts`

```typescript
import fp from 'fastify-plugin'
import oauth2 from '@fastify/oauth2'

export default fp(async (app) => {
  app.register(oauth2, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID!,
        secret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: process.env.GOOGLE_CALLBACK_URI!,
  })
})
```

### `src/routes/auth.ts`

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../plugins/db.js'

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Google OAuth 콜백
  app.get('/google/callback', async (req, reply) => {
    const tokenRes = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req)
    const accessToken = tokenRes.token.access_token

    // Google API로 유저 정보 조회
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const googleUser = await res.json() as {
      id: string; email: string; name: string; picture: string
    }

    // DB upsert — 신규/기존 모두 처리
    const user = await prisma.user.upsert({
      where: { googleId: googleUser.id },
      update: { avatarUrl: googleUser.picture },
      create: {
        googleId: googleUser.id,
        email: googleUser.email,
        nickname: googleUser.name,
        avatarUrl: googleUser.picture,
        stats: { create: {} },   // UserStats 초기화
      },
    })

    const token = app.jwt.sign({ userId: user.id }, { expiresIn: '7d' })

    // 클라이언트로 리다이렉트 (토큰을 쿼리스트링으로 전달)
    reply.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`)
  })

  // 현재 유저 정보
  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = req.user as { userId: string }
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, email: true, avatarUrl: true },
    })
  })
}
```

### 클라이언트 — 로그인 버튼

```typescript
// 구글 로그인 버튼 클릭 시
const handleGoogleLogin = () => {
  window.location.href = `${import.meta.env.VITE_SERVER_URL}/auth/google`
}

// /auth/callback 페이지에서 토큰 추출 후 저장
const params = new URLSearchParams(window.location.search)
const token = params.get('token')
if (token) {
  useAuthStore.getState().login(token)
  navigate('/')
}
```

---

## 2-4. 덱 CRUD API

### `src/routes/decks.ts`

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { validateDeck } from '@dice-game/core'
import { prisma } from '../plugins/db.js'

export const deckRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate)

  // 내 덱 목록 (덱 승률 포함)
  app.get('/', async (req) => {
    const { userId } = req.user as { userId: string }
    return prisma.deck.findMany({
      where: { userId },
      include: {
        dice: { orderBy: { order: 'asc' } },
        stats: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // 덱 저장 (DeckStats 자동 초기화)
  app.post<{ Body: { name: string; dice: Array<{ faces: number[] }> } }>(
    '/',
    async (req, reply) => {
      const { userId } = req.user as { userId: string }
      const { name, dice } = req.body

      const deckForValidation = {
        id: 'tmp', name,
        dice: dice.map((d, i) => ({ id: `${i}`, faces: d.faces })) as any,
      }
      const result = validateDeck(deckForValidation)
      if (!result.valid) return reply.status(400).send({ error: result.reason })

      return prisma.deck.create({
        data: {
          name, userId,
          dice: { create: dice.map((d, order) => ({ faces: d.faces, order })) },
          stats: { create: {} },   // DeckStats 초기화
        },
        include: { dice: true, stats: true },
      })
    }
  )

  // 덱 삭제
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const deck = await prisma.deck.findFirst({ where: { id: req.params.id, userId } })
    if (!deck) return reply.status(404).send({ error: 'Not found' })
    await prisma.deck.delete({ where: { id: deck.id } })
    return { ok: true }
  })
}
```

---

## 2-5 ~ 2-7. Socket.io 게임룸

### 이벤트 설계

| 방향 | 이벤트명 | 페이로드 | 설명 |
|------|----------|----------|------|
| client→server | `room:join` | `{ matchId, token }` | 게임룸 입장 |
| server→client | `room:ready` | `{ opponentNickname, opponentDeck }` | 양쪽 입장 완료 |
| client→server | `draft:pick` | `{ diceIds: [id,id,id] }` | 3개 선택 + 순서 봉인 |
| server→client | `draft:done` | `{ myPick, oppPick }` | 양쪽 봉인 완료 |
| client→server | `round:roll` | `{ round: number }` | 굴리기 요청 |
| server→client | `round:result` | `{ rolls, winner, gameState }` | 라운드 결과 |
| server→client | `game:over` | `{ winner, finalState }` | 게임 종료 |

### `src/socket/matchRoom.ts`

```typescript
import type { Server, Socket } from 'socket.io'
import { resolveRound, applyRoundResult } from '@dice-game/core'
import { prisma } from '../plugins/db.js'
import { updateStatsOnMatchEnd } from '../lib/statsUpdater.js'

const rooms = new Map<string, RoomState>()

interface RoomState {
  matchId: string
  players: [string, string]
  userIds: [string, string]
  decks: [any, any]
  picks: [any | null, any | null]
  gameState: any
}

export function registerMatchRoom(io: Server, socket: Socket, userId: string) {
  socket.on('room:join', async ({ matchId }) => {
    socket.join(matchId)

    let room = rooms.get(matchId)
    if (!room) {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          playerA: { select: { id: true, nickname: true } },
          playerB: { select: { id: true, nickname: true } },
          deckA: { include: { dice: true } },
          deckB: { include: { dice: true } },
        },
      })
      if (!match) return

      room = {
        matchId,
        players: [socket.id, ''],
        userIds: [match.playerAId, match.playerBId],
        decks: [match.deckA, match.deckB],
        picks: [null, null],
        gameState: null,
      }
      rooms.set(matchId, room)
    } else {
      room.players[1] = socket.id
    }

    if (room.players[0] && room.players[1]) {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          playerA: { select: { nickname: true, avatarUrl: true } },
          playerB: { select: { nickname: true, avatarUrl: true } },
          deckA: { include: { dice: true } },
          deckB: { include: { dice: true } },
        },
      })
      io.to(room.players[0]).emit('room:ready', {
        opponent: match!.playerB, opponentDeck: match!.deckB,
      })
      io.to(room.players[1]).emit('room:ready', {
        opponent: match!.playerA, opponentDeck: match!.deckA,
      })
    }
  })

  socket.on('draft:pick', ({ matchId, diceIds }) => {
    const room = rooms.get(matchId)
    if (!room) return

    const playerIdx = room.players.indexOf(socket.id)
    room.picks[playerIdx] = { diceIds }

    if (room.picks[0] && room.picks[1]) {
      io.to(room.players[0]).emit('draft:done', { myPick: room.picks[0], oppPick: room.picks[1] })
      io.to(room.players[1]).emit('draft:done', { myPick: room.picks[1], oppPick: room.picks[0] })
    }
  })

  socket.on('round:roll', ({ matchId, round }) => {
    const room = rooms.get(matchId)
    if (!room) return

    const dieA = room.decks[0].dice.find((d: any) => d.id === room.picks[0].diceIds[round - 1])
    const dieB = room.decks[1].dice.find((d: any) => d.id === room.picks[1].diceIds[round - 1])

    const { rolls, winner } = resolveRound(dieA, dieB)
    const initial = { round: 1, myWins: 0, oppWins: 0, rolls: [], finished: false, winner: null }
    room.gameState = applyRoundResult(room.gameState ?? initial, rolls, winner)

    io.to(matchId).emit('round:result', { rolls, winner, gameState: room.gameState })

    if (room.gameState.finished) {
      io.to(matchId).emit('game:over', { winner, finalState: room.gameState })
      finalizeMatch(matchId, room, winner)
    }
  })
}
```

---

## 2-8. 게임 결과 저장 + 통계 갱신

### `src/lib/statsUpdater.ts`

게임 종료 시 **유저 통계(승/패/연승)** 와 **덱 승률**을 단일 트랜잭션으로 갱신.

```typescript
import { prisma } from '../plugins/db.js'

export async function updateStatsOnMatchEnd(
  matchId: string,
  winnerUserId: string,
  loserUserId: string,
  winnerDeckId: string,
  loserDeckId: string,
) {
  await prisma.$transaction([
    // Match 상태 업데이트
    prisma.match.update({
      where: { id: matchId },
      data: { state: 'FINISHED', winnerId: winnerUserId, finishedAt: new Date() },
    }),

    // 승자 유저 통계
    prisma.userStats.upsert({
      where: { userId: winnerUserId },
      update: {
        totalWins: { increment: 1 },
        currentStreak: { increment: 1 },
        // maxStreak는 애플리케이션 레벨에서 비교 후 별도 업데이트
      },
      create: { userId: winnerUserId, totalWins: 1, currentStreak: 1, maxStreak: 1 },
    }),

    // 패자 유저 통계 (연승 초기화)
    prisma.userStats.upsert({
      where: { userId: loserUserId },
      update: {
        totalLosses: { increment: 1 },
        currentStreak: 0,
      },
      create: { userId: loserUserId, totalLosses: 1 },
    }),

    // 승자 덱 통계
    prisma.deckStats.upsert({
      where: { deckId: winnerDeckId },
      update: { totalGames: { increment: 1 }, wins: { increment: 1 } },
      create: { deckId: winnerDeckId, totalGames: 1, wins: 1 },
    }),

    // 패자 덱 통계
    prisma.deckStats.upsert({
      where: { deckId: loserDeckId },
      update: { totalGames: { increment: 1 }, losses: { increment: 1 } },
      create: { deckId: loserDeckId, totalGames: 1, losses: 1 },
    }),
  ])

  // maxStreak 별도 갱신 (현재값 조회 필요)
  const stats = await prisma.userStats.findUnique({ where: { userId: winnerUserId } })
  if (stats && stats.currentStreak > stats.maxStreak) {
    await prisma.userStats.update({
      where: { userId: winnerUserId },
      data: { maxStreak: stats.currentStreak },
    })
  }
}

async function finalizeMatch(matchId: string, room: RoomState, winner: 'me' | 'opp') {
  const winnerIdx = winner === 'me' ? 0 : 1
  const loserIdx = 1 - winnerIdx
  await updateStatsOnMatchEnd(
    matchId,
    room.userIds[winnerIdx],
    room.userIds[loserIdx],
    room.decks[winnerIdx].id,
    room.decks[loserIdx].id,
  )
}
```

---

## 2-9. 클라이언트 — 인증 UI + 실시간 연결

### 추가 패키지

```bash
cd packages/client
pnpm add socket.io-client axios
```

### `src/lib/socket.ts`

```typescript
import { io } from 'socket.io-client'

export const socket = io(import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001', {
  autoConnect: false,
  auth: { token: () => localStorage.getItem('token') },
})
```

### `src/store/authStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  token: string | null
  userId: string | null
  nickname: string | null
  avatarUrl: string | null
  login: (token: string) => void   // JWT 디코딩으로 userId 추출
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null, userId: null, nickname: null, avatarUrl: null,
      login: (token) => {
        // JWT payload 디코딩 (검증 아님 — 서버에서 검증)
        const payload = JSON.parse(atob(token.split('.')[1]))
        set({ token, userId: payload.userId })
      },
      logout: () => set({ token: null, userId: null, nickname: null, avatarUrl: null }),
    }),
    { name: 'auth' }
  )
)
```

### 화면 구성

```
로그인 화면
└── "Google로 계속하기" 버튼 (Google 로고 포함)

/auth/callback 페이지
└── URL 파라미터에서 token 추출 → authStore.login(token) → 홈으로 이동
```

---

## 2-10. 전적 / 대전기록 / 덱 승률 조회 API

### `src/routes/stats.ts`

```typescript
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../plugins/db.js'

export const statsRoutes: FastifyPluginAsync = async (app) => {
  // 계정 통계 (승/패/연승)
  app.get<{ Params: { userId: string } }>(
    '/users/:userId/stats',
    { onRequest: [app.authenticate] },
    async (req) => {
      const stats = await prisma.userStats.findUnique({
        where: { userId: req.params.userId },
      })
      return stats ?? { totalWins: 0, totalLosses: 0, currentStreak: 0, maxStreak: 0 }
    }
  )

  // 대전 기록 (최신순, 페이지네이션)
  app.get<{
    Params: { userId: string }
    Querystring: { page?: string; limit?: string }
  }>(
    '/users/:userId/matches',
    { onRequest: [app.authenticate] },
    async (req) => {
      const page = Number(req.query.page ?? 1)
      const limit = Number(req.query.limit ?? 20)
      const userId = req.params.userId

      const [matches, total] = await Promise.all([
        prisma.match.findMany({
          where: {
            OR: [{ playerAId: userId }, { playerBId: userId }],
            state: 'FINISHED',
          },
          include: {
            playerA: { select: { nickname: true, avatarUrl: true } },
            playerB: { select: { nickname: true, avatarUrl: true } },
            deckA: { select: { name: true } },
            deckB: { select: { name: true } },
            rounds: { orderBy: { number: 'asc' } },
          },
          orderBy: { finishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.match.count({
          where: {
            OR: [{ playerAId: userId }, { playerBId: userId }],
            state: 'FINISHED',
          },
        }),
      ])

      return { matches, total, page, totalPages: Math.ceil(total / limit) }
    }
  )

  // 덱 승률
  app.get<{ Params: { deckId: string } }>(
    '/decks/:deckId/stats',
    { onRequest: [app.authenticate] },
    async (req) => {
      const stats = await prisma.deckStats.findUnique({
        where: { deckId: req.params.deckId },
        include: { deck: { select: { name: true } } },
      })
      if (!stats) return { totalGames: 0, wins: 0, losses: 0, winRate: null }

      return {
        ...stats,
        winRate: stats.totalGames > 0
          ? Math.round((stats.wins / stats.totalGames) * 1000) / 10  // 소수점 1자리 %
          : null,
      }
    }
  )

  // 전체 덱 승률 랭킹 (상위 20개)
  app.get('/decks/rankings', async () => {
    const stats = await prisma.deckStats.findMany({
      where: { totalGames: { gte: 5 } },   // 5판 이상만 집계
      include: {
        deck: { select: { name: true, user: { select: { nickname: true } } } },
      },
      orderBy: [{ wins: 'desc' }, { totalGames: 'desc' }],
      take: 20,
    })
    return stats.map(s => ({
      ...s,
      winRate: Math.round((s.wins / s.totalGames) * 1000) / 10,
    }))
  })
}
```

---

## 클라이언트 — 프로필/전적 화면

```
프로필 화면
├── 아바타 + 닉네임
├── 통계 카드
│   ├── 승 / 패
│   ├── 승률 (wins / (wins + losses))
│   └── 현재 연승 / 최고 연승
└── 대전 기록 리스트 (최신순)
    └── 각 행: 상대 닉네임 | 사용 덱 | 승/패 | 날짜

덱 빌더 화면 — 덱 카드에 승률 배지 추가
└── 예: "18전 12승 (66.7%)"
```

---

## `.env` 파일

### server

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dicegame
JWT_SECRET=your-secret-key-change-in-production
CLIENT_URL=http://localhost:5173
PORT=3001

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URI=http://localhost:3001/auth/google/callback
```

### client

```env
VITE_SERVER_URL=http://localhost:3001
```

---

## 로컬 개발 환경 실행 순서

```bash
# 1. PostgreSQL 실행 (Docker)
docker run -d --name pg-dice \
  -e POSTGRES_DB=dicegame \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 postgres:16

# 2. 마이그레이션
cd packages/server && pnpm prisma migrate dev

# 3. 서버 실행
pnpm dev:server

# 4. 클라이언트 실행
pnpm dev:client
```

---

## 완료 기준 (Definition of Done)

1. Google 로그인 → JWT 발급 → 신규 계정 자동 생성
2. 덱 저장 API — 총합 21 아닌 주사위 포함 시 400 반환
3. 두 브라우저 탭에서 같은 matchId로 접속 → `room:ready` 수신
4. 드래프트 봉인 → `draft:done` 양쪽 수신
5. 라운드 굴리기 → 서버 판정 → 결과 양쪽 수신
6. 2선승 시 `game:over` 발생 + DB 결과 저장
7. 게임 종료 후 승/패/연승 통계 갱신 확인
8. 덱 승률 API — 5판 이상 시 정확한 승률 반환
9. 대전 기록 API — 최신순 페이지네이션 정상 동작

---

## 다음 단계

Phase 2 완료 후 → [PHASE-3.md](./PHASE-3.md)

랜덤 매칭 큐, 게임 UX 완성, 주사위 3D 애니메이션
