import type { Die } from '@dice-game/core'

interface RoundIntroProps {
  round: number
  myDie: Die
  oppDie: Die
  myName?: string
  oppName?: string
  onStart: () => void
}

function DieFaceChips({ die, highlight }: { die: Die; highlight?: boolean }) {
  const sorted = [...die.faces].sort((a, b) => b - a)
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
      {sorted.map((face, i) => (
        <div key={i} style={{
          width: 36, height: 36, borderRadius: 9,
          background: highlight ? '#eff6ff' : '#fafafa',
          border: `1.5px solid ${highlight ? 'rgba(59,130,246,0.3)' : 'rgba(148,163,184,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800,
          color: highlight ? '#1d4ed8' : '#374151',
        }}>
          {face}
        </div>
      ))}
    </div>
  )
}

function DieCard({
  die, label, highlight,
}: {
  die: Die
  label: string
  highlight?: boolean
}) {
  return (
    <div style={{
      flex: 1,
      padding: '16px 14px',
      borderRadius: 18,
      background: highlight ? 'rgba(239,246,255,0.9)' : 'rgba(255,247,237,0.9)',
      border: `1.5px solid ${highlight ? 'rgba(59,130,246,0.25)' : 'rgba(249,115,22,0.2)'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      {/* 라벨 */}
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
        color: highlight ? '#1d4ed8' : '#c2410c',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>

      {/* 면 칩 */}
      <DieFaceChips die={die} highlight={highlight} />

      {/* 합계 뱃지 */}
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: highlight ? '#60a5fa' : '#fb923c',
        background: highlight ? 'rgba(219,234,254,0.6)' : 'rgba(254,215,170,0.6)',
        padding: '2px 10px', borderRadius: 99,
      }}>
        합계 {die.faces.reduce((s, v) => s + v, 0)}
      </div>
    </div>
  )
}

export function RoundIntro({ round, myDie, oppDie, myName = '나', oppName = '상대', onStart }: RoundIntroProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
      padding: '24px 20px',
      gap: 0,
      fontFamily: 'system-ui, sans-serif',
      animation: 'introFadeIn 0.3s ease',
    }}>

      {/* 라운드 배지 */}
      <div style={{
        fontSize: 12, fontWeight: 800, letterSpacing: '0.12em',
        color: '#94a3b8', marginBottom: 8,
        textTransform: 'uppercase',
      }}>
        Round {round}
      </div>

      {/* 타이틀 */}
      <div style={{
        fontSize: 28, fontWeight: 900, color: '#f8fafc',
        marginBottom: 28, letterSpacing: '-0.02em',
        animation: 'introPop 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        이번 라운드 주사위
      </div>

      {/* 주사위 카드 행 */}
      <div style={{
        display: 'flex', gap: 12, width: '100%', maxWidth: 380,
        marginBottom: 24,
        animation: 'introSlideUp 0.35s 0.15s ease both',
      }}>
        <DieCard die={myDie} label={myName} highlight />

        {/* VS */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: 13, fontWeight: 900, color: '#475569',
          padding: '0 2px',
        }}>
          VS
        </div>

        <DieCard die={oppDie} label={oppName} />
      </div>

      {/* 굴리기 버튼 */}
      <div style={{
        width: '100%', maxWidth: 380,
        animation: 'introSlideUp 0.35s 0.25s ease both',
      }}>
        <button
          onClick={onStart}
          style={{
            width: '100%', padding: '16px 0',
            fontSize: 17, fontWeight: 800,
            borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: '#fff', fontFamily: 'inherit',
            letterSpacing: '-0.01em',
            boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            transition: 'transform 0.12s, box-shadow 0.12s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.97)')}
          onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🎲 주사위 굴리기!
        </button>
      </div>

      <style>{`
        @keyframes introFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes introPop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes introSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
