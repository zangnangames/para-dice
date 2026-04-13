# Phase 1 — 프로젝트 세팅 + 게임 로직 + 로컬 시뮬레이터

**목표:** 브라우저에서 혼자 게임 전체를 플레이할 수 있는 정적 앱  
**기간:** 1~2주  
**선행 조건:** Node.js LTS, pnpm 설치 완료

---

## 체크리스트

- [x] 1-1. 모노레포 초기화
- [x] 1-2. `@dice-game/core` 패키지 — 타입 정의
- [x] 1-3. `@dice-game/core` 패키지 — 검증 함수
- [x] 1-4. `@dice-game/core` 패키지 — 게임 엔진
- [x] 1-5. 단위 테스트 전체 통과
- [x] 1-6. `@dice-game/client` 패키지 초기화 (React + Vite)
- [x] 1-7. 덱 빌더 UI
- [x] 1-8. 로컬 게임 시뮬레이터 (싱글플레이어)
- [x] 1-9. 주사위 굴리기 애니메이션 초안

---

## 1-1. 모노레포 초기화

### 명령어

```bash
mkdir dice-game && cd dice-game
pnpm init
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 루트 `package.json` scripts

```json
{
  "scripts": {
    "test": "pnpm -r test",
    "dev:client": "pnpm --filter @dice-game/client dev",
    "dev:server": "pnpm --filter @dice-game/server dev"
  }
}
```

---

## 1-2 ~ 1-4. `@dice-game/core` 패키지

### 폴더 구조

```
packages/core/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── validator.ts
    ├── engine.ts
    └── engine.test.ts
