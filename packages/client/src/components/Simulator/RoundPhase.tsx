import { useState, useEffect } from 'react'
import type { Die, RollResult } from '@dice-game/core'
import { PhysicsDice } from './PhysicsDice'

interface RoundPhaseProps {
  myDie: Die
  oppDie: Die
  roundWinners: Array<'me' | 'opp'>
  onRoundEnd: (rolls: RollResult[], winner: 'me' | 'opp') => void
}

// 결과 수신 후 화면 플래시 색상
type FlashType = 'win' | 'lose' | 'draw' | null

export function RoundPhase({ myDie, oppDie, roundWinners, onRoundEnd }: RoundPhaseProps) {
  const [rolls, setRolls] = useState<RollResult[]>([])
  const [winner, setWinner] = useState<'me' | 'opp' | null>(null)
  const [isDraw, setIsDraw] = useState(false)
  const [rollAttempt, setRollAttempt] = useState(0)
  const [myFaceValue, setMyFaceValue] = useState<number | null>(null)
  const [oppFaceValue, setOppFaceValue] = useState<number | null>(null)
  const [flash, setFlash] = useState<FlashType>(null)
  const [resultVisible, setResultVisible] = useState(false)
  const totalRounds = 3

  const triggerFlash = (type: FlashType) => {
    setFlash(type)
    setTimeout(() => setFlash(null), 600)
  }

  const handlePhysicsResult = (myVal: number, oppVal: number) => {
    setMyFaceValue(myVal)
    setOppFaceValue(oppVal)

    const rollResult: RollResult = {
      myRoll: myVal,
      oppRoll: oppVal,
      result: myVal > oppVal ? 'win' : myVal < oppVal ? 'lose' : 'draw',
    }

    const next = [...rolls, rollResult]
    setRolls(next)

    if (rollResult.result === 'draw') {
      triggerFlash('draw')
      setIsDraw(true)
    } else {
      const w = rollResult.result === 'win' ? 'me' : 'opp'
      triggerFlash(w === 'me' ? 'win' : 'lose')
      setWinner(w)
    }

    // 결과 패널 슬라이드인 딜레이
    setTimeout(() => setResultVisible(true), 150)
  }

  const handleReroll = () => {
    setIsDraw(false)
    setMyFaceValue(null)
    setOppFaceValue(null)
    setResultVisible(false)
    setRollAttempt(a => a + 1)
  }

  // 라운드 리셋 시 resultVisible 초기화
  useEffect(() => { setResultVisible(false) }, [rollAttempt])

  const flashColors: Record<NonNullable<FlashType>, string> = {
    win:  'rgba(34,197,94,0.25)',
    lose: 'rgba(239,68,68,0.22)',
    draw: 'rgba(234,179,8,0.22)',
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      {/* 물리 주사위 캔버스 */}
      <PhysicsDice key={rollAttempt} myDie={myDie} oppDie={oppDie} onResult={handlePhysicsResult} />

      {/* 결과 플래시 오버레이 */}
      {flash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 5,
          background: flashColors[flash],
          pointerEvents: 'none',
          animation: 'flashFade 0.6s ease-out forwards',
        }} />
      )}

      {/* 상단 스코어 */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 20px',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>나</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Array.from({ length: totalRounds }, (_, index) => {
            const slotWinner = roundWinners[index]
            const filledByMe = slotWinner === 'me'
            const filledByOpp = slotWinner === 'opp'
            const crown = filledByMe ? '♔' : filledByOpp ? '♚' : ''
            const color = filledByMe ? '#2563eb' : filledByOpp ? '#ea580c' : '#cbd5e1'
            return (
              <div key={index} style={{
                width: 28, height: 28, borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.35)',
                background: filledByMe ? 'rgba(219,234,254,0.95)' : filledByOpp ? 'rgba(255,237,213,0.95)' : 'rgba(248,250,252,0.95)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color,
                transition: 'background 0.3s',
              }}>{crown}</div>
            )
          })}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#c2410c' }}>상대</span>
      </div>

      {/* 상대 주사위 정보 바 */}
      <div style={{
        position: 'fixed', top: 45, left: 0, right: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '5px 16px',
        background: 'rgba(255,247,237,0.88)', backdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(249,115,22,0.12)',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', letterSpacing: '0.04em', marginRight: 2 }}>상대</span>
        {[...oppDie.faces].sort((a, b) => b - a).map((face, index) => (
          <div key={`${oppDie.id}-${index}`} style={{
            width: 24, height: 24, borderRadius: 6,
            background: oppFaceValue === face ? '#fb923c' : '#fff7ed',
            border: `1px solid ${oppFaceValue === face ? '#ea580c' : 'rgba(148,163,184,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            color: oppFaceValue === face ? '#fff' : '#9a3412',
            transition: 'background 0.2s',
          }}>{face}</div>
        ))}
        {oppFaceValue !== null && (
          <span style={{
            marginLeft: 4, fontSize: 11, fontWeight: 700,
            color: winner === 'me' ? '#15803d' : winner === 'opp' ? '#b91c1c' : isDraw ? '#b45309' : '#94a3b8',
          }}>
            {winner === 'me' ? '패' : winner === 'opp' ? '승' : isDraw ? '동점' : ''}
          </span>
        )}
      </div>

      {/* 내 주사위 정보 바 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '5px 16px',
        background: 'rgba(239,246,255,0.88)', backdropFilter: 'blur(6px)',
        borderTop: '1px solid rgba(59,130,246,0.12)',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', letterSpacing: '0.04em', marginRight: 2 }}>나</span>
        {[...myDie.faces].sort((a, b) => b - a).map((face, index) => (
          <div key={`${myDie.id}-${index}`} style={{
            width: 24, height: 24, borderRadius: 6,
            background: myFaceValue === face ? '#3b82f6' : '#eff6ff',
            border: `1px solid ${myFaceValue === face ? '#2563eb' : 'rgba(148,163,184,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            color: myFaceValue === face ? '#fff' : '#1e3a8a',
            transition: 'background 0.2s',
          }}>{face}</div>
        ))}
        {myFaceValue !== null && (
          <span style={{
            marginLeft: 4, fontSize: 11, fontWeight: 700,
            color: winner === 'me' ? '#15803d' : winner === 'opp' ? '#b91c1c' : isDraw ? '#b45309' : '#94a3b8',
          }}>
            {winner === 'me' ? '승' : winner === 'opp' ? '패' : isDraw ? '동점' : ''}
          </span>
        )}
      </div>

      {/* 동점 오버레이 */}
      {isDraw && resultVisible && (
        <div style={{
          position: 'fixed', bottom: 34, left: 0, right: 0, zIndex: 4,
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)',
          borderTop: '2px solid #fbbf24',
          padding: '16px 16px 20px',
          maxWidth: 480, margin: '0 auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>⚖️ 동점!</span>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', padding: '8px 16px', borderRadius: 10,
            background: '#fef9c3',
          }}>
            <span style={{ fontWeight: 700, fontSize: 22, color: '#1d4ed8' }}>
              {rolls[rolls.length - 1]?.myRoll}
            </span>
            <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>동점 — 같은 주사위로 재대결</span>
            <span style={{ fontWeight: 700, fontSize: 22, color: '#c2410c' }}>
              {rolls[rolls.length - 1]?.oppRoll}
            </span>
          </div>
          <button
            onClick={handleReroll}
            style={{
              width: '100%', padding: '12px 0', fontSize: 16, fontWeight: 700,
              borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: '#f59e0b', color: '#fff',
            }}
          >다시 던지기 →</button>
        </div>
      )}

      {/* 최종 결과 패널 */}
      {winner && resultVisible && (
        <div style={{
          position: 'fixed', bottom: 34, left: 0, right: 0, zIndex: 4,
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)',
          borderTop: `2px solid ${winner === 'me' ? '#16a34a' : '#dc2626'}`,
          padding: '12px 16px',
          maxWidth: 480, margin: '0 auto',
          animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* 승패 헤더 */}
          <div style={{
            textAlign: 'center', fontSize: 16, fontWeight: 800,
            color: winner === 'me' ? '#16a34a' : '#dc2626',
            marginBottom: 10,
          }}>
            {winner === 'me' ? '🏆 이 라운드 승리!' : '💀 이 라운드 패배'}
          </div>

          {rolls.map((roll, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', marginBottom: 6, borderRadius: 8,
              background: roll.result === 'draw' ? '#fef9c3' : roll.result === 'win' ? '#dcfce7' : '#fee2e2',
              animation: `slideUp 0.2s ease ${i * 0.05}s both`,
            }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{roll.myRoll}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {roll.result === 'draw' ? '동점 재대결' : roll.result === 'win' ? '승리' : '패배'}
              </span>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{roll.oppRoll}</span>
            </div>
          ))}
          <button
            onClick={() => onRoundEnd(rolls, winner)}
            style={{
              width: '100%', padding: '13px 0', fontSize: 16, fontWeight: 700,
              borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: winner === 'me' ? '#16a34a' : '#dc2626', color: '#fff',
              marginTop: 4,
            }}
          >
            {winner === 'me' ? '이겼습니다! 다음 →' : '졌습니다. 다음 →'}
          </button>
        </div>
      )}

      <style>{`
        @keyframes flashFade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
