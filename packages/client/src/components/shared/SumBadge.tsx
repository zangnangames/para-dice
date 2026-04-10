interface SumBadgeProps {
  current: number
  target?: number
}

export function SumBadge({ current, target = 21 }: SumBadgeProps) {
  const ok = current === target
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 13,
      fontWeight: 600,
      background: ok ? '#16a34a' : '#dc2626',
      color: '#fff',
    }}>
      합계: {current} / {target}
    </span>
  )
}
