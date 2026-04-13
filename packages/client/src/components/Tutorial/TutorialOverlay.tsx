import { useState, useEffect, useCallback } from 'react'
import { useTutorialStore } from '@/store/tutorialStore'

// ── 슬라이드 데이터 ────────────────────────────────────────────

interface Slide {
  emoji: string
  title: string
  body: string
  demo?: React.ReactNode
}

const slides: Slide[] = [
  {
    emoji: '🎲',
    title: 'para.Dice란?',
    body: '비추이적 주사위(Non-transitive Dice) 원리를 활용한 전략형 1대1 대전 게임입니다.\n\n"항상 이기는 주사위는 없다" — A가 B를 이기고, B가 C를 이겨도, C가 A를 이길 수 있습니다.',
  },
  {
    emoji: '✏️',
    title: '주사위 만들기',
    body: '주사위 1개는 6개의 면으로 구성됩니다.\n\n핵심 규칙: 6면의 숫자 합계가 반드시 21이어야 합니다.\n예) 1, 2, 3, 4, 5, 6 → 합계 21 ✅',
    demo: <DiceDemo />,
  },
  {
    emoji: '📦',
    title: '덱 구성',
    body: '주사위 4개를 묶어 덱 1개를 만듭니다.\n\n덱 빌더에서 각 주사위의 면을 자유롭게 배치하고 저장하세요. 주사위 구성이 전략의 핵심입니다.',
  },
  {
    emoji: '🔒',
    title: '드래프트 페이즈',
    body: '매칭 후 상대 덱 4개가 공개됩니다.\n\n내 덱 4개 중 3개를 선택하고 출전 순서를 정해 봉인하세요.\n\n⏱ 제한시간: 40초 (초과 시 앞 3개 자동 선택)',
    demo: <DraftDemo />,
  },
  {
    emoji: '⚔️',
    title: '대결 진행',
    body: '봉인한 순서대로 1라운드씩 주사위를 굴립니다.\n\n2라운드를 먼저 이기면 승리 (2선승제).\n동점이 나오면 같은 주사위로 재대결 — 승패가 결정될 때까지 반복됩니다.',
    demo: <RoundDemo />,
  },
  {
    emoji: '🚀',
    title: '시작할 준비가 됐어요!',
    body: '먼저 덱 빌더에서 나만의 주사위를 만들어보세요.\n\n덱을 저장하면 랜덤 매칭으로 전 세계 플레이어와 대결할 수 있습니다.',
  },
]

// ── 메인 컴포넌트 ──────────────────────────────────────────────

interface TutorialOverlayProps {
  onComplete: () => void   // 완료 시 덱 빌더로 이동하는 콜백
  onSkip: () => void       // 건너뛰기
}

