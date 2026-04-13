import type { Server, Socket } from 'socket.io'
import { applyRoundResult } from '@dice-game/core'
import type { Die, RollResult } from '@dice-game/core'
import { prisma } from '../plugins/db.js'
import { updateStatsOnMatchEnd } from '../lib/statsUpdater.js'
import {
  getRoom, setRoom, deleteRoom, createRoom,
  setSocketRoom, getSocketRoom, deleteSocketRoom,
  setRoomPlayerSlot, getRoomPlayerSlots,
  setRematchInfo, getRematchInfo, setRematchRequest, deleteRematchContext,
} from '../lib/gameStore.js'

// 드래프트 타임아웃 타이머 (프로세스 로컬, Redis 직렬화 불필요)
const draftTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DRAFT_TIMEOUT_MS = 40_000

function clearDraftTimer(matchId: string) {
  const t = draftTimers.get(matchId)
  if (t) { clearTimeout(t); draftTimers.delete(matchId) }
}

function getRestoreSnapshot(room: ReturnType<typeof createRoom>, playerIdx: 0 | 1) {
  const oppIdx: 0 | 1 = playerIdx === 0 ? 1 : 0
  const myUserId = room.players[playerIdx]?.userId
  const roundWinners = room.roundHistory.map(round =>
    round.winnerId === myUserId ? 'me' as const : 'opp' as const
  )
  const lastHistory = room.roundHistory[room.roundHistory.length - 1]
  const lastWinner = lastHistory
    ? (lastHistory.winnerId === myUserId ? 'me' as const : 'opp' as const)
    : null
  const lastRolls: RollResult[] = room.currentRoundRolls.length > 0
    ? room.currentRoundRolls
    : room.gameState.rolls

  let phase: 'draft' | 'round' | 'waiting-opponent-roll' | 'round-draw' = 'round'
  if (!room.picks[0] || !room.picks[1]) {
    phase = 'draft'
  } else if (room.currentRoundRolls.length > 0 && room.currentRoundRolls[room.currentRoundRolls.length - 1]?.result === 'draw') {
    phase = 'round-draw'
  } else if (room.roundReady[playerIdx] && !room.roundReady[oppIdx]) {
    phase = 'waiting-opponent-roll'
  }

  return {
    phase,
    currentRound: room.gameState.round,
    myPick: room.picks[playerIdx],
    oppPick: room.picks[oppIdx],
    gameState: room.gameState,
    roundWinners,
    lastRolls,
    lastWinner,
    opponentReady: !!room.picks[oppIdx],
    hasRolled: room.roundReady[playerIdx],
    opponentRolled: room.roundReady[oppIdx],
  }
}

