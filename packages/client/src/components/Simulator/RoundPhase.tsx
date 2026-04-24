import { useState } from 'react'
import type { Die, GameMode, RollResult } from '@dice-game/core'
import { PhysicsDice } from './PhysicsDice'

interface RoundPhaseProps {
  mode: GameMode
  myDice: Die[]
  oppDice: Die[]
  roundWinners: Array<'me' | 'opp'>
  onRoundEnd: (rolls: RollResult[], winner: 'me' | 'opp') => void
}

export function RoundPhase({ mode, myDice, oppDice, roundWinners, onRoundEnd }: RoundPhaseProps) {
  const [rolls, setRolls] = useState<RollResult[]>([])
  const [winner, setWinner] = useState<'me' | 'opp' | null>(null)
  const [myFaceValues, setMyFaceValues] = useState<number[]>([])
  const [oppFaceValues, setOppFaceValues] = useState<number[]>([])

  const handlePhysicsResult = (myVals: number[], oppVals: number[]) => {
    const myRoll = myVals.reduce((sum, value) => sum + value, 0)
    const oppRoll = oppVals.reduce((sum, value) => sum + value, 0)
    const rollResult: RollResult = {
      myRolls: myVals,
      oppRolls: oppVals,
      myRoll,
      oppRoll,
      result: myRoll > oppRoll ? 'win' : myRoll < oppRoll ? 'lose' : 'draw',
    }

    setMyFaceValues(myVals)
    setOppFaceValues(oppVals)
    const nextRolls = [...rolls, rollResult]
    setRolls(nextRolls)

    if (rollResult.result === 'draw') {
      window.setTimeout(() => {
        setRolls([])
        setMyFaceValues([])
        setOppFaceValues([])
      }, 900)
      return
    }

    const resolvedWinner = rollResult.result === 'win' ? 'me' : 'opp'
    setWinner(resolvedWinner)
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <PhysicsDice key={`${myDice.map(d => d.id).join('-')}-${rolls.length}`} myDice={myDice} oppDice={oppDice} onResult={handlePhysicsResult} />

      <ScoreBar roundWinners={roundWinners} />
      <DiceInfoBar position="top" label="상대" dice={oppDice} values={oppFaceValues} color="#c2410c" />
      <DiceInfoBar position="bottom" label="나" dice={myDice} values={myFaceValues} color="#1d4ed8" />

      {winner && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          width: 'min(92vw, 420px)', borderRadius: 22, background: 'rgba(255,255,255,0.97)',
          boxShadow: '0 22px 48px rgba(15,23,42,0.18)', padding: '20px 18px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#64748b', marginBottom: 6 }}>
              {mode === 'double-battle' && myDice.length === 2 ? '더블 배틀 피날레' : '라운드 결과'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: winner === 'me' ? '#16a34a' : '#dc2626' }}>
              {winner === 'me' ? '라운드 승리' : '라운드 패배'}
            </div>
          </div>
          {rolls.map((roll, index) => (
            <div key={index} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 14, marginBottom: 10,
              background: roll.result === 'draw' ? '#fef3c7' : roll.result === 'win' ? '#dcfce7' : '#fee2e2',
            }}>
              <RollSummary label="나" values={roll.myRolls} total={roll.myRoll} color="#1d4ed8" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>
                {roll.result === 'draw' ? '동점' : roll.result === 'win' ? '승' : '패'}
              </span>
              <RollSummary label="상대" values={roll.oppRolls} total={roll.oppRoll} color="#c2410c" />
            </div>
          ))}
          <button
            onClick={() => onRoundEnd(rolls, winner)}
            style={{
              width: '100%', padding: '13px 0',
              borderRadius: 12, border: 'none', cursor: 'pointer',
              background: winner === 'me' ? '#16a34a' : '#dc2626',
              color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            다음 라운드
          </button>
        </div>
      )}
    </div>
  )
}

function ScoreBar({ roundWinners }: { roundWinners: Array<'me' | 'opp'> }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 20px',
      background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>나</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {[0, 1, 2].map(i => {
          const w = roundWinners[i]
          return (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.35)',
              background: w === 'me' ? 'rgba(219,234,254,0.95)' : w === 'opp' ? 'rgba(255,237,213,0.95)' : 'rgba(248,250,252,0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: w === 'me' ? '#2563eb' : w === 'opp' ? '#ea580c' : '#cbd5e1',
            }}>
              {w === 'me' ? '♔' : w === 'opp' ? '♚' : ''}
            </div>
          )
        })}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#c2410c' }}>상대</span>
    </div>
  )
}

function DiceInfoBar({
  position,
  label,
  dice,
  values,
  color,
}: {
  position: 'top' | 'bottom'
  label: string
  dice: Die[]
  values: number[]
  color: string
}) {
  const barStyle = position === 'top'
    ? { top: 45, borderBottom: '1px solid rgba(148,163,184,0.14)' }
    : { bottom: 0, borderTop: '1px solid rgba(148,163,184,0.14)' }

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '6px 14px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)',
      ...barStyle,
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color }}>{label}</span>
      {dice.map((die, dieIndex) => (
        <div key={die.id} style={{ display: 'flex', gap: 4 }}>
          {[...die.faces].sort((a, b) => b - a).map((face, index) => (
            <span key={`${die.id}-${index}`} style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 6,
              background: values[dieIndex] === face ? color : '#f8fafc',
              border: '1px solid rgba(148,163,184,0.28)',
              color: values[dieIndex] === face ? '#fff' : '#334155',
              fontSize: 10,
              fontWeight: 700,
            }}>
              {face}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function RollSummary({
  label,
  values,
  total,
  color,
}: {
  label: string
  values: number[]
  total: number
  color: string
}) {
  return (
    <div style={{ minWidth: 110, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
        {values.map((value, index) => (
          <span key={index} style={{
            width: 28, height: 28, borderRadius: 8,
            background: color, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 900,
          }}>
            {value}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>합 {total}</div>
    </div>
  )
}
