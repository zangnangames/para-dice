import { useState, useEffect, useRef } from 'react'
import type { Die } from '@dice-game/core'

// ── 미니 자동회전 큐브 ─────────────────────────────────────────
const S = 44
const H = S / 2

const CUBE_TRANSFORMS = [
  `rotateX(90deg) translateZ(${H}px)`,
  `rotateY(-90deg) translateZ(${H}px)`,
  `translateZ(${H}px)`,
  `rotateY(90deg) translateZ(${H}px)`,
  `rotateY(180deg) translateZ(${H}px)`,
  `rotateX(-90deg) translateZ(${H}px)`,
]

const COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']

function RotatingCube({ faces }: { faces: Die['faces'] }) {
  const rotY = useRef(20)
  const rotX = useRef(-20)
  const rafRef = useRef<number>(0)
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const animate = () => {
      rotY.current += 0.5
      if (divRef.current) {
        divRef.current.style.transform =
          `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{
      width: S + H * 2,
      height: S + H * 2,
      perspective: '300px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ position: 'relative', width: S, height: S, transformStyle: 'preserve-3d' }}
        ref={divRef}>
        {faces.map((face, fi) => (
          <div key={fi} style={{
            position: 'absolute',
            width: S, height: S,
            transform: CUBE_TRANSFORMS[fi],
            background: COLORS[fi],
            border: '1.5px solid rgba(0,0,0,0.15)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backfaceVisibility: 'hidden',
            fontSize: 14,
            fontWeight: 800,
            color: '#1e293b',
          }}>
            {face}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── DraftPhase ─────────────────────────────────────────────────
interface DraftPhaseProps {
  myDice: Die[]
  aiDice: Die[]
  onConfirm: (orderedIds: [string, string, string]) => void
}

export function DraftPhase({ myDice, aiDice, onConfirm }: DraftPhaseProps) {
  const [selected, setSelected] = useState<string[]>([])

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const canConfirm = selected.length === 3

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>드래프트</h2>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>
        출전할 주사위 3개를 선택하세요. <strong>선택 순서 = 출전 순서</strong>입니다.
      </p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 24,
      }}>
        {myDice.map(die => {
          const idx = selected.indexOf(die.id)
          const isSelected = idx !== -1
          return (
            <button
              key={die.id}
              onClick={() => toggle(die.id)}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: '8px 14px 8px 10px',
                borderRadius: 12,
                border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                background: isSelected ? '#eff6ff' : '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                position: 'relative',
              }}
            >
              {/* 선택 순번 배지 */}
              {isSelected && (
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#2563eb', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12,
                }}>
                  {idx + 1}
                </span>
              )}

              {/* 자동회전 큐브 */}
              <RotatingCube faces={die.faces} />

              {/* 숫자 3×2 그리드 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 30px)',
                gap: 5,
              }}>
                {[...die.faces].sort((a, b) => b - a).map((f, fi) => (
                  <span key={fi} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30, height: 30,
                    borderRadius: 6,
                    background: COLORS[fi],
                    border: '1px solid rgba(0,0,0,0.08)',
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#1e293b',
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* 상대 덱 */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          상대 덱
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
        }}>
          {aiDice.map((die) => (
            <div key={die.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              padding: '7px 6px',
              borderRadius: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 18px)',
                gap: 3,
              }}>
                {[...die.faces].sort((a, b) => b - a).map((f, fi) => (
                  <span key={fi} style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: 3,
                    background: COLORS[fi], border: '1px solid rgba(0,0,0,0.07)',
                    fontWeight: 700, fontSize: 9, color: '#1e293b',
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => canConfirm && onConfirm(selected as [string, string, string])}
        disabled={!canConfirm}
        style={{
          width: '100%', padding: '12px 0', fontSize: 16, fontWeight: 600,
          borderRadius: 8, border: 'none', fontFamily: 'inherit',
          cursor: canConfirm ? 'pointer' : 'not-allowed',
          background: canConfirm ? '#2563eb' : '#9ca3af',
          color: '#fff',
        }}
      >
        순서 선택 완료
      </button>
    </div>
  )
}
