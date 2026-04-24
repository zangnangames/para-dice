import type { Server, Socket } from 'socket.io'
import type { GameMode } from '@dice-game/core'
import { redis } from '../plugins/redis.js'
import { prisma } from '../plugins/db.js'

const PRIVATE_ROOM_TTL = 600

// userId → socketId 역방향 매핑 (큐 중복 가입 방지 + 탈퇴 처리)
const queueKey = (mode: GameMode) => `queue:waiting:${mode}`
const queueSocketKey = (userId: string, mode: GameMode) => `queue:socket:${mode}:${userId}`
const privateRoomKey = (code: string) => `room:code:${code}`
const privateRoomHostKey = (userId: string) => `room:host:${userId}`

function toDbMode(mode: GameMode) {
  return mode === 'double-battle' ? 'DOUBLE_BATTLE' : 'CLASSIC'
}

function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function registerMatchmaking(io: Server, socket: Socket, userId: string) {

  // ── queue:join ──────────────────────────────────────────────
  socket.on('queue:join', async ({ mode = 'classic' }: { mode?: GameMode }) => {
    try {
      // 이미 큐에 있는지 확인
      const existing = await redis.get(queueSocketKey(userId, mode))
      if (existing) {
        // 기존 소켓 ID 갱신 (재연결 시)
        await redis.lrem(queueKey(mode), 0, `${userId}:${existing}`)
      }

      // 덱이 있는지 확인
      const deck = await prisma.deck.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { dice: { orderBy: { order: 'asc' } } },
      })
      if (!deck) {
        socket.emit('queue:error', { message: '덱을 먼저 저장해주세요' })
        return
      }

      // 큐에 등록
      const entry = `${userId}:${socket.id}`
      await redis.rpush(queueKey(mode), entry)
      await redis.set(queueSocketKey(userId, mode), socket.id, 'EX', 300)

      const position = await redis.llen(queueKey(mode))
      socket.emit('queue:joined', { position, mode })

      await tryMatch(io, mode)
    } catch (err) {
      console.error('queue:join error', err)
      socket.emit('queue:error', { message: '매칭 큐 참가 실패' })
    }
  })

  // ── queue:leave ─────────────────────────────────────────────
  socket.on('queue:leave', async ({ mode = 'classic' }: { mode?: GameMode } = {}) => {
    await removeFromQueue(userId, socket.id, mode)
    socket.emit('queue:left')
  })

  // ── room:create ────────────────────────────────────────────
  socket.on('room:create', async ({ mode = 'classic' }: { mode?: GameMode } = {}) => {
    try {
      const deck = await prisma.deck.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { dice: { orderBy: { order: 'asc' } } },
      })
      if (!deck) {
        socket.emit('room:error', { message: '덱을 먼저 저장해주세요' })
        return
      }

      const existingCode = await redis.get(privateRoomHostKey(userId))
      if (existingCode) {
        await Promise.all([
          redis.del(privateRoomKey(existingCode)),
          redis.del(privateRoomHostKey(userId)),
        ])
      }

      let code = generateRoomCode()
      while (await redis.exists(privateRoomKey(code))) {
        code = generateRoomCode()
      }

      await redis.set(
        privateRoomKey(code),
        JSON.stringify({ hostUserId: userId, hostSocketId: socket.id, hostDeckId: deck.id, mode }),
        'EX',
        PRIVATE_ROOM_TTL,
      )
      await redis.set(privateRoomHostKey(userId), code, 'EX', PRIVATE_ROOM_TTL)

      socket.emit('room:created', { code, mode })
    } catch (err) {
      console.error('room:create error', err)
      socket.emit('room:error', { message: '방 생성에 실패했습니다' })
    }
  })

  // ── room:enter ─────────────────────────────────────────────
  socket.on('room:enter', async ({ code }: { code: string }) => {
    try {
      const raw = await redis.get(privateRoomKey(code))
      if (!raw) {
        socket.emit('room:error', { message: '유효하지 않거나 만료된 방 코드입니다' })
        return
      }

      const room = JSON.parse(raw) as { hostUserId: string; hostSocketId: string; hostDeckId: string; mode?: GameMode }
      if (room.hostUserId === userId) {
        socket.emit('room:error', { message: '내가 만든 방에는 입장할 수 없습니다' })
        return
      }

      const hostSocket = io.sockets.sockets.get(room.hostSocketId)
      if (!hostSocket) {
        await Promise.all([
          redis.del(privateRoomKey(code)),
          redis.del(privateRoomHostKey(room.hostUserId)),
        ])
        socket.emit('room:error', { message: '방장이 오프라인입니다' })
        return
      }

      const deck = await prisma.deck.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { dice: { orderBy: { order: 'asc' } } },
      })
      if (!deck) {
        socket.emit('room:error', { message: '덱을 먼저 저장해주세요' })
        return
      }

      const match = await prisma.match.create({
        data: {
          playerAId: room.hostUserId,
          playerBId: userId,
          deckAId: room.hostDeckId,
          deckBId: deck.id,
          mode: toDbMode(room.mode ?? 'classic'),
          state: 'DRAFT',
        },
      })

      await Promise.all([
        redis.del(privateRoomKey(code)),
        redis.del(privateRoomHostKey(room.hostUserId)),
      ])

      io.to(room.hostSocketId).emit('room:matched', { matchId: match.id, code, mode: room.mode ?? 'classic' })
      socket.emit('room:matched', { matchId: match.id, code, mode: room.mode ?? 'classic' })
    } catch (err) {
      console.error('room:enter error', err)
      socket.emit('room:error', { message: '방 입장에 실패했습니다' })
    }
  })

  // ── room:cancel ────────────────────────────────────────────
  socket.on('room:cancel', async () => {
    await removePrivateRoom(userId)
    socket.emit('room:cancelled')
  })

  // ── disconnect: 큐에 있으면 자동 제거 ──────────────────────
  socket.on('disconnect', async () => {
    await Promise.all([
      removeFromQueue(userId, socket.id, 'classic'),
      removeFromQueue(userId, socket.id, 'double-battle'),
    ])
    await removePrivateRoom(userId)
  })
}

