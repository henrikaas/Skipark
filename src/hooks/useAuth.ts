import { useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String((e as { code?: string }).code)
          : ''
      if (code === 'auth/popup-closed-by-user') return
      const message = e instanceof Error ? e.message : 'Sign-in failed'
      setError(message)
    }
  }, [])

  const signOutUser = useCallback(async () => {
    setError(null)
    await signOut(auth)
  }, [])

  return { user, loading, error, signInWithGoogle, signOutUser }
}
