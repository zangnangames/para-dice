import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

export const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: (cb) => {
    const token = localStorage.getItem('dice-auth')
      ? JSON.parse(localStorage.getItem('dice-auth')!).state?.token
      : null
    cb({ token })
  },
})