// ── 큐 제거 헬퍼 ─────────────────────────────────────────────

async function removeFromQueue(userId: string, socketId: string, mode: GameMode) {
  try {
    await redis.lrem(queueKey(mode), 0, `${userId}:${socketId}`)
    await redis.del(queueSocketKey(userId, mode))
  } catch (err) {
    console.error('removeFromQueue error', err)
  }
}

async function removePrivateRoom(userId: string) {
  try {
    const code = await redis.get(privateRoomHostKey(userId))
    if (!code) return

    await Promise.all([
      redis.del(privateRoomKey(code)),
      redis.del(privateRoomHostKey(userId)),
    ])
  } catch (err) {
    console.error('removePrivateRoom error', err)
  }
}

// ── 매칭 시도 ─────────────────────────────────────────────────

async function tryMatch(io: Server, mode: GameMode) {
  const len = await redis.llen(queueKey(mode))
  if (len < 2) return

  // 원자적으로 2명 pop
  const entries = await redis.lpop(queueKey(mode), 2)
  if (!entries || entries.length < 2) return

  const [userIdA, socketIdA] = entries[0].split(':')
  const [userIdB, socketIdB] = entries[1].split(':')

  // 같은 유저 두 번 매칭 방지 (탭 2개 등)
  if (userIdA === userIdB) {
    await redis.rpush(queueKey(mode), entries[0])
    return
  }

  try {
    // 각자 최근 덱 가져오기
    const [deckA, deckB] = await Promise.all([
      prisma.deck.findFirst({
        where: { userId: userIdA },
        orderBy: { createdAt: 'desc' },
        include: { dice: { orderBy: { order: 'asc' } } },
      }),
      prisma.deck.findFirst({
        where: { userId: userIdB },
        orderBy: { createdAt: 'desc' },
        include: { dice: { orderBy: { order: 'asc' } } },
      }),
    ])

    // 덱 없으면 다시 큐로 복귀
    if (!deckA) {
      await redis.rpush(queueKey(mode), entries[1]) // B는 복귀
      io.to(socketIdA).emit('queue:error', { message: '저장된 덱이 없습니다. 덱을 먼저 저장해주세요.' })
      return
    }
    if (!deckB) {
      await redis.rpush(queueKey(mode), entries[0]) // A는 복귀
      io.to(socketIdB).emit('queue:error', { message: '저장된 덱이 없습니다. 덱을 먼저 저장해주세요.' })
      return
    }

    // Match DB 생성
    const match = await prisma.match.create({
      data: {
        playerAId: userIdA,
        playerBId: userIdB,
        deckAId: deckA.id,
        deckBId: deckB.id,
        mode: toDbMode(mode),
        state: 'DRAFT',
      },
    })

    // 큐 소켓 매핑 정리
    await redis.del(queueSocketKey(userIdA, mode))
    await redis.del(queueSocketKey(userIdB, mode))

    // 양쪽에 매칭 성사 알림
    io.to(socketIdA).emit('queue:matched', {
      matchId: match.id,
      opponentDeck: deckB,
      mode,
    })
    io.to(socketIdB).emit('queue:matched', {
      matchId: match.id,
      opponentDeck: deckA,
      mode,
    })

    console.log(`[Matchmaking] matched: ${userIdA} vs ${userIdB} (${mode}) → match ${match.id}`)
  } catch (err) {
    // 매칭 실패 시 두 명 모두 큐 복귀
    console.error('tryMatch error', err)
    await redis.rpush(queueKey(mode), entries[0], entries[1])
  }
}
