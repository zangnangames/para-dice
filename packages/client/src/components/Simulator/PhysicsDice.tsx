import { useEffect, useMemo, useState } from 'react'
import { rollDie } from '@dice-game/core'
import type { Die } from '@dice-game/core'

const FACE_COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']

interface PhysicsDiceProps {
  myDice: Die[]
  oppDice: Die[]
  onResult: (myVals: number[], oppVals: number[]) => void
}

export function PhysicsDice({ myDice, oppDice, onResult }: PhysicsDiceProps) {
  const [myPreview, setMyPreview] = useState<number[]>(() => myDice.map(() => 1))
  const [oppPreview, setOppPreview] = useState<number[]>(() => oppDice.map(() => 1))
  const [revealed, setRevealed] = useState(false)
  const finalMy = useMemo(() => myDice.map(rollDie), [myDice])
  const finalOpp = useMemo(() => oppDice.map(rollDie), [oppDice])

  useEffect(() => {
    setRevealed(false)
    const previewInterval = setInterval(() => {
      setMyPreview(myDice.map(() => 1 + Math.floor(Math.random() * 6)))
      setOppPreview(oppDice.map(() => 1 + Math.floor(Math.random() * 6)))
    }, 90)

    const revealTimer = setTimeout(() => {
      clearInterval(previewInterval)
      setMyPreview(finalMy)
      setOppPreview(finalOpp)
      setRevealed(true)
    }, 1200)

    const resultTimer = setTimeout(() => {
      onResult(finalMy, finalOpp)
    }, 1750)

    return () => {
      clearInterval(previewInterval)
      clearTimeout(revealTimer)
      clearTimeout(resultTimer)
    }
  }, [finalMy, finalOpp, myDice, onResult, oppDice])

  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 38%, #fff8ef 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '96px 20px 72px',
      gap: 32,
      overflow: 'hidden',
    }}>
      <BattleLane
        label="상대"
        color="#c2410c"
        bg="rgba(255,247,237,0.88)"
        dice={oppDice}
        values={oppPreview}
        revealed={revealed}
      />
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: revealed ? 'rgba(37,99,235,0.12)' : 'rgba(148,163,184,0.12)',
        color: revealed ? '#1d4ed8' : '#64748b',
        fontSize: 20,
        fontWeight: 900,
        letterSpacing: '0.08em',
        transition: 'all 0.2s ease',
      }}>
        VS
      </div>
      <BattleLane
        label="나"
        color="#1d4ed8"
        bg="rgba(239,246,255,0.92)"
        dice={myDice}
        values={myPreview}
        revealed={revealed}
      />
    </div>
  )
}

function BattleLane({
  label,
  color,
  bg,
  dice,
  values,
  revealed,
}: {
  label: string
  color: string
  bg: string
  dice: Die[]
  values: number[]
  revealed: boolean
}) {
  const total = values.reduce((sum, value) => sum + value, 0)

  return (
    <div style={{
      width: 'min(92vw, 420px)',
      padding: '18px 16px 16px',
      borderRadius: 24,
      background: bg,
      border: '1px solid rgba(148,163,184,0.2)',
      boxShadow: '0 12px 34px rgba(15,23,42,0.08)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '0.08em' }}>{label}</span>
        <span style={{
          minWidth: 58,
          textAlign: 'center',
          padding: '6px 12px',
          borderRadius: 999,
          background: revealed ? color : '#cbd5e1',
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          transition: 'background 0.2s ease',
        }}>
          합 {total}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${dice.length}, minmax(0, 1fr))`,
        gap: 12,
      }}>
        {dice.map((die, index) => (
          <AnimatedDieCard
            key={die.id}
            die={die}
            value={values[index] ?? 1}
            revealed={revealed}
            accent={color}
          />
        ))}
      </div>
    </div>
  )
}

function AnimatedDieCard({
  die,
  value,
  revealed,
  accent,
}: {
  die: Die
  value: number
  revealed: boolean
  accent: string
}) {
  return (
    <div style={{
      borderRadius: 18,
      padding: '14px 10px 12px',
      background: '#fff',
      border: `1.5px solid ${revealed ? accent : '#e2e8f0'}`,
      transform: revealed ? 'translateY(0)' : `translateY(${Math.sin(value) * 4}px) rotate(${(value - 3) * 2}deg)`,
      transition: 'transform 0.12s linear, border-color 0.2s ease',
    }}>
      <div style={{
        width: 60,
        height: 60,
        margin: '0 auto 10px',
        borderRadius: 18,
        background: revealed ? accent : '#0f172a',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 30,
        fontWeight: 900,
        boxShadow: revealed ? `0 10px 20px ${accent}33` : '0 10px 20px rgba(15,23,42,0.18)',
        transition: 'background 0.2s ease, box-shadow 0.2s ease',
      }}>
        {value}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {[...die.faces].sort((a, b) => b - a).map((face, index) => (
          <span
            key={`${die.id}-${index}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 22,
              borderRadius: 6,
              background: FACE_COLORS[index],
              border: '1px solid rgba(15,23,42,0.08)',
              fontSize: 10,
              fontWeight: 800,
              color: '#1e293b',
            }}
          >
            {face}
          </span>
        ))}
      </div>
    </div>
  )
}
