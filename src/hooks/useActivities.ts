import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { activitiesCollectionRef, db, type ActivityDocument } from '../firebase'

export type ActivityWithId = { id: string; data: ActivityDocument }

type ActivityCache = { uid: string; activities: ActivityWithId[] }

export function useActivities(uid: string | undefined) {
  const [cache, setCache] = useState<ActivityCache | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    const q = query(activitiesCollectionRef(db, uid), orderBy('startDate', 'desc'))

    return onSnapshot(
      q,
      (snap) => {
        setCache({
          uid,
          activities: snap.docs.map((doc) => ({
            id: doc.id,
            data: doc.data() as ActivityDocument,
          })),
        })
        setError(null)
      },
      (err) => {
        setError(err.message)
      },
    )
  }, [uid])

  const activities = useMemo(() => {
    if (!uid || !cache || cache.uid !== uid) return []
    return cache.activities
  }, [uid, cache])

  const loading = Boolean(uid) && (!cache || cache.uid !== uid) && !error
  return { activities, loading, error: uid ? error : null }
}
