import type { FastifyPluginAsync } from 'fastify'
import { getTempDeckRankings } from '../lib/tempDeckRankings.js'
import { prisma } from '../plugins/db.js'

export const statsRoutes: FastifyPluginAsync = async (app) => {
  // 계정 통계 (승/패/연승)
  app.get<{ Params: { userId: string } }>('/users/:userId/stats', async (req) => {
    const stats = await prisma.userStats.findUnique({
      where: { userId: req.params.userId },
    })
    return stats ?? {
      totalWins: 0,
      totalLosses: 0,
      currentStreak: 0,
      maxStreak: 0,
    }
  })

  // 대전 기록 (최신 10개)
  app.get<{
    Params: { userId: string }
  }>('/users/:userId/matches', async (req) => {
    const userId = req.params.userId

    const where = {
      OR: [{ playerAId: userId }, { playerBId: userId }] as any,
      state: 'FINISHED' as const,
    }

    const matches = await prisma.match.findMany({
      where,
      include: {
        playerA: { select: { id: true, nickname: true, avatarUrl: true } },
        playerB: { select: { id: true, nickname: true, avatarUrl: true } },
        deckA: {
          select: {
            id: true,
            name: true,
            dice: { orderBy: { order: 'asc' }, select: { id: true, faces: true, order: true } },
          },
        },
        deckB: {
          select: {
            id: true,
            name: true,
            dice: { orderBy: { order: 'asc' }, select: { id: true, faces: true, order: true } },
          },
        },
        rounds: { orderBy: { number: 'asc' } },
      },
      orderBy: { finishedAt: 'desc' },
      take: 10,
    })

    // 요청자 기준으로 승/패 표시
    const enriched = matches.map(m => ({
      ...m,
      myResult: m.winnerId === userId ? 'win' : 'lose',
    }))

    return { matches: enriched }
  })

  // 덱 승률
  app.get<{ Params: { deckId: string } }>('/decks/:deckId/stats', async (req, reply) => {
    const stats = await prisma.deckStats.findUnique({
      where: { deckId: req.params.deckId },
      include: { deck: { select: { name: true, userId: true } } },
    })
    if (!stats) return { totalGames: 0, wins: 0, losses: 0, winRate: null }

    return {
      ...stats,
      winRate: stats.totalGames > 0
        ? Math.round((stats.wins / stats.totalGames) * 1000) / 10
        : null,
    }
  })

  // 전체 덱 승률 랭킹 (5판 이상, 상위 20개)
  app.get('/decks/rankings', async () => {
    const stats = await prisma.deckStats.findMany({
      where: { totalGames: { gte: 5 } },
      include: {
        deck: {
          select: {
            name: true,
            dice: { orderBy: { order: 'asc' } },
            user: { select: { nickname: true } },
          },
        },
      },
      orderBy: [{ wins: 'desc' }, { totalGames: 'desc' }],
      take: 20,
    })

    const liveRankings = stats.map((s) => ({
      deckId: s.deckId,
      deckName: s.deck.name,
      ownerNickname: s.deck.user.nickname,
      dice: s.deck.dice,
      totalGames: s.totalGames,
      wins: s.wins,
      losses: s.losses,
      winRate: Math.round((s.wins / s.totalGames) * 1000) / 10,
    }))

    const tempRankings = getTempDeckRankings().filter(
      temp => !liveRankings.some(live => live.deckId === temp.deckId),
    )

    return [...liveRankings, ...tempRankings]
      .slice(0, 20)
      .map((entry, rank) => ({
        rank: rank + 1,
        ...entry,
      }))
  })

  // AI 대전 결과 기록 (로컬 시뮬레이터용)
  app.post<{
    Body: { deckId: string; result: 'win' | 'lose' }
  }>('/ai-match', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const { deckId, result } = req.body

    if (!deckId || !result) {
      return reply.status(400).send({ error: 'deckId와 result가 필요합니다' })
    }

    // 내 덱인지 확인 (없으면 유저 통계만 기록)
    const deck = await prisma.deck.findFirst({ where: { id: deckId, userId } })

    const isWin = result === 'win'

    await prisma.$transaction(async (tx) => {
      // 유저 통계 갱신
      const current = await tx.userStats.findUnique({ where: { userId } })

      if (isWin) {
        const newStreak = (current?.currentStreak ?? 0) + 1
        const shouldUpdateMax = newStreak > (current?.maxStreak ?? 0)
        await tx.userStats.upsert({
          where: { userId },
          update: {
            totalWins: { increment: 1 },
            currentStreak: newStreak,
            ...(shouldUpdateMax ? { maxStreak: newStreak } : {}),
          },
          create: { userId, totalWins: 1, currentStreak: 1, maxStreak: 1 },
        })
      } else {
        await tx.userStats.upsert({
          where: { userId },
          update: { totalLosses: { increment: 1 }, currentStreak: 0 },
          create: { userId, totalLosses: 1, currentStreak: 0, maxStreak: 0 },
        })
      }

      // 덱 통계 갱신 (서버에 저장된 덱일 때만)
      if (deck) {
        await tx.deckStats.upsert({
          where: { deckId },
          update: {
            totalGames: { increment: 1 },
            ...(isWin ? { wins: { increment: 1 } } : { losses: { increment: 1 } }),
          },
          create: {
            deckId,
            totalGames: 1,
            wins: isWin ? 1 : 0,
            losses: isWin ? 0 : 1,
          },
        })
      }
    })

    return { ok: true }
  })
}
