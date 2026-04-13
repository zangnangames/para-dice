import * as Sentry from '@sentry/node'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import fjwt from '@fastify/jwt'
import { Server } from 'socket.io'
import authPlugin from './plugins/auth.js'
import oauthPlugin from './plugins/oauth.js'
import rateLimitPlugin from './plugins/rateLimit.js'
import { authRoutes } from './routes/auth.js'
import { deckRoutes } from './routes/decks.js'
import { statsRoutes } from './routes/stats.js'
import { registerSocketHandlers } from './socket/index.js'

// Sentry — DSN 없으면 초기화 스킵 (로컬 개발 시 영향 없음)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.2,
  })
}

const app = Fastify({ logger: true, trustProxy: true })

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

await app.register(cors, { origin: clientUrl, credentials: true })
await app.register(cookie)  // OAuth state 쿠키 저장에 필요 — oauthPlugin 보다 먼저 등록
await app.register(fjwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production' })
await app.register(rateLimitPlugin)
await app.register(authPlugin)
await app.register(oauthPlugin)

app.register(authRoutes, { prefix: '/auth' })
app.register(deckRoutes, { prefix: '/decks' })
app.register(statsRoutes, { prefix: '/stats' })

// health check — rate limit 제외
app.get('/health', { config: { rateLimit: false } }, () => ({ ok: true }))

// 처리되지 않은 에러를 Sentry로 전송
app.setErrorHandler((err, _req, reply) => {
  if (process.env.SENTRY_DSN) Sentry.captureException(err)
  app.log.error(err)
  reply.status(err.statusCode ?? 500).send({
    error: err.message ?? 'Internal Server Error',
  })
})

const io = new Server(app.server, {
  cors: { origin: clientUrl, credentials: true },
})

registerSocketHandlers(io)

await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
