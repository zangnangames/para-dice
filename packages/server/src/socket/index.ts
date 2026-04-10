import type { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { redis } from '../plugins/redis.js'
import { registerMatchRoom } from './matchRoom.js'
import { registerMatchmaking } from './matchmaking.js'

const activeSocketKey = (userId: string) => `user:active:${userId}`

export function registerSocketHandlers(io: Server) {
  // ── JWT 인증 미들웨어 ─────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('인증 토큰 없음'))
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      socket.data.userId = payload.userId
      next()
    } catch {
      next(new Error('유효하지 않은 토큰'))
    }
  })

  io.on('connection', async (socket) => {
    const userId: string = socket.data.userId

    // ── 중복 접속 처리 ──────────────────────────────────────
    try {
      const existingSocketId = await redis.get(activeSocketKey(userId))

      if (existingSocketId && existingSocketId !== socket.id) {
        // 기존 소켓에 kicked 이벤트 전송 후 강제 종료
        const existingSocket = io.sockets.sockets.get(existingSocketId)
        if (existingSocket) {
          existingSocket.emit('kicked', { reason: '다른 기기에서 접속하여 연결이 종료되었습니다.' })
          existingSocket.disconnect(true)
        }
        console.log(`[Socket] 중복 접속 강제 종료: userId=${userId} old=${existingSocketId} new=${socket.id}`)
      }

      // 새 소켓 등록 (TTL 24시간)
      await redis.set(activeSocketKey(userId), socket.id, 'EX', 86400)
    } catch (err) {
      console.error('[Socket] 중복 접속 처리 오류:', err)
    }

    // ── 이벤트 핸들러 등록 ──────────────────────────────────
    registerMatchmaking(io, socket, userId)
    registerMatchRoom(io, socket, userId)

    // ── 연결 종료 시 정리 ────────────────────────────────────
    socket.on('disconnect', async () => {
      try {
        // 현재 소켓이 등록된 소켓과 같을 때만 삭제 (새 탭이 이미 덮어썼으면 삭제 안 함)
        const current = await redis.get(activeSocketKey(userId))
        if (current === socket.id) {
          await redis.del(activeSocketKey(userId))
        }
      } catch (err) {
        console.error('[Socket] disconnect 정리 오류:', err)
      }
    })
  })
}
