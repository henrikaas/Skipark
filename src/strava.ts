import type { User } from 'firebase/auth'

export function getStravaApiBase() {
  const configured = import.meta.env.VITE_STRAVA_API_BASE?.trim()
  return configured || '/api/strava'
}

export type ParsedSkiReport = {
  id: number | null
  weather: string | null
  temperature: number | null
  snow: string | null
  feeling: number | null
  comment: string | null
}

export type SyncedNordicActivity = {
  stravaActivityId: string
  name: string
  sportType: string
  type: string
  startDate: string
  distanceMeters: number | null
  distanceKm: number | null
  movingTimeSeconds: number | null
  movingTimeMinutes: number | null
  privateNote: string
  skiId: string | null
  matchedSkiName: string | null
  parsedReport: ParsedSkiReport | null
  parseError: string | null
  saved: boolean
}

export type NordicSyncResult = {
  count: number
  syncedAt: string
  activities: SyncedNordicActivity[]
}

export async function connectToStrava(user: User) {
  const idToken = await user.getIdToken()
  const response = await fetch(`${getStravaApiBase()}/auth/start`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      returnTo: `${window.location.origin}/strava/callback`,
    }),
  })

  let payload: { authorizeUrl?: string; error?: string } = {}
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    payload = (await response.json()) as { authorizeUrl?: string; error?: string }
  } else {
    const text = await response.text()
    payload.error = text || 'Could not start Strava OAuth.'
  }

  if (!response.ok || !payload.authorizeUrl) {
    const detail =
      payload.error?.trim() ||
      `Unexpected Strava auth start response (${response.status} ${response.statusText || 'unknown status'}).`
    throw new Error(detail)
  }

  window.location.assign(payload.authorizeUrl)
}

export async function syncLatestNordicActivities(user: User) {
  const idToken = await user.getIdToken()
  const response = await fetch(`${getStravaApiBase()}/sync/latest-nordic`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
  })

  const contentType = response.headers.get('content-type') ?? ''
  let payload: NordicSyncResult | { error?: string } | null = null

  if (contentType.includes('application/json')) {
    payload = (await response.json()) as NordicSyncResult | { error?: string }
  } else {
    const text = await response.text()
    payload = { error: text || 'Could not sync Nordic ski activities.' }
  }

  if (!response.ok) {
    const message =
      payload && 'error' in payload && payload.error
        ? payload.error
        : `Unexpected sync response (${response.status} ${response.statusText || 'unknown status'}).`
    throw new Error(message)
  }

  return payload as NordicSyncResult
}
