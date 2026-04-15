import crypto from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'

initializeApp()

const db = getFirestore()
const auth = getAuth()

const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities'
const STRAVA_ACTIVITY_URL = 'https://www.strava.com/api/v3/activities'
const STRAVA_SCOPE = process.env.STRAVA_SCOPE ?? 'read,activity:read_all'
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? ''
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? ''
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI ?? ''
const STRAVA_STATE_SECRET = process.env.STRAVA_STATE_SECRET ?? ''
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const WEATHER_USER_AGENT =
  process.env.WEATHER_USER_AGENT ?? 'Skipark/0.1 (henrikaas local development)'

function json(res, status, body) {
  res.status(status).json(body)
}

function getBearerToken(req) {
  const header = req.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null
  return token
}

function requireStravaConfig() {
  const missing = []
  if (!STRAVA_CLIENT_ID) missing.push('STRAVA_CLIENT_ID')
  if (!STRAVA_CLIENT_SECRET) missing.push('STRAVA_CLIENT_SECRET')
  if (!STRAVA_REDIRECT_URI) missing.push('STRAVA_REDIRECT_URI')
  if (!STRAVA_STATE_SECRET) missing.push('STRAVA_STATE_SECRET')
  return missing
}

function requireGeminiConfig() {
  const missing = []
  if (!GEMINI_API_KEY) missing.push('GEMINI_API_KEY')
  return missing
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function roundCoordinate(value) {
  return Math.round(Number(value) * 10000) / 10000
}

async function geocodeLocation(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')

  const response = await fetch(url, {
    headers: {
      'user-agent': WEATHER_USER_AGENT,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Location lookup failed (${response.status}): ${text}`)
  }

  const results = await response.json()
  const first = Array.isArray(results) ? results[0] : null
  if (!first?.lat || !first?.lon) {
    throw new Error('No location match found.')
  }

  return {
    name: String(first.display_name ?? query),
    lat: roundCoordinate(first.lat),
    lon: roundCoordinate(first.lon),
  }
}

async function reverseGeocodeLocation(lat, lon) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(roundCoordinate(lat)))
  url.searchParams.set('lon', String(roundCoordinate(lon)))
  url.searchParams.set('format', 'jsonv2')

  const response = await fetch(url, {
    headers: {
      'user-agent': WEATHER_USER_AGENT,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Reverse geocoding failed (${response.status}): ${text}`)
  }

  const payload = await response.json()
  const address = payload?.address ?? {}
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    address.county ||
    payload?.name ||
    payload?.display_name

  return {
    name: String(locality ?? '').trim() || 'Current location',
    lat: roundCoordinate(lat),
    lon: roundCoordinate(lon),
  }
}

function summarizeForecast(payload, location) {
  const timeseries = payload?.properties?.timeseries
  if (!Array.isArray(timeseries) || timeseries.length === 0) {
    throw new Error('YR returned no forecast data.')
  }

  const current = timeseries[0]
  const currentDetails = current?.data?.instant?.details ?? {}
  const nextHour = current?.data?.next_1_hours ?? current?.data?.next_6_hours ?? null
  const nextSix = current?.data?.next_6_hours ?? null

  return {
    location,
    updatedAt: payload?.properties?.meta?.updated_at ?? current?.time ?? new Date().toISOString(),
    airTemperature: currentDetails.air_temperature ?? null,
    windSpeed: currentDetails.wind_speed ?? null,
    cloudAreaFraction: currentDetails.cloud_area_fraction ?? null,
    symbolCode: nextHour?.summary?.symbol_code ?? nextSix?.summary?.symbol_code ?? null,
    precipitationNextHour: nextHour?.details?.precipitation_amount ?? null,
    precipitationNext6Hours: nextSix?.details?.precipitation_amount ?? null,
  }
}

async function fetchYrForecast(location) {
  const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact')
  url.searchParams.set('lat', String(roundCoordinate(location.lat)))
  url.searchParams.set('lon', String(roundCoordinate(location.lon)))

  const response = await fetch(url, {
    headers: {
      'user-agent': WEATHER_USER_AGENT,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`YR forecast failed (${response.status}): ${text}`)
  }

  const payload = await response.json()
  return summarizeForecast(payload, {
    name: location.name,
    lat: roundCoordinate(location.lat),
    lon: roundCoordinate(location.lon),
  })
}

function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', STRAVA_STATE_SECRET)
    .update(encoded)
    .digest('base64url')
  return `${encoded}.${signature}`
}

function verifyState(rawState) {
  const [encoded, signature] = String(rawState ?? '').split('.')
  if (!encoded || !signature) {
    throw new Error('Missing or invalid OAuth state.')
  }

  const expected = crypto
    .createHmac('sha256', STRAVA_STATE_SECRET)
    .update(encoded)
    .digest('base64url')

  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('OAuth state signature mismatch.')
  }

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  if (!payload?.uid || !payload?.nonce || !payload?.returnTo) {
    throw new Error('OAuth state payload is incomplete.')
  }
  if (typeof payload.issuedAt !== 'number' || Date.now() - payload.issuedAt > 15 * 60 * 1000) {
    throw new Error('OAuth state has expired.')
  }
  return payload
}

function buildAuthorizeUrl(state) {
  const url = new URL(STRAVA_AUTHORIZE_URL)
  url.searchParams.set('client_id', STRAVA_CLIENT_ID)
  url.searchParams.set('redirect_uri', STRAVA_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', STRAVA_SCOPE)
  url.searchParams.set('state', state)
  return url.toString()
}

function sanitizeReturnTo(value) {
  try {
    const url = new URL(String(value ?? ''), FRONTEND_URL)
    const allowedOrigin = new URL(FRONTEND_URL).origin
    if (url.origin !== allowedOrigin) return `${allowedOrigin}/strava/callback`
    return url.toString()
  } catch {
    return `${FRONTEND_URL.replace(/\/$/, '')}/strava/callback`
  }
}

async function exchangeCodeForToken(code) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${text}`)
  }

  return await response.json()
}

async function refreshStravaToken(refreshToken) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token refresh failed (${response.status}): ${text}`)
  }

  return await response.json()
}

