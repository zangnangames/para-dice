import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProfileStore {
  avatarColor: string | null  // null = 닉네임 기반 자동 색상
  setAvatarColor: (color: string | null) => void
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      avatarColor: null,
      setAvatarColor: (color) => set({ avatarColor: color }),
    }),
    { name: 'dice-profile' }
  )
)
