# Phase 3 — 매칭 시스템 + 게임 UX 완성

**목표:** 모르는 상대와 매칭되어 게임 완주 + 연출까지 갖춘 베타  
**기간:** 2주  
**선행 조건:** Phase 2 완료 (실제 1대1 게임 완주 가능)

---

## 체크리스트

- [x] 3-1. Redis 설정 + 게임 상태 이관
- [x] 3-2. 랜덤 매칭 큐 (matchmaking)
- [x] 3-3. 매칭 대기 화면 + 실시간 상태 표시
- [x] 3-4. 드래프트 화면 완성 (타임아웃 포함, 40초)
- [ ] 3-5. 주사위 굴리기 3D 애니메이션 (현재 CSS 2D 사용)
- [x] 3-6. 라운드 진행 화면 (동점 재대결 시각화)
- [x] 3-7. 게임 결과 화면 + 리플레이
- [x] 3-8. 연결 끊김 / 재접속 처리

---

## 3-1. Redis 설정

### 설치

```bash
cd packages/server
pnpm add ioredis
```

### `src/plugins/redis.ts`

```typescript
import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
```

### 게임 상태 저장 구조

```
Key 패턴                   값              TTL
─────────────────────────────────────────────────
match:{matchId}:state      JSON(GameState)  1시간
match:{matchId}:players    JSON([id,id])    1시간
match:{matchId}:picks      JSON([pick,pick])1시간
queue:waiting              List(userId)     —
```

### Phase 2의 인메모리 `rooms` Map → Redis로 교체

```typescript
// src/socket/gameEngine.ts

export async function getMatchState(matchId: string) {
  const raw = await redis.get(`match:${matchId}:state`)
  return raw ? JSON.parse(raw) : null
}

export async function setMatchState(matchId: string, state: unknown) {
  await redis.set(`match:${matchId}:state`, JSON.stringify(state), 'EX', 3600)
}
```

---

## 3-2. 랜덤 매칭 큐

### 매칭 흐름

```
유저 매칭 요청
  → Redis List에 userId push
  → 큐에 2명 이상이면 매칭 성사
  → Match 레코드 DB 생성
  → 두 유저에게 matchId emit
  → 각자 room:join
```

### `src/socket/matchmaking.ts`

```typescript
import type { Server, Socket } from 'socket.io'
import { redis } from '../plugins/redis.js'
import { prisma } from '../plugins/db.js'

const QUEUE_KEY = 'queue:waiting'

export function registerMatchmaking(io: Server, socket: Socket, userId: string) {
  socket.on('queue:join', async () => {
    // 소켓 id와 userId 매핑 저장
    await redis.set(`socket:${socket.id}`, userId, 'EX', 300)
    await redis.rpush(QUEUE_KEY, `${userId}:${socket.id}`)

    socket.emit('queue:joined', { position: await redis.llen(QUEUE_KEY) })

    await tryMatch(io)
  })

  socket.on('queue:leave', async () => {
    // 큐에서 해당 유저 제거
    const members = await redis.lrange(QUEUE_KEY, 0, -1)
    const entry = members.find(m => m.startsWith(userId))
    if (entry) await redis.lrem(QUEUE_KEY, 1, entry)
    socket.emit('queue:left')
  })

  socket.on('disconnect', async () => {
    const members = await redis.lrange(QUEUE_KEY, 0, -1)
    const entry = members.find(m => m.startsWith(userId))
    if (entry) await redis.lrem(QUEUE_KEY, 1, entry)
  })
}

async function tryMatch(io: Server) {
  const len = await redis.llen(QUEUE_KEY)
  if (len < 2) return

  const [entryA, entryB] = await redis.lmpop(2, QUEUE_KEY, 'LEFT') as string[]
  if (!entryA || !entryB) return

  const [userIdA, socketIdA] = entryA.split(':')
  const [userIdB, socketIdB] = entryB.split(':')

  // 기본 덱 가져오기 (첫 번째 덱 사용 — 추후 선택 UI 추가)
  const deckA = await prisma.deck.findFirst({ where: { userId: userIdA }, include: { dice: true } })
  const deckB = await prisma.deck.findFirst({ where: { userId: userIdB }, include: { dice: true } })

  if (!deckA || !deckB) {
    // 덱 없으면 다시 큐에 넣기
    await redis.rpush(QUEUE_KEY, entryA, entryB)
    return
  }

  const match = await prisma.match.create({
    data: {
      playerAId: userIdA, playerBId: userIdB,
      deckAId: deckA.id, deckBId: deckB.id,
      state: 'DRAFT',
    },
  })

  io.to(socketIdA).emit('queue:matched', { matchId: match.id, opponentDeck: deckB })
  io.to(socketIdB).emit('queue:matched', { matchId: match.id, opponentDeck: deckA })
}
```

---

## 3-3. 매칭 대기 화면

### 컴포넌트

```
src/components/Matchmaking/
├── MatchmakingScreen.tsx   ← 대기 중 화면
└── MatchFoundModal.tsx     ← 매칭 성사 알림
```

