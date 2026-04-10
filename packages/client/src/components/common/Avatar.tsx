/**
 * 공통 아바타 컴포넌트
 * - avatarUrl 있으면 이미지 표시
 * - 없으면 닉네임 첫 글자 + 단색 배경
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

interface AvatarProps {
  avatarUrl: string | null | undefined
  nickname: string
  size?: number
  border?: string
  boxShadow?: string
  style?: React.CSSProperties
}

export function Avatar({ avatarUrl, nickname, size = 48, border, boxShadow, style }: AvatarProps) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    border,
    boxShadow,
    objectFit: 'cover',
    ...style,
  }

  if (avatarUrl) {
    return <img src={avatarUrl} alt="" style={base} />
  }

  const initial = (nickname ?? '?')[0].toUpperCase()
  const bg = colorFromName(nickname ?? '?')

  return (
    <div style={{
      ...base,
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
