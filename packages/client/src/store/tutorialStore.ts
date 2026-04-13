import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TutorialStore {
  isDone: boolean
  markDone: () => void
  replayTutorial: () => void
}

export const useTutorialStore = create<TutorialStore>()(
  persist(
    (set) => ({
      isDone: false,
      markDone: () => set({ isDone: true }),
      replayTutorial: () => set({ isDone: false }),
    }),
    { name: 'dice-tutorial' }
  )
)
