/**
 * 공통 아바타 컴포넌트
 * - 닉네임 첫 글자 + 단색 배경 (커스텀 색상 우선, 없으면 닉네임 해시 자동 배색)
 * - avatarUrl은 사용하지 않음 (커스텀 아바타만 사용)
 */

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#06b6d4', '#f59e0b', '#ef4444',
]

function colorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export { PALETTE }

interface AvatarProps {
  nickname: string
  size?: number
  border?: string
  boxShadow?: string
  style?: React.CSSProperties
  customColor?: string | null  // 사용자가 직접 선택한 색상
}

export function Avatar({ nickname, size = 48, border, boxShadow, style, customColor }: AvatarProps) {
  const initial = (nickname ?? '?')[0].toUpperCase()
  const bg = customColor ?? colorFromName(nickname ?? '?')

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      border,
      boxShadow,
      ...style,
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 800,
      fontSize: Math.round(size * 0.42),
      fontFamily: 'system-ui, sans-serif',
      userSelect: 'none',
    }}>
      {initial}
    </div>
  )
}
