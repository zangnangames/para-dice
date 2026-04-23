import { useAuthStore } from '@/store/authStore'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('dice-auth')
    return raw ? JSON.parse(raw).state?.token ?? null : null
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    if (res.status === 401) {
      useAuthStore.getState().logout()
      localStorage.removeItem('dice-auth')
    }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  auth: {
    me: () => request<{ id: string; nickname: string; email: string; avatarUrl: string | null }>('/auth/me'),
    updateMe: (nickname: string) =>
      request<{ id: string; nickname: string }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ nickname }),
      }),
  },
  decks: {
    list: () => request<any[]>('/decks'),
    create: (name: string, dice: Array<{ faces: number[] }>) =>
      request('/decks', { method: 'POST', body: JSON.stringify({ name, dice }) }),
    update: (id: string, name: string, dice: Array<{ faces: number[] }>) =>
      request(`/decks/${id}`, { method: 'PUT', body: JSON.stringify({ name, dice }) }),
    remove: (id: string) => request(`/decks/${id}`, { method: 'DELETE' }),
  },
  stats: {
    user: (userId: string) => request<{
      totalWins: number
      totalLosses: number
      currentStreak: number
      maxStreak: number
    }>(`/stats/users/${userId}/stats`),
    matches: (userId: string) =>
      request<{ matches: any[] }>(`/stats/users/${userId}/matches`),
    deck: (deckId: string) => request<{
      totalGames: number; wins: number; losses: number; winRate: number | null
    }>(`/stats/decks/${deckId}/stats`),
    rankings: () => request<any[]>('/stats/decks/rankings'),
    recordAiMatch: (deckId: string, result: 'win' | 'lose') =>
      request('/stats/ai-match', { method: 'POST', body: JSON.stringify({ deckId, result }) }),
  },
}
