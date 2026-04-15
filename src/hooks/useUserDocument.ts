import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { db, type UserDocument, userDocRef } from '../firebase'

export function useUserDocument(uid: string | undefined) {
  const [data, setData] = useState<UserDocument | null>(null)
  const [loading, setLoading] = useState(Boolean(uid))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    const ref = userDocRef(db, uid)

    return onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as UserDocument) : null)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
  }, [uid])

  return { data, loading, error }
}
