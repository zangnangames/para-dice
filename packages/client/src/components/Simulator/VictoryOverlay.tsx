import { useEffect, useState } from 'react'

interface VictoryOverlayProps {
  winner: 'me' | 'opp'
  onDone: () => void
}

// 파티클 데이터
const COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb923c']
const PARTICLE_COUNT = 36

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a)
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
}

export function VictoryOverlay({ winner, onDone }: VictoryOverlayProps) {
  const [visible, setVisible] = useState(true)
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: randomBetween(10, 90),
      y: randomBetween(-20, 30),
      vx: randomBetween(-3, 3),
      vy: randomBetween(2, 7),
      color: COLORS[i % COLORS.length],
      size: randomBetween(6, 14),
      rotation: randomBetween(0, 360),
      rotationSpeed: randomBetween(-180, 180),
    }))
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 400)
    }, 2800)
    return () => clearTimeout(timer)
  }, [onDone])

  if (!visible) return null

  const isWin = winner === 'me'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isWin
        ? 'radial-gradient(ellipse at center, rgba(21,128,61,0.92) 0%, rgba(15,23,42,0.96) 100%)'
        : 'radial-gradient(ellipse at center, rgba(153,27,27,0.92) 0%, rgba(15,23,42,0.96) 100%)',
      animation: 'victoryIn 0.4s ease',
    }}>
      {/* 파티클 (승리 시만) */}
      {isWin && particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: p.size > 10 ? 2 : '50%',
            background: p.color,
            animation: `confettiFall 2.5s ${randomBetween(0, 0.8)}s ease-in forwards`,
            '--vx': `${p.vx}vw`,
            '--vy': `${p.vy * 20}vh`,
            '--rot': `${p.rotation}deg`,
            '--rotEnd': `${p.rotation + p.rotationSpeed}deg`,
          } as React.CSSProperties}
        />
      ))}

      {/* 중앙 메시지 */}
      <div style={{
        textAlign: 'center',
        animation: 'victoryPop 0.5s 0.1s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <div style={{ fontSize: 72, marginBottom: 8, lineHeight: 1 }}>
          {isWin ? '🏆' : '💀'}
        </div>
        <div style={{
          fontSize: 36, fontWeight: 900, color: '#fff',
          letterSpacing: '-0.02em', marginBottom: 6,
          textShadow: isWin ? '0 0 30px rgba(251,191,36,0.8)' : '0 0 30px rgba(239,68,68,0.6)',
        }}>
          {isWin ? '승리!' : '패배'}
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
          {isWin ? '2선승 달성' : '아쉽지만 다음에...'}
        </div>
      </div>

      <style>{`
        @keyframes victoryIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes victoryPop {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(0) translateX(0) rotate(var(--rot)); opacity: 1; }
          100% { transform: translateY(var(--vy)) translateX(var(--vx)) rotate(var(--rotEnd)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
