import Fastify from 'fastify'
import cors from '@fastify/cors'
import fjwt from '@fastify/jwt'
import { Server } from 'socket.io'
import authPlugin from './plugins/auth.js'
import oauthPlugin from './plugins/oauth.js'
import { authRoutes } from './routes/auth.js'
import { deckRoutes } from './routes/decks.js'
import { statsRoutes } from './routes/stats.js'
import { registerSocketHandlers } from './socket/index.js'

const app = Fastify({ logger: true })

const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'

await app.register(cors, { origin: clientUrl, credentials: true })
await app.register(fjwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production' })
await app.register(authPlugin)
await app.register(oauthPlugin)

app.register(authRoutes, { prefix: '/auth' })
app.register(deckRoutes, { prefix: '/decks' })
app.register(statsRoutes, { prefix: '/stats' })

app.get('/health', () => ({ ok: true }))

const io = new Server(app.server, {
  cors: { origin: clientUrl, credentials: true },
})

registerSocketHandlers(io)

await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
