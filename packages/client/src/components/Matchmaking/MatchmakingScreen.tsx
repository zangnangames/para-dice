import { useEffect, useState, useRef } from 'react'
import { socket } from '@/lib/socket'

interface MatchmakingScreenProps {
  onMatched: (matchId: string) => void
  onCancel: () => void
}

export function MatchmakingScreen({ onMatched, onCancel }: MatchmakingScreenProps) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'matched' | 'error'>('connecting')
  const [elapsed, setElapsed] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!socket.connected) socket.connect()

    socket.emit('queue:join')
    setStatus('connecting')

    socket.on('queue:joined', () => {
      setStatus('waiting')
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    })

    socket.on('queue:matched', ({ matchId }: { matchId: string }) => {
      setStatus('matched')
      if (timerRef.current) clearInterval(timerRef.current)
      // 잠깐 "매칭 성사!" 보여주고 이동
      setTimeout(() => onMatched(matchId), 1200)
    })

    socket.on('queue:error', ({ message }: { message: string }) => {
      setStatus('error')
      setErrorMsg(message)
      if (timerRef.current) clearInterval(timerRef.current)
    })

    return () => {
      socket.emit('queue:leave')
      socket.off('queue:joined')
      socket.off('queue:matched')
      socket.off('queue:error')
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleCancel = () => {
    socket.emit('queue:leave')
    onCancel()
  }

  // #5 fix: 오류 발생 시 재시도
  const handleRetry = () => {
    setErrorMsg('')
    setElapsed(0)
    setStatus('connecting')
    socket.emit('queue:join')
    socket.once('queue:joined', () => {
      setStatus('waiting')
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    })
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #eff6ff 0%, #f8fafc 60%, #faf5ff 100%)',
      padding: 32, gap: 32,
    }}>

      {/* 아이콘 애니메이션 */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        {/* 파동 링 */}
        {status === 'waiting' && [0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            border: '2px solid #3b82f6',
            opacity: 0,
            animation: `ping 2s ease-out ${i * 0.6}s infinite`,
          }} />
        ))}
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: status === 'matched'
            ? 'linear-gradient(135deg, #16a34a, #4ade80)'
            : status === 'error'
            ? 'linear-gradient(135deg, #dc2626, #f87171)'
            : 'linear-gradient(135deg, #2563eb, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 52,
          boxShadow: status === 'matched'
            ? '0 8px 32px rgba(22,163,74,0.4)'
            : '0 8px 32px rgba(37,99,235,0.3)',
          transition: 'background 0.4s, box-shadow 0.4s',
        }}>
          {status === 'matched' ? '⚡' : status === 'error' ? '⚠️' : '🎲'}
        </div>
      </div>

      {/* 텍스트 */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
          {status === 'connecting' && '연결 중...'}
          {status === 'waiting' && '상대를 찾는 중'}
          {status === 'matched' && '매칭 성사! ⚡'}
          {status === 'error' && '매칭 실패'}
        </div>

        {status === 'waiting' && (
          <div style={{ fontSize: 28, fontWeight: 900, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(elapsed)}
          </div>
        )}

        {status === 'waiting' && (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            실력이 비슷한 상대를 탐색하고 있습니다
          </div>
        )}

        {status === 'matched' && (
          <div style={{ fontSize: 14, color: '#16a34a', fontWeight: 600 }}>
            게임을 준비하고 있습니다...
          </div>
        )}

        {status === 'error' && (
          <div style={{ fontSize: 14, color: '#ef4444' }}>{errorMsg}</div>
        )}
      </div>

      {/* 취소 / 재시도 버튼 */}
      {(status === 'waiting' || status === 'connecting') && (
        <button
          onClick={handleCancel}
          style={{
            padding: '12px 32px', borderRadius: 12,
            border: '1.5px solid #e2e8f0', background: '#fff',
            fontSize: 14, fontWeight: 600, color: '#64748b',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >취소</button>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', gap: 10 }}>
          {/* #5 fix: 오류 시 재시도 버튼 추가 */}
          <button
            onClick={handleRetry}
            style={{
              padding: '12px 24px', borderRadius: 12,
              border: 'none', background: '#2563eb',
              fontSize: 14, fontWeight: 700, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >다시 시도</button>
          <button
            onClick={handleCancel}
            style={{
              padding: '12px 24px', borderRadius: 12,
              border: '1.5px solid #e2e8f0', background: '#fff',
              fontSize: 14, fontWeight: 600, color: '#64748b',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >홈으로</button>
        </div>
      )}

      {/* ping 애니메이션 키프레임 */}
      <style>{`
        @keyframes ping {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
