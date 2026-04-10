import type { Die, Deck, DraftPick } from './types'

const FACE_SUM = 21
const FACE_COUNT = 6

export function validateDie(die: Die): { valid: boolean; reason?: string } {
  if (die.faces.length !== FACE_COUNT)
    return { valid: false, reason: `면이 ${FACE_COUNT}개여야 합니다` }

  if (die.faces.some(f => f < 0))
    return { valid: false, reason: '음수 눈은 허용되지 않습니다' }

  const sum = die.faces.reduce((a, b) => a + b, 0)
  if (sum !== FACE_SUM)
    return { valid: false, reason: `눈의 합이 ${FACE_SUM}이어야 합니다 (현재: ${sum})` }

  return { valid: true }
}

export function validateDeck(deck: Deck): { valid: boolean; reason?: string } {
  if (deck.dice.length !== 4)
    return { valid: false, reason: '덱은 주사위 4개여야 합니다' }

  for (const die of deck.dice) {
    const r = validateDie(die)
    if (!r.valid) return { valid: false, reason: `[${die.id}]: ${r.reason}` }
  }

  const ids = deck.dice.map(d => d.id)
  if (new Set(ids).size !== ids.length)
    return { valid: false, reason: '주사위 id가 중복됩니다' }

  return { valid: true }
}

export function validateDraftPick(
  pick: DraftPick,
  deck: Deck
): { valid: boolean; reason?: string } {
  if (pick.diceIds.length !== 3)
    return { valid: false, reason: '정확히 3개를 선택해야 합니다' }

  const deckIds = new Set(deck.dice.map(d => d.id))
  for (const id of pick.diceIds)
    if (!deckIds.has(id))
      return { valid: false, reason: `주사위 [${id}]가 덱에 없습니다` }

  if (new Set(pick.diceIds).size !== 3)
    return { valid: false, reason: '중복 선택 불가' }

  return { valid: true }
}