```

### `packages/core/package.json`

```json
{
  "name": "@dice-game/core",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

### `packages/core/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### `src/types.ts`

```typescript
// ─── 주사위 / 덱 ───────────────────────────────────────────────

export interface Die {
  id: string
  faces: [number, number, number, number, number, number]
}

export interface Deck {
  id: string
  name: string
  dice: [Die, Die, Die, Die]
}

// ─── 드래프트 ──────────────────────────────────────────────────

export interface DraftPick {
  diceIds: [string, string, string] // 인덱스 = 출전 순서
}

// ─── 라운드 결과 ───────────────────────────────────────────────

export type RoundResult = 'win' | 'lose' | 'draw'

export interface RollResult {
  myRoll: number
  oppRoll: number
  result: RoundResult
}

// ─── 게임 상태 ─────────────────────────────────────────────────

export interface GameState {
  round: number           // 1 | 2 | 3
  myWins: number
  oppWins: number
  rolls: RollResult[]     // 현재 라운드의 모든 굴림 (동점 재대결 포함)
  finished: boolean
  winner: 'me' | 'opp' | null
}
```

### `src/validator.ts`

```typescript
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
```

### `src/engine.ts`

```typescript
import type { Die, RollResult, GameState } from './types'

export function rollDie(die: Die): number {
  return die.faces[Math.floor(Math.random() * 6)]
}

export function rollRound(myDie: Die, oppDie: Die): RollResult {
  const myRoll = rollDie(myDie)
  const oppRoll = rollDie(oppDie)
  const result = myRoll > oppRoll ? 'win' : myRoll < oppRoll ? 'lose' : 'draw'
  return { myRoll, oppRoll, result }
}

// 동점 재대결 포함 — 승패가 결정될 때까지 반복
export function resolveRound(
  myDie: Die,
  oppDie: Die
): { rolls: RollResult[]; winner: 'me' | 'opp' } {
  const rolls: RollResult[] = []
  while (true) {
    const roll = rollRound(myDie, oppDie)
    rolls.push(roll)
    if (roll.result === 'win') return { rolls, winner: 'me' }
    if (roll.result === 'lose') return { rolls, winner: 'opp' }
  }
}

export function createInitialGameState(): GameState {
  return { round: 1, myWins: 0, oppWins: 0, rolls: [], finished: false, winner: null }
}

export function applyRoundResult(
  state: GameState,
  rolls: RollResult[],
  winner: 'me' | 'opp'
): GameState {
  const myWins = state.myWins + (winner === 'me' ? 1 : 0)
  const oppWins = state.oppWins + (winner === 'opp' ? 1 : 0)
  const finished = myWins >= 2 || oppWins >= 2
  return {
    round: state.round + 1,
    myWins,
    oppWins,
    rolls,
    finished,
    winner: finished ? (myWins >= 2 ? 'me' : 'opp') : null,
  }
}
```

### `src/index.ts`

```typescript
export * from './types'
export * from './validator'
export * from './engine'
```

---

## 1-5. 단위 테스트

### `src/engine.test.ts`

```typescript
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
    const r = validateDraftPick({ diceIds: ['a', 'b', 'c'] }, validDeck())
    expect(r.valid).toBe(true)
  })
  it('덱에 없는 id → 실패', () => {
    const r = validateDraftPick({ diceIds: ['a', 'b', 'z'] }, validDeck())
    expect(r.valid).toBe(false)
  })
  it('중복 선택 → 실패', () => {
    const r = validateDraftPick({ diceIds: ['a', 'a', 'b'] }, validDeck())
    expect(r.valid).toBe(false)
  })
})

// ── engine ─────────────────────────────────────────────────────

describe('resolveRound', () => {
  it('winner 는 항상 me | opp', () => {
    const { winner } = resolveRound(die([6,6,6,1,1,1]), die([4,4,4,3,3,3]))
    expect(['me', 'opp']).toContain(winner)
  })
  it('rolls 는 최소 1개 이상', () => {
    const { rolls } = resolveRound(die([3,3,3,3,3,6]), die([3,3,3,3,3,6]))
    expect(rolls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('applyRoundResult', () => {
  it('2선승 → 게임 종료', () => {
    let s = createInitialGameState()
    s = applyRoundResult(s, [], 'me')
    s = applyRoundResult(s, [], 'me')
    expect(s.finished).toBe(true)
    expect(s.winner).toBe('me')
  })
  it('1승 1패 → 게임 계속', () => {
    let s = createInitialGameState()
    s = applyRoundResult(s, [], 'me')
    s = applyRoundResult(s, [], 'opp')
    expect(s.finished).toBe(false)
  })
})
```

### 실행

```bash
cd packages/core
pnpm test
```

---

## 1-6. `@dice-game/client` 초기화

```bash
cd packages/client
pnpm create vite . --template react-ts
pnpm add zustand
pnpm add -D @types/node
```

### `packages/client/package.json` — core 의존성 추가

```json
{
  "dependencies": {
    "@dice-game/core": "workspace:*"
  }
}
```

### `packages/client/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

---

## 1-7. 덱 빌더 UI

### 컴포넌트 구조

```
src/
├── App.tsx
├── store/
│   └── deckStore.ts          ← Zustand: 덱 상태 관리
└── components/
    ├── DeckBuilder/
    │   ├── DeckBuilder.tsx    ← 주사위 4개 나열
    │   ├── DieEditor.tsx      ← 눈 6개 입력 + 합계 실시간 표시
    │   └── FaceInput.tsx      ← 단일 눈 입력 (숫자)
    └── shared/
        └── SumBadge.tsx       ← "합계: 21 / 21" 표시
```

### `src/store/deckStore.ts`

```typescript
import { create } from 'zustand'
import { validateDeck } from '@dice-game/core'
import type { Deck, Die } from '@dice-game/core'

interface DeckStore {
  deck: Deck
  isValid: boolean
  updateFace: (dieIndex: number, faceIndex: number, value: number) => void
  updateDieName: (dieIndex: number, name: string) => void
}

const defaultDeck = (): Deck => ({
  id: crypto.randomUUID(),
  name: '내 덱',
  dice: Array.from({ length: 4 }, (_, i) => ({
    id: `die-${i}`,
    faces: [1, 2, 3, 4, 5, 6] as Die['faces'],
  })) as Deck['dice'],
})

export const useDeckStore = create<DeckStore>((set) => ({
  deck: defaultDeck(),
  isValid: true,

  updateFace: (dieIndex, faceIndex, value) =>
    set(state => {
      const dice = structuredClone(state.deck.dice)
      dice[dieIndex].faces[faceIndex] = value
      const deck = { ...state.deck, dice }
      return { deck, isValid: validateDeck(deck).valid }
    }),

  updateDieName: (dieIndex, name) =>
    set(state => {
      const dice = structuredClone(state.deck.dice)
      // Die 에 name 필드가 없으므로 Deck name 만 관리하거나 확장 필요
      return state
    }),
}))
```

### 핵심 규칙

- 눈 입력 시 합계를 실시간으로 표시 (`합계: 18 / 21` 등)
- 합계가 21이 아니면 저장 버튼 비활성화
- 각 눈은 0 이상 정수만 허용

---

## 1-8. 로컬 게임 시뮬레이터

싱글플레이어 — 상대는 로컬에서 AI(랜덤) 처리

### 컴포넌트 구조

```
src/components/
└── Simulator/
    ├── Simulator.tsx        ← 게임 전체 흐름 조율
    ├── DraftPhase.tsx       ← 3개 선택 + 순서 지정
    ├── RoundPhase.tsx       ← 라운드 진행 + 굴리기
    └── ResultScreen.tsx     ← 최종 승패
```

### 게임 흐름 (로컬)

```
덱 빌더 완료
  → 드래프트: 내 4개 중 3개 선택 + 순서 지정
  → 상대 덱 자동 생성 (랜덤 유효 주사위)
  → 라운드 1: resolveRound() → 결과 표시
  → 라운드 2: resolveRound() → 결과 표시
  → (필요 시) 라운드 3
  → 2선승 시 ResultScreen
```

### 상대 덱 자동 생성 (임시)

```typescript
// src/simulator/aiDeck.ts
import type { Deck, Die } from '@dice-game/core'

// 합계 21이 되도록 랜덤 생성
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
```

---

## 1-9. 주사위 굴리기 애니메이션 (초안)

CSS만 사용하는 간단한 애니메이션으로 시작.

```css
/* src/components/Simulator/die-animation.css */
@keyframes diceRoll {
  0%   { transform: rotate(0deg) scale(1); }
  25%  { transform: rotate(180deg) scale(1.1); }
  75%  { transform: rotate(540deg) scale(0.9); }
  100% { transform: rotate(720deg) scale(1); }
}

.die-rolling {
  animation: diceRoll 0.6s ease-out;
}
```

Phase 3에서 3D 주사위로 교체 예정.

---

## 완료 기준 (Definition of Done)

1. `pnpm test` — core 단위 테스트 전부 통과
2. `pnpm dev:client` — 브라우저에서 덱 빌더로 주사위 4개 설계 가능
3. 합계 21 미달 시 진행 불가 처리 확인
4. 시뮬레이터에서 AI 상대와 게임 3라운드 완주 가능
5. 동점 재대결이 시각적으로 구분되어 표시됨

---

## 다음 단계

Phase 1 완료 후 → [PHASE-2.md](./PHASE-2.md)

DB 스키마, 인증, Socket.io 실시간 1대1 매칭 구현