async function getUserStravaTokens(uid) {
  const tokenRef = db.doc(`users/${uid}/private/stravaTokens`)
  const tokenSnap = await tokenRef.get()
  if (!tokenSnap.exists) {
    throw new Error('No Strava tokens stored for this user. Reconnect Strava first.')
  }

  const token = tokenSnap.data() ?? {}
  return { tokenRef, token }
}

async function persistStravaTokens(uid, token) {
  const athleteId =
    token?.athlete && typeof token.athlete === 'object' && 'id' in token.athlete
      ? String(token.athlete.id)
      : ''
  const scopes = String(token.scope ?? STRAVA_SCOPE)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  await db.doc(`users/${uid}`).set(
    {
      strava: {
        connected: true,
        athleteId,
        scopes,
        tokenExpiresAt: Timestamp.fromMillis(Number(token.expires_at ?? 0) * 1000),
      },
    },
    { merge: true },
  )

  await db.doc(`users/${uid}/private/stravaTokens`).set(
    {
      accessToken: token.access_token ?? '',
      refreshToken: token.refresh_token ?? '',
      expiresAt: Number(token.expires_at ?? 0),
      scope: token.scope ?? STRAVA_SCOPE,
      athlete: token.athlete ?? null,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  )
}

async function ensureValidAccessToken(uid) {
  const { token } = await getUserStravaTokens(uid)
  const accessToken = typeof token.accessToken === 'string' ? token.accessToken : ''
  const refreshToken = typeof token.refreshToken === 'string' ? token.refreshToken : ''
  const expiresAt = Number(token.expiresAt ?? 0)
  const now = Math.floor(Date.now() / 1000)
  const shouldRefresh = Boolean(refreshToken && expiresAt && now >= expiresAt - 60)

  if (accessToken && !shouldRefresh) {
    return accessToken
  }

  if (!refreshToken) {
    throw new Error('Missing Strava refresh token. Reconnect Strava first.')
  }

  const refreshed = await refreshStravaToken(refreshToken)
  await persistStravaTokens(uid, refreshed)
  return refreshed.access_token
}

async function stravaGetActivities(accessToken, { perPage = 30, page = 1 } = {}) {
  const url = new URL(STRAVA_ACTIVITIES_URL)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Activities fetch failed (${response.status}): ${text}`)
  }

  return await response.json()
}

async function stravaGetActivity(activityId, accessToken) {
  const url = new URL(`${STRAVA_ACTIVITY_URL}/${activityId}`)
  url.searchParams.set('include_all_efforts', 'false')

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Activity detail fetch failed (${response.status}): ${text}`)
  }

  return await response.json()
}

