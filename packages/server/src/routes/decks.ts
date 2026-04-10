import type { FastifyPluginAsync } from 'fastify'
import { validateDeck } from '@dice-game/core'
import { prisma } from '../plugins/db.js'

export const deckRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate)

  // 내 덱 목록 (승률 포함)
  app.get('/', async (req) => {
    const { userId } = req.user as { userId: string }
    const decks = await prisma.deck.findMany({
      where: { userId },
      include: {
        dice: { orderBy: { order: 'asc' } },
        stats: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return decks.map(deck => ({
      ...deck,
      stats: deck.stats
        ? {
            ...deck.stats,
            winRate: deck.stats.totalGames > 0
              ? Math.round((deck.stats.wins / deck.stats.totalGames) * 1000) / 10
              : null,
          }
        : null,
    }))
  })

  // 덱 저장
  app.post<{
    Body: { name: string; dice: Array<{ faces: number[] }> }
  }>('/', async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const { name, dice } = req.body

    if (!name || !dice || dice.length !== 4) {
      return reply.status(400).send({ error: '덱 이름과 주사위 4개가 필요합니다' })
    }

    const deckForValidation = {
      id: 'tmp',
      name,
      dice: dice.map((d, i) => ({ id: String(i), faces: d.faces as [number,number,number,number,number,number] })) as [any,any,any,any],
    }
    const result = validateDeck(deckForValidation)
    if (!result.valid) return reply.status(400).send({ error: result.reason })

    return prisma.deck.create({
      data: {
        name,
        userId,
        dice: { create: dice.map((d, order) => ({ faces: d.faces, order })) },
        stats: { create: {} },
      },
      include: { dice: true, stats: true },
    })
  })

  // 덱 업데이트
  app.put<{
    Params: { id: string }
    Body: { name: string; dice: Array<{ faces: number[] }> }
  }>('/:id', async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const { name, dice } = req.body

    const existing = await prisma.deck.findFirst({ where: { id: req.params.id, userId } })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    if (!name || !dice || dice.length !== 4) {
      return reply.status(400).send({ error: '덱 이름과 주사위 4개가 필요합니다' })
    }

    const deckForValidation = {
      id: existing.id,
      name,
      dice: dice.map((d, i) => ({ id: String(i), faces: d.faces as [number,number,number,number,number,number] })) as [any,any,any,any],
    }
    const result = validateDeck(deckForValidation)
    if (!result.valid) return reply.status(400).send({ error: result.reason })

    // 기존 주사위 삭제 후 재생성
    await prisma.$transaction(async (tx) => {
      await tx.die.deleteMany({ where: { deckId: existing.id } })
      await tx.deck.update({
        where: { id: existing.id },
        data: {
          name,
          dice: { create: dice.map((d, order) => ({ faces: d.faces, order })) },
        },
      })
    })

    return prisma.deck.findUnique({
      where: { id: existing.id },
      include: { dice: { orderBy: { order: 'asc' } }, stats: true },
    })
  })

  // 덱 삭제
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const deck = await prisma.deck.findFirst({
      where: { id: req.params.id, userId },
    })
    if (!deck) return reply.status(404).send({ error: 'Not found' })
    await prisma.deck.delete({ where: { id: deck.id } })
    return { ok: true }
  })
}
