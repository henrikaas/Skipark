import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import {
  db,
  skisCollectionRef,
  SKI_INTENDED_TEMP_MAX,
  SKI_INTENDED_TEMP_MIN,
  type SkiDocument,
} from '../firebase'

export type SkiInput = {
  skiName: string
  brand: string
  grind: string
  base: string
  intendedTempC: number
  isActive: boolean
  details: string
  /** Set only when user provided a valid RA (2–4, one decimal). */
  ra?: number
}

export type SkiWithId = { id: string; data: SkiDocument }

type SkiCache = { uid: string; skis: SkiWithId[] }

function clampIntendedTempC(value: number): number {
  const n = Math.round(Number(value))
  if (Number.isNaN(n)) return 0
  return Math.min(SKI_INTENDED_TEMP_MAX, Math.max(SKI_INTENDED_TEMP_MIN, n))
}

export function useSkis(uid: string | undefined) {
  const [cache, setCache] = useState<SkiCache | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    const col = skisCollectionRef(db, uid)
    const q = query(col, orderBy('createdAt', 'desc'))

    return onSnapshot(
      q,
      (snap) => {
        setCache({
          uid,
          skis: snap.docs.map((d) => ({
            id: d.id,
            data: d.data() as SkiDocument,
          })),
        })
        setError(null)
      },
      (err) => {
        setError(err.message)
      },
    )
  }, [uid])

  const skis = useMemo(() => {
    if (!uid || !cache || cache.uid !== uid) return []
    return cache.skis
  }, [uid, cache])

  const loading = Boolean(uid) && (!cache || cache.uid !== uid) && !error

  const listError = uid ? error : null

  const addSki = useCallback(
    async (input: SkiInput) => {
      if (!uid) throw new Error('You must be signed in to add skis.')

      const intendedTempC = clampIntendedTempC(input.intendedTempC)

      const payload: SkiDocument = {
        skiName: input.skiName.trim(),
        brand: input.brand.trim(),
        grind: input.grind.trim(),
        base: input.base.trim(),
        intendedTempC,
        details: input.details.trim(),
        isActive: input.isActive,
        createdAt: Timestamp.now(),
      }

      if (input.ra !== undefined) {
        payload.ra = input.ra
      }

      const ref = doc(skisCollectionRef(db, uid))
      await setDoc(ref, payload)
    },
    [uid],
  )

  return { skis, loading, error: listError, addSki }
}
