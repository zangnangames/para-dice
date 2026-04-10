import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  userId: string
  nickname: string
  avatarUrl: string | null
}

interface AuthStore {
  token: string | null
  user: AuthUser | null
  login: (token: string, user: AuthUser) => void
  logout: () => void
  isLoggedIn: () => boolean
  updateUser: (patch: Partial<AuthUser>) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isLoggedIn: () => !!get().token,
      updateUser: (patch) =>
        set(state => state.user ? { user: { ...state.user, ...patch } } : {}),
    }),
    { name: 'dice-auth' }
  )
)