function skiReportSchema() {
  return {
    type: 'object',
    properties: {
      id: {
        type: ['integer', 'null'],
        description: 'Ski ID / pair identifier if present in the note.',
      },
      weather: {
        type: ['string', 'null'],
        description: 'Short weather description from the note.',
      },
      temperature: {
        type: ['integer', 'null'],
        description: 'Temperature in celsius if present.',
      },
      snow: {
        type: ['string', 'null'],
        enum: ['Gammel', 'Tørr nysnø', 'Våt nysnø', 'Is', 'skitten snø', null],
        description: 'Choose exactly one allowed label or null.',
      },
      feeling: {
        type: ['integer', 'null'],
        description: 'Feeling score from 0 to 10 if present in the note.',
      },
      comment: {
        type: ['string', 'null'],
        description: 'Any remaining relevant note text.',
      },
    },
    required: ['id', 'weather', 'temperature', 'snow', 'feeling', 'comment'],
    additionalProperties: false,
  }
}

async function parseSkiReportText(text) {
  const missing = requireGeminiConfig()
  if (missing.length > 0) {
    throw new Error(`Missing backend env: ${missing.join(', ')}`)
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  'Extract a Norwegian ski report into structured JSON. ' +
                  'Snow must be exactly one of: Gammel, Tørr nysnø, Våt nysnø, Is, skitten snø. ' +
                  'If the note mentions new snow but not explicitly wet/dry, infer from temperature. ' +
                  'ID means ski pair id. Feeling is 0 to 10. Put leftover relevant text in comment.\n' +
                  text,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: skiReportSchema(),
        },
      }),
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini parsing failed (${response.status}): ${body}`)
  }

  const payload = await response.json()
  const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) {
    throw new Error('Gemini returned no structured output.')
  }

  return JSON.parse(rawText)
}

function mapActivitySummary(activity) {
  const distance = typeof activity.distance === 'number' ? activity.distance : null
  const movingTime = typeof activity.moving_time === 'number' ? activity.moving_time : null
  return {
    stravaActivityId: String(activity.id ?? ''),
    name: activity.name ?? '(no name)',
    sportType: activity.sport_type ?? activity.type ?? '',
    type: activity.type ?? '',
    startDate: activity.start_date_local ?? activity.start_date ?? '',
    distanceMeters: distance,
    distanceKm: distance === null ? null : Number((distance / 1000).toFixed(2)),
    movingTimeSeconds: movingTime,
    movingTimeMinutes: movingTime === null ? null : Math.round(movingTime / 60),
    privateNote: typeof activity.private_note === 'string' ? activity.private_note : '',
    skiId: null,
    matchedSkiName: null,
    saved: false,
  }
}

async function loadSkisByKey(uid) {
  const snap = await db.collection(`users/${uid}/skis`).get()
  const byKey = new Map()

  for (const doc of snap.docs) {
    const data = doc.data() ?? {}
    const keys = [doc.id, data.skiName]
      .map((value) => normalizeKey(value))
      .filter(Boolean)

    for (const key of keys) {
      byKey.set(key, {
        id: doc.id,
        skiName: typeof data.skiName === 'string' ? data.skiName : doc.id,
      })
    }
  }

  return byKey
}

function toTimestamp(value) {
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) return Timestamp.now()
  return Timestamp.fromDate(date)
}

function normalizeFeeling(value) {
  if (!Number.isInteger(value)) return null
  if (value < 0 || value > 10) return null
  return value
}

async function saveSyncedActivity(uid, activity, parsedReport, skiMatch) {
  const ref = db.doc(`users/${uid}/activities/${activity.id}`)
  const existing = await ref.get()
  const existingData = existing.data() ?? {}
  const feeling = normalizeFeeling(parsedReport?.feeling ?? null)

  await ref.set(
    {
      stravaActivityId: String(activity.id),
      name: activity.name ?? '(no name)',
      sportType: activity.sport_type ?? activity.type ?? '',
      startDate: toTimestamp(activity.start_date_local ?? activity.start_date),
      distance: typeof activity.distance === 'number' ? activity.distance : 0,
      elapsedTime:
        typeof activity.elapsed_time === 'number'
          ? activity.elapsed_time
          : typeof activity.moving_time === 'number'
            ? activity.moving_time
            : 0,
      raw: activity,
      skiId: skiMatch?.id ?? null,
      comment: parsedReport?.comment ?? '',
      condition: parsedReport?.weather ?? '',
      snow_condition: parsedReport?.snow ?? '',
      feeling,
      createdAt: existingData.createdAt ?? FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}

async function handleNordicActivitiesSync(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed.' })
    return
  }

  const missingStrava = requireStravaConfig()
  if (missingStrava.length > 0) {
    json(res, 500, { error: `Missing backend env: ${missingStrava.join(', ')}` })
    return
  }

  const missingGemini = requireGeminiConfig()
  if (missingGemini.length > 0) {
    json(res, 500, { error: `Missing backend env: ${missingGemini.join(', ')}` })
    return
  }

  const idToken = getBearerToken(req)
  if (!idToken) {
    json(res, 401, { error: 'Missing Firebase ID token.' })
    return
  }

  const decoded = await auth.verifyIdToken(idToken)
  const accessToken = await ensureValidAccessToken(decoded.uid)
  const skisByKey = await loadSkisByKey(decoded.uid)

  const wanted = 5
  const perPage = 50
  const maxPages = 10
  const nordicActivityIds = []

  for (let page = 1; nordicActivityIds.length < wanted && page <= maxPages; page += 1) {
    const activities = await stravaGetActivities(accessToken, { perPage, page })
    for (const activity of activities) {
      if (activity?.sport_type === 'NordicSki' && activity?.id !== undefined && activity?.id !== null) {
        nordicActivityIds.push(activity.id)
        if (nordicActivityIds.length >= wanted) break
      }
    }
    if (activities.length === 0) break
  }

  const items = await Promise.all(
    nordicActivityIds.slice(0, wanted).map(async (activityId) => {
      try {
        const activity = await stravaGetActivity(activityId, accessToken)
        const summary = mapActivitySummary(activity)

        if (!summary.privateNote.trim()) {
          await saveSyncedActivity(decoded.uid, activity, null, null)
          return {
            ...summary,
            parsedReport: null,
            parseError: 'No private_note found for this activity.',
            saved: true,
          }
        }

        try {
          const parsedReport = await parseSkiReportText(summary.privateNote)
          const parsedSkiKey = normalizeKey(parsedReport?.id)
          const skiMatch = parsedSkiKey ? skisByKey.get(parsedSkiKey) ?? null : null
          await saveSyncedActivity(decoded.uid, activity, parsedReport, skiMatch)
          return {
            ...summary,
            skiId: skiMatch?.id ?? null,
            matchedSkiName: skiMatch?.skiName ?? null,
            parsedReport,
            parseError: null,
            saved: true,
          }
        } catch (err) {
          await saveSyncedActivity(decoded.uid, activity, null, null)
          return {
            ...summary,
            parsedReport: null,
            parseError: err instanceof Error ? err.message : 'Could not parse private note.',
            saved: true,
          }
        }
      } catch (err) {
        return {
          stravaActivityId: String(activityId),
          name: `Activity ${activityId}`,
          sportType: 'NordicSki',
          type: '',
          startDate: '',
          distanceMeters: null,
          distanceKm: null,
          movingTimeSeconds: null,
          movingTimeMinutes: null,
          privateNote: '',
          skiId: null,
          matchedSkiName: null,
          parsedReport: null,
          parseError: err instanceof Error ? err.message : 'Could not fetch activity details.',
          saved: false,
        }
      }
    }),
  )

  json(res, 200, {
    count: items.length,
    syncedAt: new Date().toISOString(),
    activities: items,
  })
}

async function handleWeatherForecast(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed.' })
    return
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {}
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  const hasCoords =
    typeof body.lat === 'number' && Number.isFinite(body.lat) &&
    typeof body.lon === 'number' && Number.isFinite(body.lon)

  if (!query && !hasCoords) {
    json(res, 400, { error: 'Provide a location query or coordinates.' })
    return
  }

  const location = hasCoords
    ? await reverseGeocodeLocation(body.lat, body.lon)
    : await geocodeLocation(query)

  const forecast = await fetchYrForecast(location)
  json(res, 200, forecast)
}

async function handleAuthStart(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed.' })
    return
  }

  const missing = requireStravaConfig()
  if (missing.length > 0) {
    json(res, 500, { error: `Missing backend env: ${missing.join(', ')}` })
    return
  }

  const idToken = getBearerToken(req)
  if (!idToken) {
    json(res, 401, { error: 'Missing Firebase ID token.' })
    return
  }

  const decoded = await auth.verifyIdToken(idToken)
  const body = typeof req.body === 'object' && req.body ? req.body : {}
  const returnTo = sanitizeReturnTo(body.returnTo)
  const nonce = crypto.randomBytes(16).toString('hex')

  await db.doc(`users/${decoded.uid}/private/stravaOAuth`).set(
    {
      nonce,
      returnTo,
      createdAt: Timestamp.now(),
    },
    { merge: true },
  )

  const state = signState({
    uid: decoded.uid,
    nonce,
    returnTo,
    issuedAt: Date.now(),
  })

  json(res, 200, { authorizeUrl: buildAuthorizeUrl(state) })
}

async function handleAuthCallback(req, res) {
  const missing = requireStravaConfig()
  if (missing.length > 0) {
    res.status(500).type('text/plain').send(`Missing backend env: ${missing.join(', ')}`)
    return
  }

  const error = req.query.error ? String(req.query.error) : ''
  const rawState = req.query.state ? String(req.query.state) : ''
  let returnTo = `${FRONTEND_URL.replace(/\/$/, '')}/strava/callback`

  try {
    const state = verifyState(rawState)
    returnTo = sanitizeReturnTo(state.returnTo)

    const oauthRef = db.doc(`users/${state.uid}/private/stravaOAuth`)
    const oauthSnap = await oauthRef.get()
    const oauthData = oauthSnap.data()
    if (!oauthData?.nonce || oauthData.nonce !== state.nonce) {
      throw new Error('OAuth nonce mismatch.')
    }

    if (error) {
      const url = new URL(returnTo)
      url.searchParams.set('status', 'error')
      url.searchParams.set('error', error)
      res.redirect(url.toString())
      return
    }

    const code = req.query.code ? String(req.query.code) : ''
    if (!code) {
      throw new Error('Missing authorization code.')
    }

    const token = await exchangeCodeForToken(code)
    const scopes = String(token.scope ?? STRAVA_SCOPE)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const athleteId =
      token?.athlete && typeof token.athlete === 'object' && 'id' in token.athlete
        ? String(token.athlete.id)
        : ''

    await db.doc(`users/${state.uid}`).set(
      {
        strava: {
          connected: true,
          athleteId,
          scopes,
          tokenExpiresAt: Timestamp.fromMillis(Number(token.expires_at ?? 0) * 1000),
        },
      },
      { merge: true },
    )

    await db.doc(`users/${state.uid}/private/stravaTokens`).set(
      {
        accessToken: token.access_token ?? '',
        refreshToken: token.refresh_token ?? '',
        expiresAt: Number(token.expires_at ?? 0),
        scope: token.scope ?? STRAVA_SCOPE,
        athlete: token.athlete ?? null,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )

    await oauthRef.delete()

    const url = new URL(returnTo)
    url.searchParams.set('status', 'success')
    url.searchParams.set('connected', '1')
    res.redirect(url.toString())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Strava OAuth error.'
    const url = new URL(returnTo)
    url.searchParams.set('status', 'error')
    url.searchParams.set('error', message)
    res.redirect(url.toString())
  }
}

export const stravaApi = onRequest({ cors: true }, async (req, res) => {
  const path = typeof req.path === 'string' && req.path ? req.path : req.url || ''

  try {
    if (path.endsWith('/auth/start')) {
      await handleAuthStart(req, res)
      return
    }

    if (path.endsWith('/auth/callback')) {
      await handleAuthCallback(req, res)
      return
    }

    if (path.endsWith('/sync/latest-nordic')) {
      await handleNordicActivitiesSync(req, res)
      return
    }

    if (path.endsWith('/weather/forecast')) {
      await handleWeatherForecast(req, res)
      return
    }

    json(res, 404, { error: 'Not found.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    json(res, 500, { error: message })
  }
})
