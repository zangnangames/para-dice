import { describe, it, expect } from 'vitest'
import { validateDie, validateDeck, validateDraftPick } from './validator'
import { resolveRound, applyRoundResult, createInitialGameState } from './engine'
import type { Die, Deck } from './types'

const die = (faces: [number,number,number,number,number,number], id = 'd1'): Die =>
  ({ id, faces })

const validDeck = (): Deck => ({
  id: 'deck1', name: '테스트',
  dice: [
    die([1,2,3,4,5,6], 'a'),
    die([2,2,3,4,4,6], 'b'),
    die([1,3,3,4,4,6], 'c'),
    die([2,3,3,3,4,6], 'd'),
  ],
})

// ── validator ──────────────────────────────────────────────────

describe('validateDie', () => {
  it('합계 21 → 통과', () => expect(validateDie(die([1,2,3,4,5,6])).valid).toBe(true))
  it('합계 다름 → 실패', () => expect(validateDie(die([1,1,1,1,1,1])).valid).toBe(false))
  it('음수 포함 → 실패', () => expect(validateDie(die([-1,2,3,5,6,6])).valid).toBe(false))
})

describe('validateDeck', () => {
  it('유효한 덱 → 통과', () => expect(validateDeck(validDeck()).valid).toBe(true))
  it('id 중복 → 실패', () => {
    const deck = validDeck()
    deck.dice[1] = die([2,2,3,4,4,6], 'a')
    expect(validateDeck(deck).valid).toBe(false)
  })
})

describe('validateDraftPick', () => {
  it('유효한 픽 → 통과', () => {
    const r = validateDraftPick({ rounds: [['a'], ['b'], ['c']] }, validDeck())
    expect(r.valid).toBe(true)
  })
  it('덱에 없는 id → 실패', () => {
    const r = validateDraftPick({ rounds: [['a'], ['b'], ['z']] }, validDeck())
    expect(r.valid).toBe(false)
  })
  it('중복 선택 → 실패', () => {
    const r = validateDraftPick({ rounds: [['a'], ['a'], ['b']] }, validDeck())
    expect(r.valid).toBe(false)
  })
  it('더블 배틀은 마지막 라운드에 2개 선택', () => {
    const r = validateDraftPick({ rounds: [['a'], ['b'], ['c', 'd']] }, validDeck(), 'double-battle')
    expect(r.valid).toBe(true)
  })
})

// ── engine ─────────────────────────────────────────────────────

describe('resolveRound', () => {
  it('winner 는 항상 me | opp', () => {
    const { winner } = resolveRound([die([6,6,6,1,1,1])], [die([4,4,4,3,3,3])])
    expect(['me', 'opp']).toContain(winner)
  })
  it('rolls 는 최소 1개 이상', () => {
    const { rolls } = resolveRound([die([3,3,3,3,3,6])], [die([3,3,3,3,3,6])])
    expect(rolls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('applyRoundResult', () => {
  it('2선승 → 게임 종료', () => {
    let s = createInitialGameState('classic')
    s = applyRoundResult(s, [], 'me')
    s = applyRoundResult(s, [], 'me')
    expect(s.finished).toBe(true)
    expect(s.winner).toBe('me')
  })
  it('1승 1패 → 게임 계속', () => {
    let s = createInitialGameState('classic')
    s = applyRoundResult(s, [], 'me')
    s = applyRoundResult(s, [], 'opp')
    expect(s.finished).toBe(false)
  })
})