export function registerMatchRoom(io: Server, socket: Socket, userId: string) {

  // ── room:join ─────────────────────────────────────────────
  socket.on('room:join', async ({ matchId }: { matchId: string }) => {
    try {
      socket.join(matchId)

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          playerA: { select: { id: true, nickname: true, avatarUrl: true } },
          playerB: { select: { id: true, nickname: true, avatarUrl: true } },
          deckA: { include: { dice: { orderBy: { order: 'asc' } } } },
          deckB: { include: { dice: { orderBy: { order: 'asc' } } } },
        },
      })
      if (!match) return socket.emit('error', { message: '존재하지 않는 매치' })

      const isPlayerA = match.playerAId === userId
      const playerIdx = isPlayerA ? 0 : 1
      const player = { socketId: socket.id, userId }

      // ── 플레이어 슬롯을 원자적으로 저장 (레이스 컨디션 방지) ──
      // 전체 room JSON을 READ-MODIFY-WRITE하면 두 플레이어가 동시에
      // 입장할 때 한 쪽 데이터를 덮어쓰는 문제가 발생하므로,
      // 각 플레이어 슬롯을 Redis Hash 필드에 개별 저장한다.
      await setRoomPlayerSlot(matchId, playerIdx as 0 | 1, player)
      const [player0, player1] = await getRoomPlayerSlots(matchId)

      await setSocketRoom(socket.id, matchId)

      // 재접속: 이미 진행 중인 경우 현재 상태 복원
      if (match.state === 'IN_PROGRESS') {
        const room = await getRoom(matchId)
        if (room) {
          room.players[playerIdx] = player
          await setRoom(matchId, room)

          socket.emit('room:restore', getRestoreSnapshot(room, playerIdx as 0 | 1))

          const opp = room.players[1 - playerIdx]
          if (opp && opp.socketId !== socket.id) {
            io.to(opp.socketId).emit('opponent:reconnected')
          }
        }
        return
      }

      // 양쪽 모두 입장 → 게임 시작
      if (player0 && player1) {
        // room 객체 생성/갱신 (picks·gameState 등 나머지 상태 초기화)
        let room = await getRoom(matchId)
        if (!room) room = createRoom(matchId, match.deckA, match.deckB)
        room.players[0] = player0
        room.players[1] = player1
        await setRoom(matchId, room)

        await prisma.match.update({ where: { id: matchId }, data: { state: 'IN_PROGRESS' } })

        // 양쪽 통계 조회
        const [statsA, statsB] = await Promise.all([
          prisma.userStats.findUnique({ where: { userId: match.playerAId } }),
          prisma.userStats.findUnique({ where: { userId: match.playerBId } }),
        ])

        const toStats = (s: typeof statsA) => ({
          totalWins: s?.totalWins ?? 0,
          totalLosses: s?.totalLosses ?? 0,
          currentStreak: s?.currentStreak ?? 0,
        })

        io.to(player0.socketId).emit('room:ready', {
          opponent: match.playerB,
          opponentDeck: match.deckB,
          myDeck: match.deckA,
          myStats: toStats(statsA),
          opponentStats: toStats(statsB),
        })
        io.to(player1.socketId).emit('room:ready', {
          opponent: match.playerA,
          opponentDeck: match.deckA,
          myDeck: match.deckB,
          myStats: toStats(statsB),
          opponentStats: toStats(statsA),
        })

        // 드래프트 40초 타임아웃 시작
        startDraftTimeout(io, matchId)
      }
    } catch (err) {
      console.error('room:join error', err)
      socket.emit('error', { message: 'room:join 실패' })
    }
  })

  // ── draft:pick ────────────────────────────────────────────
  socket.on('draft:pick', async ({ matchId, diceIds }: { matchId: string; diceIds: string[] }) => {
    try {
      const room = await getRoom(matchId)
      if (!room) return

      const playerIdx = room.players.findIndex(p => p?.socketId === socket.id)
      if (playerIdx === -1) return

      room.picks[playerIdx] = diceIds
      await setRoom(matchId, room)

      // 상대방에게 "상대가 봉인 완료" 알림
      const oppIdx2 = 1 - playerIdx
      const opp2 = room.players[oppIdx2]
      if (opp2) io.to(opp2.socketId).emit('opponent:sealed')

      // 양쪽 픽 완료 → 드래프트 타임아웃 취소 후 게임 시작
      if (room.picks[0] && room.picks[1]) {
        clearDraftTimer(matchId)
        emitDraftDone(io, room)
      }
    } catch (err) {
      console.error('draft:pick error', err)
    }
  })

  // ── round:roll ────────────────────────────────────────────
  // 클라이언트가 주사위를 던진 뒤 호출. 양쪽 모두 던지면 서버가 결과 결정.
  socket.on('round:roll', async ({ matchId, round, value }: { matchId: string; round: number; value: number }) => {
    try {
      const room = await getRoom(matchId)
      if (!room || !room.picks[0] || !room.picks[1]) return

      const playerIdx = room.players.findIndex(p => p?.socketId === socket.id)
      if (playerIdx === -1) return

      // 이미 준비된 경우 무시
      if (room.roundReady[playerIdx]) return

      const roundIdx = round - 1
      const myDie = room.decks[playerIdx].dice.find((d: Die) => d.id === room.picks![playerIdx]![roundIdx])
      if (!myDie) return
      if (!myDie.faces.includes(value)) {
        socket.emit('error', { message: '유효하지 않은 주사위 눈입니다' })
        return
      }

      room.roundReady[playerIdx] = true
      room.roundValues[playerIdx] = value
      await setRoom(matchId, room)

      // 상대방에게 "상대가 던짐" 알림
      const oppIdx = 1 - playerIdx
      const opp = room.players[oppIdx]
      if (opp) io.to(opp.socketId).emit('opponent:rolled')

      // 양쪽 모두 던진 경우 → 서버가 라운드 결과 결정
      if (room.roundReady[0] && room.roundReady[1]) {
        const myRoll = room.roundValues[0]
        const oppRoll = room.roundValues[1]
        if (myRoll === null || oppRoll === null) return

        const roll = {
          myRoll,
          oppRoll,
          result: myRoll > oppRoll ? 'win' as const : myRoll < oppRoll ? 'lose' as const : 'draw' as const,
        }
        room.currentRoundRolls.push(roll)
        room.roundReady = [false, false]
        room.roundValues = [null, null]

        if (roll.result === 'draw') {
          await setRoom(matchId, room)
          io.to(matchId).emit('round:draw', {
            round,
            roll,
            rolls: room.currentRoundRolls,
          })
          return
        }

        const winner = roll.result === 'win' ? 'me' : 'opp'
        const rolls = [...room.currentRoundRolls]
        room.gameState = applyRoundResult(room.gameState, rolls, winner)
        room.currentRoundRolls = []

        const winnerUserId = winner === 'me' ? room.players[0]!.userId : room.players[1]!.userId
        room.roundHistory.push({ number: round, winnerId: winnerUserId, rolls })
        await setRoom(matchId, room)

        io.to(matchId).emit('round:result', {
          round,
          rolls,
          winner,
          winnerUserId,
          gameState: room.gameState,
        })

        if (room.gameState.finished) {
          const winnerIdx = winner === 'me' ? 0 : 1
          const loserIdx = 1 - winnerIdx

          io.to(matchId).emit('game:over', {
            winnerUserId: room.players[winnerIdx]!.userId,
            finalState: room.gameState,
          })

          updateStatsOnMatchEnd({
            matchId,
            winnerUserId: room.players[winnerIdx]!.userId,
            loserUserId: room.players[loserIdx]!.userId,
            winnerDeckId: room.decks[winnerIdx].id,
            loserDeckId: room.decks[loserIdx].id,
            rounds: room.roundHistory,
          }).catch(console.error)

          // 재대결을 위해 플레이어 정보·덱 정보를 30초간 보존
          await setRematchInfo(
            matchId,
            [room.players[0]!, room.players[1]!],
            [room.decks[0].id, room.decks[1].id],
          )

          await deleteRoom(matchId)
          for (const p of room.players) {
            if (p) await deleteSocketRoom(p.socketId)
          }
        }
      }
    } catch (err) {
      console.error('round:roll error', err)
    }
  })

  // ── rematch:request ───────────────────────────────────────
  socket.on('rematch:request', async ({ matchId }: { matchId: string }) => {
    try {
      const info = await getRematchInfo(matchId)
      if (!info) {
        socket.emit('rematch:declined', { reason: 'expired' })
        return
      }

      const playerIdx = info.players[0].userId === userId
        ? 0
        : info.players[1].userId === userId
          ? 1
          : -1
      if (playerIdx === -1) return

      const { bothReady, info: finalInfo } = await setRematchRequest(matchId, playerIdx as 0 | 1)

      if (bothReady && finalInfo) {
        // 양쪽 모두 수락 → 새 매치 생성
        const newMatch = await prisma.match.create({
          data: {
            playerAId: finalInfo.players[0].userId,
            playerBId: finalInfo.players[1].userId,
            deckAId:   finalInfo.deckIds[0],
            deckBId:   finalInfo.deckIds[1],
            state:     'DRAFT',
          },
        })
        await deleteRematchContext(matchId)

        io.to(finalInfo.players[0].socketId).emit('rematch:matched', { newMatchId: newMatch.id })
        io.to(finalInfo.players[1].socketId).emit('rematch:matched', { newMatchId: newMatch.id })
        console.log(`[Rematch] ${finalInfo.players[0].userId} vs ${finalInfo.players[1].userId} → new match ${newMatch.id}`)
      } else {
        // 내 요청을 상대에게 알림 (상대 버튼에 뱃지 표시용)
        const oppIdx = 1 - playerIdx
        io.to(info.players[oppIdx].socketId).emit('rematch:requested')
      }
    } catch (err) {
      console.error('rematch:request error', err)
    }
  })

  // ── rematch:cancel ─────────────────────────────────────────
  // 내가 재대결 거절(홈으로) 하거나 이미 요청했다가 취소할 때
  socket.on('rematch:cancel', async ({ matchId }: { matchId: string }) => {
    try {
      const info = await getRematchInfo(matchId)
      if (!info) return

      const playerIdx = info.players[0].userId === userId ? 0 : 1
      const oppIdx    = 1 - playerIdx

      await deleteRematchContext(matchId)
      io.to(info.players[oppIdx].socketId).emit('rematch:declined')
    } catch (err) {
      console.error('rematch:cancel error', err)
    }
  })

  // ── disconnect ────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      const matchId = await getSocketRoom(socket.id)
      if (!matchId) return

      const room = await getRoom(matchId)
      if (!room) { await deleteSocketRoom(socket.id); return }

      const disconnectedIdx = room.players.findIndex(p => p?.socketId === socket.id)
      if (disconnectedIdx === -1) { await deleteSocketRoom(socket.id); return }

      const oppIdx = 1 - disconnectedIdx
      const opp = room.players[oppIdx]
      const disconnectedPlayer = room.players[disconnectedIdx]

      // 드래프트 완료 후 게임 진행 중이면 → 나간 쪽 자동 패배
      const gameStarted = !!(room.picks[0] && room.picks[1])
      const gameInProgress = gameStarted && !room.gameState.finished

      if (gameInProgress && opp && disconnectedPlayer) {
        const winnerUserId = opp.userId
        const loserUserId = disconnectedPlayer.userId

        io.to(opp.socketId).emit('game:over', {
          winnerUserId,
          forfeit: true,
        })

        updateStatsOnMatchEnd({
          matchId,
          winnerUserId,
          loserUserId,
          winnerDeckId: room.decks[oppIdx].id,
          loserDeckId: room.decks[disconnectedIdx].id,
          rounds: room.roundHistory,
        }).catch(console.error)

        await deleteRoom(matchId)
        await deleteSocketRoom(opp.socketId)
      } else {
        if (opp) io.to(opp.socketId).emit('opponent:disconnected')
        room.players[disconnectedIdx] = null
        await setRoom(matchId, room)
      }

      await deleteSocketRoom(socket.id)
    } catch (err) {
      console.error('disconnect error', err)
    }
  })
}

