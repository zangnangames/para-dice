import fp from 'fastify-plugin'
import oauth2 from '@fastify/oauth2'
import type { FastifyInstance } from 'fastify'

export default fp(async (app: FastifyInstance) => {
  const isProd = process.env.NODE_ENV === 'production'

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
    // 모바일(iOS Safari 포함) OAuth state 쿠키가 리다이렉트 중 사라지지 않도록 설정
    cookie: {
      secure: isProd,
      sameSite: 'lax',
      httpOnly: true,
    },
  })
})
