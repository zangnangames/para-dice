import type { Deck, Die } from './types'
import { validateDeck } from './validator'

const BASE = 22n
const FACE_COUNT = 24

function flattenDeckFaces(deck: Deck): number[] {
  return deck.dice.flatMap(die => [...die.faces])
}

export function encodeDeckCode(deck: Deck): string {
  const validation = validateDeck(deck)
  if (!validation.valid) {
    throw new Error(validation.reason ?? '유효하지 않은 덱입니다')
  }

  let value = 0n
  for (const face of flattenDeckFaces(deck)) {
    value = value * BASE + BigInt(face)
  }
  return value.toString(10)
}

export function decodeDeckCode(code: string): Die['faces'][] {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d+$/.test(normalized)) {
    throw new Error('덱 코드는 숫자만 포함해야 합니다')
  }

  let value = BigInt(normalized)
  const faces = new Array<number>(FACE_COUNT).fill(0)

  for (let index = FACE_COUNT - 1; index >= 0; index -= 1) {
    faces[index] = Number(value % BASE)
    value /= BASE
  }

  if (value > 0n) {
    throw new Error('덱 코드 길이가 올바르지 않습니다')
  }

  const dice = Array.from({ length: 4 }, (_, dieIndex) => (
    faces.slice(dieIndex * 6, dieIndex * 6 + 6) as Die['faces']
  ))

  const validation = validateDeck({
    id: 'decoded-deck',
    name: 'decoded-deck',
    dice: dice.map((dieFaces, index) => ({
      id: `decoded-die-${index}`,
      faces: dieFaces,
    })) as Deck['dice'],
  })

  if (!validation.valid) {
    throw new Error(validation.reason ?? '유효하지 않은 덱 코드입니다')
  }

  return dice
}