### `MatchmakingScreen.tsx` (핵심)

```typescript
useEffect(() => {
  socket.emit('queue:join')

  socket.on('queue:joined', ({ position }) => setPosition(position))
  socket.on('queue:matched', ({ matchId, opponentDeck }) => {
    setMatchFound({ matchId, opponentDeck })
  })

  return () => {
    socket.emit('queue:leave')
    socket.off('queue:joined')
    socket.off('queue:matched')
  }
}, [])
```

---

## 3-4. 드래프트 화면 완성

### 타임아웃 처리

- 드래프트 제한시간: **60초**
- 서버에서 타이머 관리, 만료 시 랜덤 선택 자동 적용
- 클라이언트는 카운트다운 표시만 담당

```typescript
// 서버: draft:pick 이벤트 수신 후 타임아웃 설정
const timer = setTimeout(async () => {
  if (!room.picks[playerIdx]) {
    // 자동 선택: 덱의 앞 3개 기본 적용
    room.picks[playerIdx] = { diceIds: deck.dice.slice(0, 3).map(d => d.id) }
    await checkDraftComplete(io, matchId, room)
  }
}, 60_000)
```

### UI 구성

```
드래프트 화면
├── 상대 덱 표시 (4개 주사위 — 눈/합계 공개)
├── 내 덱 표시 (4개 주사위)
│   └── 클릭으로 선택 (3개까지)
├── 선택된 순서 표시 (1번→2번→3번 슬롯)
├── 타이머 (60초 카운트다운)
└── "봉인하기" 버튼 (3개 선택 완료 시 활성화)
```

---

## 3-5. 주사위 굴리기 3D 애니메이션

CSS 3D Transform으로 구현 (라이브러리 없이).

```css
/* src/components/Game/Die3D.css */
.die-3d {
  width: 60px; height: 60px;
  transform-style: preserve-3d;
  transition: transform 0.6s ease-out;
}

.die-3d.rolling {
  animation: tumble 0.8s ease-out forwards;
}

@keyframes tumble {
  0%   { transform: rotateX(0) rotateY(0); }
  30%  { transform: rotateX(360deg) rotateY(180deg); }
  70%  { transform: rotateX(540deg) rotateY(360deg); }
  100% { transform: rotateX(var(--final-x)) rotateY(var(--final-y)); }
}
```

```typescript
// 결과 숫자에 따라 최종 회전각 계산
const faceRotations: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 90, y: 0 },
  4: { x: -90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
}
```

---

## 3-6. 라운드 진행 화면

### 동점 재대결 시각화

```
라운드 화면 구성
├── 라운드 번호 + 진행 상태 (● ● ○)
├── 양쪽 주사위 표시 (Die3D 컴포넌트)
├── 굴리기 결과 히스토리
│   ├── [내 3] vs [상대 3] → 동점 재대결
│   └── [내 5] vs [상대 2] → 승!
└── 다음 라운드 버튼 (결과 확인 후)
```

```typescript
// 동점 재대결 순차 표시 (0.8초 간격)
async function showRollsSequentially(rolls: RollResult[]) {
  for (const roll of rolls) {
    setCurrentRoll(roll)
    await delay(800)
  }
}
```

---

## 3-7. 게임 결과 화면

```
결과 화면
├── 승 / 패 헤더
├── 라운드별 요약
│   ├── 라운드 1: 주사위 A vs α → 내가 이김 (5 vs 3)
│   ├── 라운드 2: 주사위 B vs β → 상대 이김
│   └── 라운드 3: 주사위 C vs γ → 내가 이김 (재대결 2회)
└── 버튼: 다시하기 | 덱 수정 | 홈
```

---

## 3-8. 연결 끊김 / 재접속 처리

```typescript
// 클라이언트
socket.on('disconnect', () => {
  setConnectionStatus('disconnected')
  // 자동 재연결 (socket.io 기본 동작)
})

socket.on('reconnect', () => {
  // matchId가 있으면 자동으로 room:join 재시도
  if (currentMatchId) {
    socket.emit('room:join', { matchId: currentMatchId, token })
  }
})
```

```typescript
// 서버: 재접속 시 현재 게임 상태 복원
socket.on('room:join', async ({ matchId }) => {
  const state = await getMatchState(matchId)
  if (state) {
    socket.emit('room:restore', { gameState: state })
  }
})
```

---

## 완료 기준 (Definition of Done)

1. 매칭 큐 진입 → 상대 발견 → `queue:matched` 수신 정상 동작
2. 드래프트 60초 타임아웃 시 자동 선택 적용
3. 주사위 굴리기 시 3D 애니메이션 재생 후 결과 표시
4. 동점 재대결이 순차적으로(0.8초 간격) 시각화됨
5. 게임 종료 후 라운드별 요약 리플레이 표시
6. 브라우저 새로고침 후 재접속 시 게임 상태 복원

---

## 다음 단계

Phase 3 완료 후 → [PHASE-4.md](./PHASE-4.md)

전적 통계, 친구 초대, 배포 파이프라인, 보안 강화
