import fp from 'fastify-plugin'
import oauth2 from '@fastify/oauth2'
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { redis } from './redis.js'

export default fp(async (app: FastifyInstance) => {
  app.register(oauth2, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID!,
        secret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      auth: (oauth2 as any).GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: process.env.GOOGLE_CALLBACK_URI ?? 'http://localhost:3001/auth/google/callback',
    // iOS Safari ITP가 쿠키 기반 state를 차단하므로 Redis에 직접 저장
    generateStateFunction: (async (_req: unknown, _reply: unknown) => {
      const state = crypto.randomBytes(16).toString('hex')
      await redis.set(`oauth:state:${state}`, '1', 'EX', 600) // 10분 TTL
      return state
    }) as unknown as () => string,
    checkStateFunction: (async (req: unknown, callback: (err?: Error) => void) => {
      const state = (req as any).query?.state as string | undefined
      if (!state) { callback(new Error('Missing state')); return }
      const exists = await redis.get(`oauth:state:${state}`)
      if (exists) {
        await redis.del(`oauth:state:${state}`)
        callback()
      } else {
        callback(new Error('Invalid or expired state'))
      }
    }) as unknown as (returnedState: string, callback: (err?: Error) => void) => void,
  })
})