export function TutorialOverlay({ onComplete, onSkip }: TutorialOverlayProps) {
  const [index, setIndex] = useState(0)
  const [exiting, setExiting] = useState(false)
  const markDone = useTutorialStore(s => s.markDone)
  const isLast = index === slides.length - 1

  const next = useCallback(() => {
    if (index < slides.length - 1) setIndex(i => i + 1)
  }, [index])

  const prev = useCallback(() => {
    if (index > 0) setIndex(i => i - 1)
  }, [index])

  const finish = useCallback((toDeckBuilder = false) => {
    setExiting(true)
    markDone()
    setTimeout(() => {
      if (toDeckBuilder) onComplete()
      else onSkip()
    }, 300)
  }, [markDone, onComplete, onSkip])

  // 키보드 지원
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev()
      if (e.key === 'Escape') finish(false)
      if (e.key === 'Enter' && isLast) finish(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev, finish, isLast])

  // 스와이프 지원
  useEffect(() => {
    let startX = 0
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onTouchEnd   = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      if (dx < -50) next()
      if (dx > 50)  prev()
    }
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend',   onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [next, prev])

  const slide = slides[index]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(15, 23, 42, 0.85)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      opacity: exiting ? 0 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        padding: '28px 24px 36px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* 상단 핸들 + 건너뛰기 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: '#e2e8f0', margin: '0 auto' }} />
        </div>

        {/* 진행 도트 */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 20 : 8,
                height: 8, borderRadius: 99, border: 'none', cursor: 'pointer',
                background: i === index ? '#2563eb' : '#e2e8f0',
                transition: 'all 0.25s ease',
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* 슬라이드 콘텐츠 */}
        <div key={index} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          animation: 'tutSlideIn 0.25s ease',
        }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>{slide.emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>
            {slide.title}
          </div>
          <div style={{
            fontSize: 14, color: '#475569', lineHeight: 1.7,
            textAlign: 'center', whiteSpace: 'pre-line',
          }}>
            {slide.body}
          </div>
          {slide.demo && (
            <div style={{ width: '100%', marginTop: 4 }}>
              {slide.demo}
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          {index > 0 && (
            <button
              onClick={prev}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 12, border: '1.5px solid #e2e8f0',
                background: '#fff', color: '#64748b', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >이전</button>
          )}

          {!isLast ? (
            <button
              onClick={next}
              style={{
                flex: 2, padding: '13px 0', borderRadius: 12, border: 'none',
                background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >다음 →</button>
          ) : (
            <button
              onClick={() => finish(true)}
              style={{
                flex: 2, padding: '13px 0', borderRadius: 12, border: 'none',
                background: '#2563eb', color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >🎲 첫 덱 만들러 가기</button>
          )}
        </div>

        {/* 건너뛰기 */}
        {!isLast && (
          <button
            onClick={() => finish(false)}
            style={{
              marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#94a3b8', fontFamily: 'inherit',
            }}
          >건너뛰기</button>
        )}
      </div>

      <style>{`
        @keyframes tutSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── 인터랙티브 미니 데모 ────────────────────────────────────────

const FACE_COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']

function DiceDemo() {
  const [faces, setFaces] = useState([3, 3, 3, 4, 4, 4])
  const sum = faces.reduce((a, b) => a + b, 0)
  const isValid = sum === 21

  const change = (i: number, delta: number) => {
    setFaces(prev => {
      const next = [...prev]
      next[i] = Math.max(1, Math.min(20, next[i] + delta))
      return next
    })
  }

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textAlign: 'center', letterSpacing: '0.05em' }}>
        미니 편집기 — 6면 합계: <span style={{ color: isValid ? '#16a34a' : '#ef4444', fontWeight: 800 }}>{sum}</span> / 21
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {faces.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: FACE_COLORS[i], borderRadius: 8, padding: '6px 8px',
            border: '1px solid rgba(0,0,0,0.07)',
          }}>
            <button onClick={() => change(i, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', padding: '0 2px', lineHeight: 1 }}>−</button>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', minWidth: 20, textAlign: 'center' }}>{f}</span>
            <button onClick={() => change(i, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b', padding: '0 2px', lineHeight: 1 }}>+</button>
          </div>
        ))}
      </div>
      {isValid && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a', fontWeight: 700, textAlign: 'center' }}>✅ 합계 21 달성!</div>
      )}
    </div>
  )
}

function DraftDemo() {
  const dice = [
    [6, 6, 2, 2, 2, 3],
    [5, 5, 5, 1, 3, 2],
    [4, 4, 4, 4, 3, 2],
    [7, 1, 1, 4, 4, 4],
  ]
  const [selected, setSelected] = useState<number[]>([])

  const toggle = (i: number) => {
    setSelected(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 3 ? [...prev, i] : prev
    )
  }

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textAlign: 'center', letterSpacing: '0.05em' }}>
        내 덱 — 3개 선택 ({selected.length}/3)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {dice.map((d, i) => {
          const idx = selected.indexOf(i)
          const sel = idx !== -1
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              style={{
                padding: '8px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${sel ? '#2563eb' : '#e5e7eb'}`,
                background: sel ? '#eff6ff' : '#fff',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit', position: 'relative',
              }}
            >
              {sel && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#2563eb', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800,
                }}>{idx + 1}</span>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 14px)', gap: 2 }}>
                {[...d].sort((a, b) => b - a).map((f, fi) => (
                  <span key={fi} style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: FACE_COLORS[fi],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: '#1e293b',
                    border: '1px solid rgba(0,0,0,0.07)',
                  }}>{f}</span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RoundDemo() {
  const [rolling, setRolling] = useState(false)
  const [myRoll, setMyRoll] = useState<number | null>(null)
  const [oppRoll, setOppRoll] = useState<number | null>(null)
  const myFaces  = [6, 6, 2, 2, 2, 3]
  const oppFaces = [5, 5, 5, 1, 3, 2]

  const roll = () => {
    if (rolling) return
    setRolling(true)
    setMyRoll(null)
    setOppRoll(null)
    setTimeout(() => {
      setMyRoll(myFaces[Math.floor(Math.random() * 6)])
      setOppRoll(oppFaces[Math.floor(Math.random() * 6)])
      setRolling(false)
    }, 800)
  }

  const result = myRoll !== null && oppRoll !== null
    ? myRoll > oppRoll ? '내가 이겼어요! 🎉' : myRoll < oppRoll ? '상대가 이겼어요' : '동점 — 재대결!'
    : null

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
        <DiceResult faces={myFaces} roll={myRoll} rolling={rolling} label="나" color="#2563eb" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>vs</span>
        <DiceResult faces={oppFaces} roll={oppRoll} rolling={rolling} label="상대" color="#c2410c" />
      </div>
      {result && (
        <div style={{
          textAlign: 'center', fontSize: 13, fontWeight: 700,
          color: result.includes('내가') ? '#16a34a' : result.includes('동점') ? '#d97706' : '#ef4444',
          marginBottom: 8,
        }}>{result}</div>
      )}
      <button
        onClick={roll}
        disabled={rolling}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 10,
          background: rolling ? '#e2e8f0' : '#2563eb', color: rolling ? '#94a3b8' : '#fff',
          border: 'none', cursor: rolling ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
        }}
      >{rolling ? '굴리는 중...' : '🎲 주사위 굴리기'}</button>
    </div>
  )
}

function DiceResult({ faces, roll, rolling, label, color }: {
  faces: number[]; roll: number | null; rolling: boolean; label: string; color: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{label}</div>
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: '#fff', border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: rolling ? 22 : 28, fontWeight: 800, color: '#1e293b',
        transition: 'all 0.2s',
        animation: rolling ? 'diceSpin 0.2s linear infinite' : 'none',
      }}>
        {rolling ? '?' : roll ?? faces[0]}
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        [{[...faces].sort((a, b) => b - a).join(', ')}]
      </div>
      <style>{`@keyframes diceSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
