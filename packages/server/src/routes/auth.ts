import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../plugins/db.js'

interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture: string
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Google OAuth 콜백
  app.get('/google/callback', async (req, reply) => {
    try {
      const tokenRes = await (app as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req)
      const accessToken = tokenRes.token.access_token

      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Failed to fetch Google user info')
      const googleUser = await res.json() as GoogleUserInfo

      // 신규/기존 유저 upsert
      const user = await prisma.user.upsert({
        where: { googleId: googleUser.id },
        update: {
          email: googleUser.email,
          avatarUrl: googleUser.picture,
        },
        create: {
          googleId: googleUser.id,
          email: googleUser.email,
          nickname: googleUser.name,
          avatarUrl: googleUser.picture,
          stats: { create: {} },
        },
      })

      const token = app.jwt.sign({ userId: user.id }, { expiresIn: '7d' })
      const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
      return reply.redirect(`${clientUrl}/auth/callback?token=${token}`)
    } catch (err) {
      app.log.error(err as Error)
      return reply.status(500).send({ error: 'OAuth failed' })
    }
  })

  // 현재 유저 정보
  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const { userId } = req.user as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, email: true, avatarUrl: true, createdAt: true },
    })
    if (!user) return { error: 'User not found' }
    return user
  })

  // 닉네임 수정
  app.patch<{ Body: { nickname: string } }>(
    '/me',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { userId } = req.user as { userId: string }
      const { nickname } = req.body

      if (!nickname || nickname.trim().length < 1) {
        return reply.status(400).send({ error: '닉네임을 입력해주세요' })
      }
      if (nickname.trim().length > 20) {
        return reply.status(400).send({ error: '닉네임은 20자 이하여야 합니다' })
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { nickname: nickname.trim() },
        select: { id: true, nickname: true },
      })
      return updated
    }
  )
}
