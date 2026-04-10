import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { validateDeck } from '@dice-game/core'
import type { Deck, Die } from '@dice-game/core'

interface DeckStore {
  deck: Deck
  serverId: string | null   // 서버에 저장된 덱 ID (없으면 null)
  isValid: boolean
  updateFace: (dieIndex: number, faceIndex: number, value: number) => void
  setName: (name: string) => void
  setServerId: (id: string | null) => void
  resetDeck: () => void
}

const defaultDeck = (): Deck => ({
  id: crypto.randomUUID(),
  name: '내 덱',
  dice: Array.from({ length: 4 }, (_, i) => ({
    id: `die-${i}`,
    faces: [1, 2, 3, 4, 5, 6] as Die['faces'],
  })) as Deck['dice'],
})

export const useDeckStore = create<DeckStore>()(
  persist(
    (set) => ({
      deck: defaultDeck(),
      serverId: null,
      isValid: true,

      updateFace: (dieIndex, faceIndex, value) =>
        set(state => {
          const dice = structuredClone(state.deck.dice)
          dice[dieIndex].faces[faceIndex] = value
          const deck = { ...state.deck, dice }
          return { deck, isValid: validateDeck(deck).valid }
        }),

      setName: (name) =>
        set(state => ({ deck: { ...state.deck, name } })),

      setServerId: (id) => set({ serverId: id }),

      resetDeck: () => set({ deck: defaultDeck(), serverId: null, isValid: true }),
    }),
    {
      name: 'dice-deck',
      partialize: (state) => ({
        deck: state.deck,
        serverId: state.serverId,
        isValid: state.isValid,
      }),
    }
  )
)
