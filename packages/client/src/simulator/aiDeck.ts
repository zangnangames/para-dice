import type { Deck, Die } from '@dice-game/core'

function randomDie(id: string): Die {
  const faces: number[] = [0, 0, 0, 0, 0, 0]
  let remaining = 21
  for (let i = 0; i < 5; i++) {
    const max = remaining - (5 - i)
    const val = Math.floor(Math.random() * (max + 1))
    faces[i] = val
    remaining -= val
  }
  faces[5] = remaining
  return { id, faces: faces as Die['faces'] }
}

export function generateAiDeck(): Deck {
  return {
    id: 'ai-deck',
    name: 'AI 덱',
    dice: Array.from({ length: 4 }, (_, i) =>
      randomDie(`ai-die-${i}`)
    ) as Deck['dice'],
  }
}
