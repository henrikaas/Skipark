import {
  type Firestore,
  Timestamp,
  collection,
  doc,
} from 'firebase/firestore'

export { Timestamp }

/** Top-level collection: `users` */
export const USERS_COLLECTION = 'users' as const

/** Subcollections under `users/{uid}` */
export const SKIS_SUBCOLLECTION = 'skis' as const
export const ACTIVITIES_SUBCOLLECTION = 'activities' as const

/**
 * Strava connection map stored on `users/{uid}` (field `strava`).
 */
export interface UserStravaState {
  connected: boolean
  athleteId: string
  scopes: string[]
  tokenExpiresAt: Timestamp
}

/**
 * Profile map on `users/{uid}` (field `profile`).
 * Extend when you persist extra fields from Auth or settings.
 */
export interface UserProfile {
  displayName?: string
  email?: string
  weatherLocation?: {
    name: string
    lat: number
    lon: number
  }
}

/**
 * Document shape for `users/{uid}`.
 * Nested `skis` and `activities` are subcollections, not fields on this doc.
 */
export interface UserDocument {
  profile?: UserProfile
  strava?: UserStravaState
}

/** Inclusive °C range for intended temperature slider (new skis). */
export const SKI_INTENDED_TEMP_MIN = -15
export const SKI_INTENDED_TEMP_MAX = 5

/**
 * Document shape for `users/{uid}/skis/{skiId}`.
 * Older documents may only have `intended_condition`; new writes use `intendedTempC` and `skiName`.
 */
export interface SkiDocument {
  brand: string
  grind: string
  base: string
  createdAt: Timestamp
  isActive: boolean
  skiName?: string
  intendedTempC?: number
  details?: string
  ra?: number
  /** Legacy; omitted on new documents */
  intended_condition?: string
}

/** Activity feeling score (0–10) after a ski outing. */
export type ActivityFeeling = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/**
 * Document shape for `users/{uid}/activities/{activityId}`.
 * `skiId` is null until matched to a pair in your ski park.
 */
export interface ActivityDocument {
  stravaActivityId: string
  name: string
  sportType: string
  startDate: Timestamp
  distance: number
  elapsedTime: number
  raw: Record<string, unknown>
  skiId: string | null
  comment: string
  condition: string
  snow_condition: string
  feeling: ActivityFeeling | null
  createdAt: Timestamp
}

export function userDocRef(db: Firestore, uid: string) {
  return doc(db, USERS_COLLECTION, uid)
}

export function skisCollectionRef(db: Firestore, uid: string) {
  return collection(db, USERS_COLLECTION, uid, SKIS_SUBCOLLECTION)
}

export function skiDocRef(db: Firestore, uid: string, skiId: string) {
  return doc(db, USERS_COLLECTION, uid, SKIS_SUBCOLLECTION, skiId)
}

export function activitiesCollectionRef(db: Firestore, uid: string) {
  return collection(db, USERS_COLLECTION, uid, ACTIVITIES_SUBCOLLECTION)
}

export function activityDocRef(db: Firestore, uid: string, activityId: string) {
  return doc(db, USERS_COLLECTION, uid, ACTIVITIES_SUBCOLLECTION, activityId)
}
