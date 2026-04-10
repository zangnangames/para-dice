import type { Die } from '@dice-game/core'
import { SumBadge } from '../shared/SumBadge'

interface DieEditorProps {
  die: Die
  dieIndex: number
  onFaceChange: (faceIndex: number, value: number) => void
}

// 십자가 전개도 배치:
//       [면1]
// [면2] [면3] [면4] [면5]
//       [면6]
// grid-column / grid-row (1-indexed)
const NET_POSITIONS = [
  { col: 2, row: 1 }, // 면 1 (위)
  { col: 1, row: 2 }, // 면 2 (왼)
  { col: 2, row: 2 }, // 면 3 (앞)
  { col: 3, row: 2 }, // 면 4 (오른)
  { col: 4, row: 2 }, // 면 5 (뒤)
  { col: 2, row: 3 }, // 면 6 (아래)
]

export function DieEditor({ die, dieIndex, onFaceChange }: DieEditorProps) {
  const sum = die.faces.reduce((a, b) => a + b, 0)
  const ok = sum === 21

  return (
    <div style={{
      border: `2px solid ${ok ? '#e5e7eb' : '#fca5a5'}`,
      borderRadius: 12,
      padding: '16px 16px 20px',
      background: ok ? '#fff' : '#fff7f7',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>주사위 {dieIndex + 1}</span>
        <SumBadge current={sum} />
      </div>

      {/* 전개도 그리드: 4열 × 3행 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 52px)',
        gridTemplateRows: 'repeat(3, 52px)',
        gap: 3,
        justifyContent: 'center',
      }}>
        {die.faces.map((face, fi) => {
          const { col, row } = NET_POSITIONS[fi]
          return (
            <div
              key={fi}
              style={{
                gridColumn: col,
                gridRow: row,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
                border: '1.5px solid #cbd5e1',
                borderRadius: 6,
                gap: 2,
              }}
            >
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, lineHeight: 1 }}>
                {fi + 1}면
              </span>
              <input
                type="number"
                min={0}
                value={face}
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  if (!isNaN(n) && n >= 0) onFaceChange(fi, n)
                }}
                style={{
                  width: 36,
                  textAlign: 'center',
                  fontSize: 17,
                  fontWeight: 700,
                  padding: '1px 0',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  background: '#fff',
                  color: '#1e293b',
                  outline: 'none',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
