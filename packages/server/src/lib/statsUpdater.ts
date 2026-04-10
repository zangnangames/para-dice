import { prisma } from '../plugins/db.js'

export async function updateStatsOnMatchEnd(opts: {
  matchId: string
  winnerUserId: string
  loserUserId: string
  winnerDeckId: string
  loserDeckId: string
  rounds: Array<{ number: number; winnerId: string; rolls: unknown }>
}) {
  const { matchId, winnerUserId, loserUserId, winnerDeckId, loserDeckId, rounds } = opts

  await prisma.$transaction(async (tx) => {
    // Match 완료 처리
    await tx.match.update({
      where: { id: matchId },
      data: { state: 'FINISHED', winnerId: winnerUserId, finishedAt: new Date() },
    })

    // 라운드 기록 저장
    await tx.round.createMany({
      data: rounds.map(r => ({
        matchId,
        number: r.number,
        winnerId: r.winnerId,
        rolls: r.rolls as any,
      })),
    })

    // 승자 유저 통계 갱신
    const winnerStats = await tx.userStats.upsert({
      where: { userId: winnerUserId },
      update: {
        totalWins: { increment: 1 },
        currentStreak: { increment: 1 },
      },
      create: {
        userId: winnerUserId,
        totalWins: 1,
        currentStreak: 1,
        maxStreak: 1,
      },
    })

    // maxStreak 갱신
    if (winnerStats.currentStreak > winnerStats.maxStreak) {
      await tx.userStats.update({
        where: { userId: winnerUserId },
        data: { maxStreak: winnerStats.currentStreak },
      })
    }

    // 패자 유저 통계 갱신 (연승 초기화)
    await tx.userStats.upsert({
      where: { userId: loserUserId },
      update: {
        totalLosses: { increment: 1 },
        currentStreak: 0,
      },
      create: {
        userId: loserUserId,
        totalLosses: 1,
        currentStreak: 0,
        maxStreak: 0,
      },
    })

    // 승자 덱 통계
    await tx.deckStats.upsert({
      where: { deckId: winnerDeckId },
      update: { totalGames: { increment: 1 }, wins: { increment: 1 } },
      create: { deckId: winnerDeckId, totalGames: 1, wins: 1, losses: 0 },
    })

    // 패자 덱 통계
    await tx.deckStats.upsert({
      where: { deckId: loserDeckId },
      update: { totalGames: { increment: 1 }, losses: { increment: 1 } },
      create: { deckId: loserDeckId, totalGames: 1, wins: 0, losses: 1 },
    })
  })
}
