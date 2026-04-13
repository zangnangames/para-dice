import fp from 'fastify-plugin'
import oauth2 from '@fastify/oauth2'
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'

// iOS Safari ITP 대응:
// 쿠키 대신 HMAC 서명 기반 무상태 state 사용.
// state = "<nonce>.<hmac-signature>"  형태로 발급하고,
// 콜백 시 서명 검증만으로 유효성 확인 → Redis·쿠키 불필요.

function sign(nonce: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(nonce).digest('hex')
}

export default fp(async (app: FastifyInstance) => {
  const secret = process.env.JWT_SECRET ?? 'fallback-secret'

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
    // v7: generateStateFunction(request) → string  /  checkStateFunction(request, callback)
    generateStateFunction: (_req: unknown) => {
      const nonce = crypto.randomBytes(16).toString('hex')
      return `${nonce}.${sign(nonce, secret)}`
    },
    checkStateFunction: (request: unknown, callback: (err?: Error) => void) => {
      const state = (request as any).query?.state as string | undefined
      if (!state) { callback(new Error('Missing state')); return }
      const dot = state.lastIndexOf('.')
      if (dot === -1) { callback(new Error('Invalid state format')); return }
      const nonce = state.slice(0, dot)
      const sig   = state.slice(dot + 1)
      if (sig === sign(nonce, secret)) callback()
      else callback(new Error('Invalid state signature'))
    },
  })
})
