import { useEffect, useState } from 'react'

interface PlayerInfo {
  nickname: string
  avatarUrl: string | null
  totalWins: number
  totalLosses: number
  currentStreak: number
}

interface MatchIntroScreenProps {
  me: PlayerInfo
  opponent: PlayerInfo
  onDone: () => void
}

export function MatchIntroScreen({ me, opponent, onDone }: MatchIntroScreenProps) {
  // 0: 초기(숨김) → 1: 슬라이드인 → 2: VS 등장 → 3: 페이드아웃
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 80)    // 카드 슬라이드인
    const t2 = setTimeout(() => setStep(2), 700)   // VS 등장
    const t3 = setTimeout(() => setStep(3), 2400)  // 페이드아웃 시작
    const t4 = setTimeout(() => onDone(), 2900)    // 전환
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: step === 3 ? 0 : 1,
      transition: step === 3 ? 'opacity 0.5s ease' : 'none',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* 배경 별빛 파티클 */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {STARS.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.op,
            animation: `twinkle ${s.dur}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative', width: '100%', maxWidth: 480, padding: '0 16px' }}>

        {/* 내 카드 (왼쪽에서 슬라이드인) */}
        <div style={{
          flex: 1,
          transform: step >= 1 ? 'translateX(0)' : 'translateX(-120px)',
          opacity: step >= 1 ? 1 : 0,
          transition: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
        }}>
          <PlayerCard player={me} side="left" label="나" />
        </div>

        {/* VS */}
        <div style={{
          flexShrink: 0,
          width: 64,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transform: step >= 2 ? 'scale(1)' : 'scale(0)',
          opacity: step >= 2 ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        }}>
          <div style={{
            fontSize: 26, fontWeight: 900, color: '#f59e0b',
            textShadow: '0 0 20px rgba(245,158,11,0.8), 0 0 40px rgba(245,158,11,0.4)',
            letterSpacing: 2,
          }}>VS</div>
        </div>

        {/* 상대 카드 (오른쪽에서 슬라이드인) */}
        <div style={{
          flex: 1,
          transform: step >= 1 ? 'translateX(0)' : 'translateX(120px)',
          opacity: step >= 1 ? 1 : 0,
          transition: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease',
        }}>
          <PlayerCard player={opponent} side="right" label="상대" />
        </div>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: var(--op, 0.3); transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}

function PlayerCard({ player, side, label }: { player: PlayerCard_['player']; side: 'left' | 'right'; label: string }) {
  const totalGames = player.totalWins + player.totalLosses
  const winRate = totalGames > 0
    ? Math.round((player.totalWins / totalGames) * 1000) / 10
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: side === 'left' ? 'flex-start' : 'flex-end',
      gap: 10,
      padding: '16px 12px',
    }}>
      {/* 레이블 */}
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
        color: side === 'left' ? '#60a5fa' : '#f87171',
        textTransform: 'uppercase',
      }}>{label}</div>

      {/* 아바타 */}
      <div style={{ position: 'relative' }}>
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt=""
            style={{
              width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
              border: `3px solid ${side === 'left' ? '#3b82f6' : '#ef4444'}`,
              boxShadow: `0 0 20px ${side === 'left' ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.5)'}`,
            }}
          />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: side === 'left' ? 'rgba(59,130,246,0.2)' : 'rgba(239,68,68,0.2)',
            border: `3px solid ${side === 'left' ? '#3b82f6' : '#ef4444'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30,
            boxShadow: `0 0 20px ${side === 'left' ? 'rgba(59,130,246,0.4)' : 'rgba(239,68,68,0.4)'}`,
          }}>👤</div>
        )}
        {/* 연승 뱃지 */}
        {player.currentStreak >= 2 && (
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            background: '#f59e0b', borderRadius: 10,
            padding: '2px 6px', fontSize: 10, fontWeight: 800, color: '#fff',
            border: '2px solid #0f172a',
            whiteSpace: 'nowrap',
          }}>🔥{player.currentStreak}</div>
        )}
      </div>

      {/* 닉네임 */}
      <div style={{
        fontSize: 16, fontWeight: 800, color: '#f1f5f9',
        textAlign: side === 'left' ? 'left' : 'right',
        maxWidth: 130, wordBreak: 'break-all',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}>{player.nickname}</div>

      {/* 전적 */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: side === 'left' ? 'flex-start' : 'flex-end',
        gap: 3,
      }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          <span style={{ color: '#4ade80', fontWeight: 700 }}>{player.totalWins}승</span>
          {' '}
          <span style={{ color: '#f87171', fontWeight: 700 }}>{player.totalLosses}패</span>
        </div>
        {winRate !== null && (
          <div style={{ fontSize: 11, color: '#64748b' }}>승률 {winRate}%</div>
        )}
        {player.currentStreak >= 2 && (
          <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>
            🔥 {player.currentStreak}연승 중
          </div>
        )}
      </div>
    </div>
  )
}

// TypeScript 트릭 — PlayerCard props 타입 접근
type PlayerCard_ = { player: MatchIntroScreenProps['me'] }

// 배경 별 데이터 (정적, 리렌더 방지)
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 37 + 13) % 100,
  y: (i * 53 + 7) % 100,
  size: i % 3 === 0 ? 2 : 1,
  op: 0.15 + (i % 5) * 0.1,
  dur: 2 + (i % 4),
  delay: (i % 6) * 0.5,
}))
