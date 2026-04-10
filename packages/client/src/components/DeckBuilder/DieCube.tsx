import { useState, useRef, useEffect } from 'react'
import type { Die } from '@dice-game/core'
import { SumBadge } from '../shared/SumBadge'

// 큐브 카드용
const S = 72
const H = S / 2
const PAD = 16

const CUBE_TRANSFORMS: string[] = [
  `rotateX(90deg) translateZ(${H}px)`,
  `rotateY(-90deg) translateZ(${H}px)`,
  `translateZ(${H}px)`,
  `rotateY(90deg) translateZ(${H}px)`,
  `rotateY(180deg) translateZ(${H}px)`,
  `rotateX(-90deg) translateZ(${H}px)`,
]

// 전개도용 (세로 십자: 3열 × 4행)
//    [위]
// [왼][앞][오른]
//    [아래]
//    [뒤]
const S_NET = 96
const H_NET = S_NET / 2

const NET_CUBE_TRANSFORMS: string[] = [
  `rotateX(90deg) translateZ(${H_NET}px)`,
  `rotateY(-90deg) translateZ(${H_NET}px)`,
  `translateZ(${H_NET}px)`,
  `rotateY(90deg) translateZ(${H_NET}px)`,
  `rotateY(180deg) translateZ(${H_NET}px)`,
  `rotateX(-90deg) translateZ(${H_NET}px)`,
]

// fi 순서: 위=0, 왼=1, 앞=2, 오른=3, 뒤=4, 아래=5
const NET_OFFSETS: [number, number][] = [
  [0, -S_NET],           // 위
  [-S_NET, 0],           // 왼
  [0, 0],                // 앞 (중심)
  [S_NET, 0],            // 오른
  [0, 2 * S_NET],        // 뒤
  [0, S_NET],            // 아래
]

const COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']

const arrowBtn: React.CSSProperties = {
  width: 28, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 10, fontWeight: 700,
  border: '1px solid rgba(0,0,0,0.18)',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.75)',
  color: '#334155',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
}

const DUR = '0.45s'
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

// 큐브 카드 씬 크기 (4S × 3S)
const SCENE_W = 4 * S + 2 * PAD
const SCENE_H = 3 * S + 2 * PAD

// 전개도 씬 크기 (3*S_NET × 4*S_NET)
const NET_SCENE_W = 3 * S_NET + 2 * PAD
const NET_SCENE_H = 4 * S_NET + 2 * PAD

interface DieCubeProps {
  die: Die
  dieIndex: number
  onFaceChange: (faceIndex: number, value: number) => void
}

