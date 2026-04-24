import { useState, useEffect, useRef } from 'react'
import { getRoundSlotSizes } from '@dice-game/core'
import type { Die, GameMode } from '@dice-game/core'

const COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']
const CUBE_TRANSFORMS = [
  `rotateX(90deg) translateZ(22px)`,
  `rotateY(-90deg) translateZ(22px)`,
  `translateZ(22px)`,
  `rotateY(90deg) translateZ(22px)`,
  `rotateY(180deg) translateZ(22px)`,
  `rotateX(-90deg) translateZ(22px)`,
]

const TOTAL_SEC = 40

interface OnlineDraftPhaseProps {
  mode: GameMode
  myDice: Die[]
  opponentDice: Die[]
  opponentNickname: string
  opponentReady: boolean   // 상대가 이미 준비 완료했는지
  initialSelectedIds?: string[][] | null
  onConfirm: (rounds: string[][]) => void
  onTimeout: () => void
}

export function OnlineDraftPhase({
  mode, myDice, opponentDice, opponentNickname, opponentReady, initialSelectedIds, onConfirm, onTimeout,
}: OnlineDraftPhaseProps) {
  const slotSizes = getRoundSlotSizes(mode)
  const totalPickCount = slotSizes.reduce((sum, size) => sum + size, 0)
  const [selected, setSelected] = useState<string[]>(() => initialSelectedIds ? initialSelectedIds.flat() : [])
  const [timeLeft, setTimeLeft] = useState(TOTAL_SEC)
  const [timedOut, setTimedOut] = useState(false)
  const [confirmed, setConfirmed] = useState(() => !!initialSelectedIds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 타이머
  useEffect(() => {
    if (initialSelectedIds) return
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current!)
          setTimedOut(true)
          onTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [initialSelectedIds])

  const toggle = (id: string) => {
    if (confirmed || timedOut) return
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id)
        : prev.length < totalPickCount ? [...prev, id] : prev
    )
  }

  const handleConfirm = () => {
    if (selected.length !== totalPickCount || confirmed) return
    clearInterval(intervalRef.current!)
    setConfirmed(true)
    onConfirm(slotSizes.reduce<string[][]>((acc, size) => {
      const used = acc.flat().length
      acc.push(selected.slice(used, used + size))
      return acc
    }, []))
  }

  const isLow = timeLeft <= 10 && !confirmed && !timedOut
  const isUrgent = timeLeft <= 5 && !confirmed && !timedOut
  const progress = timeLeft / TOTAL_SEC

  const selectedDice = selected.map(id => myDice.find(d => d.id === id)!).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── 상단 고정 헤더 ── */}
      <div style={{
        flexShrink: 0,
        background: '#fff',
        borderBottom: '1px solid #f1f5f9',
        padding: '10px 16px 0',
      }}>
        {/* vs 라인 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>나</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>vs</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c2410c' }}>{opponentNickname}</div>
        </div>

        {/* 타이머 바 */}
        <div style={{ position: 'relative', height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${progress * 100}%`,
            borderRadius: 99,
            background: isUrgent
              ? '#ef4444'
              : isLow
              ? '#f59e0b'
              : '#2563eb',
            transition: 'width 1s linear, background 0.3s',
          }} />
        </div>

        {/* 타이머 숫자 */}
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: isUrgent ? '#ef4444' : isLow ? '#f59e0b' : '#64748b',
          marginBottom: 8,
          animation: isUrgent ? 'pulse 0.5s ease-in-out infinite' : 'none',
        }}>
          {timedOut ? '시간 초과 — 자동 선택됨' : confirmed ? '준비 완료!' : `⏱ ${timeLeft}초`}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginBottom: 8 }}>
          {mode === 'double-battle' ? '1R 1개 · 2R 1개 · 3R 2개' : '1R 1개 · 2R 1개 · 3R 1개'}
        </div>

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>

      {/* ── 컨텐츠 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>

        {/* 준비 완료 대기 화면 */}
        {(confirmed || timedOut) ? (
          <SealedWaiting
            selectedDice={timedOut ? myDice.slice(0, totalPickCount) : selectedDice}
            opponentNickname={opponentNickname}
            opponentReady={opponentReady}
            timedOut={timedOut}
            slotSizes={slotSizes}
          />
        ) : (
          <>
            {/* 상대 덱 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {opponentNickname}의 덱
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {opponentDice.map(die => (
                  <div key={die.id} style={{
                    padding: '7px 6px', borderRadius: 10,
                    background: '#fff', border: '1.5px solid #f1f5f9',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 18px)', gap: 2 }}>
                      {[...die.faces].sort((a, b) => b - a).map((f, fi) => (
                        <span key={fi} style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 18, height: 18, borderRadius: 3,
                          background: COLORS[fi], border: '1px solid rgba(0,0,0,0.07)',
                          fontWeight: 700, fontSize: 9, color: '#1e293b',
                        }}>{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0 14px' }} />

            {/* 내 덱 — 선택 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  내 덱 — 출전 순서 선택
                </div>
                <div style={{ fontSize: 11, color: selected.length === totalPickCount ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                  {selected.length} / {totalPickCount}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myDice.map(die => {
                  const idx = selected.indexOf(die.id)
                  const isSel = idx !== -1
                  return (
                    <button
                      key={die.id}
                      onClick={() => toggle(die.id)}
                      style={{
                        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12,
                        padding: '8px 12px 8px 8px',
                        borderRadius: 12,
                        border: `2px solid ${isSel ? '#2563eb' : '#e5e7eb'}`,
                        background: isSel ? '#eff6ff' : '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                        position: 'relative',
                        transition: 'border-color 0.12s, background 0.12s',
                      }}
                    >
                      {isSel && (
                        <span style={{
                          position: 'absolute', top: 7, right: 8,
                          width: 20, height: 20, borderRadius: '50%',
                          background: '#2563eb', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 11,
                        }}>{idx + 1}</span>
                      )}
                      <MiniCube faces={die.faces} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: 4 }}>
                        {[...die.faces].sort((a, b) => b - a).map((f, fi) => (
                          <span key={fi} style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 6,
                            background: COLORS[fi], border: '1px solid rgba(0,0,0,0.08)',
                            fontWeight: 700, fontSize: 12, color: '#1e293b',
                          }}>{f}</span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={selected.length !== totalPickCount}
              style={{
                width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 700,
                borderRadius: 12, border: 'none', fontFamily: 'inherit',
                cursor: selected.length === totalPickCount ? 'pointer' : 'not-allowed',
                background: selected.length === totalPickCount ? '#2563eb' : '#e2e8f0',
                color: selected.length === totalPickCount ? '#fff' : '#94a3b8',
                transition: 'background 0.15s',
              }}
            >
              {selected.length === totalPickCount ? '준비 완료' : `${totalPickCount - selected.length}개 더 선택하세요`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── 준비 완료 대기 화면 ──────────────────────────────────────

function SealedWaiting({ selectedDice, opponentNickname, opponentReady, timedOut, slotSizes }: {
  selectedDice: Die[]
  opponentNickname: string
  opponentReady: boolean
  timedOut: boolean
  slotSizes: readonly number[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
          {timedOut ? '자동 준비 완료' : '준비 완료'}
        </div>
        {timedOut && (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>시간 초과로 앞 순서부터 자동 선택되었습니다</div>
        )}
      </div>

      {/* 내 선택 순서 표시 */}
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
          출전 순서
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {selectedDice.map((die, i) => {
            const roundNumber = slotSizes[0] > i ? 1 : slotSizes[0] + slotSizes[1] > i ? 2 : 3
            return (
            <div key={die?.id ?? i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '10px 8px', borderRadius: 12,
              background: '#fff', border: '1.5px solid #dbeafe',
              minWidth: 72,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: '#2563eb', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
              }}>{roundNumber}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 16px)', gap: 2 }}>
                {die && [...die.faces].sort((a, b) => b - a).map((f, fi) => (
                  <span key={fi} style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: 3,
                    background: COLORS[fi], fontSize: 8, fontWeight: 700, color: '#1e293b',
                  }}>{f}</span>
                ))}
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* 상대방 대기 상태 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 20px', borderRadius: 12,
        background: opponentReady ? '#f0fdf4' : '#f8fafc',
        border: `1.5px solid ${opponentReady ? '#86efac' : '#e2e8f0'}`,
      }}>
        {opponentReady ? (
          <>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
              {opponentNickname} 준비 완료 — 게임 시작!
            </span>
          </>
        ) : (
          <>
            <InlineSpinner />
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {opponentNickname} 선택 중...
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ── 미니 회전 큐브 ────────────────────────────────────────────

function MiniCube({ faces }: { faces: Die['faces'] }) {
  const S = 44, H = S / 2
  const rotY = useRef(20)
  const rafRef = useRef<number>(0)
  const divRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const animate = () => {
      rotY.current += 0.5
      if (divRef.current) divRef.current.style.transform = `rotateX(-20deg) rotateY(${rotY.current}deg)`
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])
  return (
    <div style={{ width: S + H * 2, height: S + H * 2, perspective: '300px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={divRef} style={{ position: 'relative', width: S, height: S, transformStyle: 'preserve-3d' }}>
        {faces.map((face, fi) => (
          <div key={fi} style={{
            position: 'absolute', width: S, height: S,
            transform: CUBE_TRANSFORMS[fi],
            background: COLORS[fi], border: '1.5px solid rgba(0,0,0,0.15)',
            borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backfaceVisibility: 'hidden', fontSize: 14, fontWeight: 800, color: '#1e293b',
          }}>{face}</div>
        ))}
      </div>
    </div>
  )
}

function InlineSpinner() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
      border: '2px solid #e2e8f0', borderTop: '2px solid #2563eb',
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
