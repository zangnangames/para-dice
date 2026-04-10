interface FaceInputProps {
  value: number
  onChange: (value: number) => void
}

export function FaceInput({ value, onChange }: FaceInputProps) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={e => {
        const n = parseInt(e.target.value, 10)
        if (!isNaN(n) && n >= 0) onChange(n)
      }}
      style={{
        width: 48,
        textAlign: 'center',
        fontSize: 16,
        padding: '4px 0',
        border: '1px solid #d1d5db',
        borderRadius: 4,
      }}
    />
  )
}