export function DieCube({ die, onFaceChange }: DieCubeProps) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)   // 실제 CSS 전환 트리거
  const [bfv, setBfv] = useState<'hidden' | 'visible'>('hidden')
  const [dragging, setDragging] = useState(false)
  const [rotX, setRotX] = useState(-25)
  const [rotY, setRotY] = useState(35)

  // 카드 원래 위치/크기 기록
  const [startRect, setStartRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, x: 0, y: 0 })

  const sum = die.faces.reduce((a, b) => a + b, 0)
  const valid = sum === 21

  // expanded 되면 면이 다 보이게, 닫힐 때 딜레이 후 숨김
  useEffect(() => {
    if (expanded) {
      setBfv('visible')
    } else {
      const t = setTimeout(() => setBfv('hidden'), 500)
      return () => clearTimeout(t)
    }
  }, [expanded])

  const openEdit = () => {
    const r = cardRef.current?.getBoundingClientRect() ?? null
    setStartRect(r)
    setEditing(true)
    // 두 프레임 후 expanded=true → transition 발동
    requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)))
  }

  const closeEdit = () => {
    setExpanded(false)
    setTimeout(() => {
      setEditing(false)
      setStartRect(null)
    }, 480)
  }

  // 큐브 드래그 (카드 + 오버레이 공유)
  const handlePointerDown = (e: React.PointerEvent) => {
    drag.current = { active: true, x: e.clientX, y: e.clientY }
    sceneRef.current?.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    setRotY(r => r + (e.clientX - drag.current.x) * 0.5)
    setRotX(r => r - (e.clientY - drag.current.y) * 0.5)
    drag.current.x = e.clientX
    drag.current.y = e.clientY
  }
  const handlePointerUp = () => {
    drag.current.active = false
    setDragging(false)
  }

  // 오버레이의 위치/크기: 시작(startRect) → 목표(화면 중앙, 더 큼)
  const overlayStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 300,
      borderRadius: 18,
      border: `2px solid ${valid ? '#e2e8f0' : '#fca5a5'}`,
      background: valid ? '#fff' : '#fff7f7',
      boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      transition: `top ${DUR} ${EASE}, left ${DUR} ${EASE}, width ${DUR} ${EASE}, height ${DUR} ${EASE}, transform ${DUR} ${EASE}, border-radius ${DUR} ${EASE}, box-shadow ${DUR} ${EASE}`,
    }
    if (!expanded && startRect) {
      return {
        ...base,
        top: startRect.top,
        left: startRect.left,
        width: startRect.width,
        height: startRect.height,
        transform: 'none',
        borderRadius: 14,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }
    }
    // 확장 상태: 화면 중앙
    return {
      ...base,
      top: '50%',
      left: '50%',
      width: NET_SCENE_W + 32,
      height: NET_SCENE_H + 110,
      transform: 'translate(-50%, -50%)',
    }
  })()

  return (
    <>
      {/* ── 카드 (그리드 자리 유지, 편집 중엔 흐리게) ── */}
      <div
        ref={cardRef}
        style={{
          borderRadius: 14,
          border: `2px solid ${valid ? '#e2e8f0' : '#fca5a5'}`,
          background: valid ? '#fff' : '#fff7f7',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: editing ? 0.35 : 1,
          transition: 'opacity 0.25s',
          pointerEvents: editing ? 'none' : 'auto',
        }}
      >
        {/* 큐브 scene */}
        <div
          ref={sceneRef}
          style={{
            position: 'relative',
            width: SCENE_W,
            height: SCENE_H,
            perspective: '600px',
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <CubeWrapper rotX={rotX} rotY={rotY} dragging={dragging} die={die} mode="cube" bfv={bfv} />
        </div>

        <div style={{
          width: '100%', padding: '10px 14px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'center',
        }}>
          <button
            onClick={openEdit}
            style={{
              padding: '5px 24px', fontSize: 13, fontWeight: 600, borderRadius: 6,
              border: '1.5px solid #2563eb', background: 'transparent', color: '#2563eb',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            편집
          </button>
        </div>
      </div>

      {/* ── 딤 배경 ── */}
      {editing && (
        <div
          onClick={closeEdit}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: `rgba(0,0,0,${expanded ? 0.45 : 0})`,
            transition: `background ${DUR} ease`,
          }}
        />
      )}

      {/* ── 확장 오버레이 (카드 → 전개도) ── */}
      {editing && (
        <div style={overlayStyle}>
          {/* 합계 배지 */}
          <div style={{
            width: '100%', display: 'flex', justifyContent: 'center',
            padding: '14px 0 0',
            opacity: expanded ? 1 : 0,
            transition: `opacity 0.2s ease ${expanded ? '0.25s' : '0'}`,
          }}>
            <SumBadge current={sum} />
          </div>

          {/* 전개도 */}
          <div style={{
            position: 'relative',
            width: NET_SCENE_W,
            height: NET_SCENE_H,
            flex: 1,
            perspective: '700px',
          }}>
            {/* 앞면 중심: x=1.5*S_NET+PAD, y=1.5*S_NET+PAD */}
            {die.faces.map((face, fi) => {
              const [ox, oy] = NET_OFFSETS[fi]
              const cx = 1.5 * S_NET + PAD + ox
              const cy = 1.5 * S_NET + PAD + oy
              return (
                <div key={fi} style={{
                  position: 'absolute',
                  left: cx, top: cy,
                  width: S_NET, height: S_NET,
                  marginLeft: -H_NET, marginTop: -H_NET,
                  background: COLORS[fi],
                  border: '2px solid rgba(0,0,0,0.13)',
                  borderRadius: 8,
                  boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: expanded
                    ? 'none'
                    : `translateX(${H_NET}px) ${NET_CUBE_TRANSFORMS[fi]}`,
                  transformOrigin: 'center',
                  transformStyle: 'preserve-3d',
                  transition: `transform 0.45s ${EASE}`,
                  backfaceVisibility: bfv,
                  WebkitBackfaceVisibility: bfv,
                } as React.CSSProperties}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    opacity: expanded ? 1 : 0,
                    transition: `opacity 0.15s ease ${expanded ? '0.35s' : '0'}`,
                  }}>
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => { if (sum < 21) onFaceChange(fi, face + 1) }}
                      disabled={sum >= 21}
                      style={{ ...arrowBtn, opacity: sum >= 21 ? 0.25 : 1 }}
                    >▲</button>
                    <span style={{
                      fontSize: 24, fontWeight: 800, color: '#1e293b',
                      minWidth: 36, textAlign: 'center', lineHeight: 1,
                    }}>{face}</span>
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => { if (face > 0) onFaceChange(fi, face - 1) }}
                      disabled={face <= 0}
                      style={{ ...arrowBtn, opacity: face <= 0 ? 0.25 : 1 }}
                    >▼</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 완료 버튼 */}
          <div style={{
            width: '100%', padding: '10px 14px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'center',
          }}>
            <button
              onClick={closeEdit}
              style={{
                padding: '5px 24px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                border: 'none', background: '#2563eb', color: '#fff',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              완료
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── 큐브 렌더러 (카드 안에서만 사용) ─────────────────────────
function CubeWrapper({ rotX, rotY, dragging, die, mode, bfv }: {
  rotX: number; rotY: number; dragging: boolean
  die: Die; mode: 'cube'; bfv: 'hidden' | 'visible'
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 1.5 * S + PAD,
      left: 1.5 * S + PAD,
      transformStyle: 'preserve-3d',
      transform: `translateX(${H}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
      transition: dragging ? 'none' : `transform 0.45s ${EASE}`,
    }}>
      {die.faces.map((face, fi) => (
        <div key={fi} style={{
          position: 'absolute',
          width: S, height: S,
          marginLeft: -H, marginTop: -H,
          transform: CUBE_TRANSFORMS[fi],
          background: COLORS[fi],
          border: '2px solid rgba(0,0,0,0.13)',
          borderRadius: 6,
          boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backfaceVisibility: mode === 'cube' ? 'hidden' : bfv,
        } as React.CSSProperties}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{face}</span>
        </div>
      ))}
    </div>
  )
}
