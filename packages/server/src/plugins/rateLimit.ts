import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'

export default fp(async (app: FastifyInstance) => {
  await app.register(rateLimit, {
    global: true,
    max: 100,           // 기본: IP당 1분에 100 요청
    timeWindow: '1m',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, context) => ({
      error: 'Too Many Requests',
      message: `요청이 너무 많습니다. ${Math.ceil(context.ttl / 1000)}초 후 다시 시도해주세요.`,
      retryAfter: context.ttl,
    }),
  })

  // OAuth 엔드포인트 — 더 엄격하게 (IP당 10분에 10회)
  app.register(async (sub) => {
    sub.addHook('onRequest', (req, _reply, done) => {
      ;(req as any).routeConfig = { rateLimit: { max: 10, timeWindow: '10m' } }
      done()
    })
  })
})