// ── 드래프트 타임아웃 ─────────────────────────────────────────

function startDraftTimeout(io: Server, matchId: string) {
  clearDraftTimer(matchId)
  const timer = setTimeout(async () => {
    const room = await getRoom(matchId)
    if (!room) return

    // 픽 안 한 플레이어 자동 선택
    let changed = false
    for (let i = 0; i < 2; i++) {
      if (!room.picks[i]) {
        room.picks[i] = room.decks[i].dice.slice(0, 3).map((d: Die) => d.id)
        changed = true
        const player = room.players[i]
        if (player) io.to(player.socketId).emit('draft:timeout')
      }
    }

    if (changed && room.picks[0] && room.picks[1]) {
      await setRoom(matchId, room)
      emitDraftDone(io, room)
    }
    draftTimers.delete(matchId)
  }, DRAFT_TIMEOUT_MS)

  draftTimers.set(matchId, timer)
}

function emitDraftDone(io: Server, room: ReturnType<typeof createRoom>) {
  room.players[0] && io.to(room.players[0].socketId).emit('draft:done', {
    myPick: room.picks[0],
    oppPick: room.picks[1],
  })
  room.players[1] && io.to(room.players[1].socketId).emit('draft:done', {
    myPick: room.picks[1],
    oppPick: room.picks[0],
  })
}
