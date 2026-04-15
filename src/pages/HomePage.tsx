import { type FormEvent, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { setDoc } from 'firebase/firestore'
import { useAuth } from '../hooks/useAuth'
import { useUserDocument } from '../hooks/useUserDocument'
import { db, userDocRef } from '../firebase'
import { syncLatestNordicActivities, type NordicSyncResult } from '../strava'
import { fetchWeatherForecast, type WeatherForecast, type WeatherLocation } from '../weather'
import './HomePage.css'

const LAST_USED = [
  {
    ski: 'Madshus Redline 2.0 Cold',
    date: 'Yesterday',
    feeling: '8/10',
    condition: 'Fresh snow, -6 °C, calm tracks',
  },
  {
    ski: 'Fischer Speedmax DP',
    date: '3 days ago',
    feeling: '6/10',
    condition: 'Transformed snow, -1 °C, glazing in turns',
  },
  {
    ski: 'Atomic S9 Gen S',
    date: 'Last week',
    feeling: '9/10',
    condition: 'Dry cold, -10 °C, firm and fast',
  },
] as const

function weatherIcon(symbolCode: string | null) {
  if (!symbolCode) return '☁️'

  if (symbolCode.includes('clearsky')) return '☀️'
  if (symbolCode.includes('fair')) return '🌤️'
  if (symbolCode.includes('partlycloudy')) return '⛅'
  if (symbolCode.includes('cloudy')) return '☁️'
  if (symbolCode.includes('fog')) return '🌫️'
  if (symbolCode.includes('sleet')) return '🌨️'
  if (symbolCode.includes('snow')) return '❄️'
  if (symbolCode.includes('rain')) return '🌧️'
  return '☁️'
}

export function HomePage() {
  const { user } = useAuth()
  const { data: userDoc } = useUserDocument(user?.uid)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<NordicSyncResult | null>(null)
  const [weatherQuery, setWeatherQuery] = useState(userDoc?.profile?.weatherLocation?.name ?? '')
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherForecast | null>(null)
  const [weatherEditorOpen, setWeatherEditorOpen] = useState(false)
  const isConnected = Boolean(userDoc?.strava?.connected)

  async function saveWeatherLocation(location: WeatherLocation) {
    if (!user) return

    await setDoc(
      userDocRef(db, user.uid),
      {
        profile: {
          weatherLocation: location,
        },
      },
      { merge: true },
    )
  }

  useEffect(() => {
    const savedLocation = userDoc?.profile?.weatherLocation
    if (!savedLocation) return

    setWeatherQuery(savedLocation.name)
    setWeatherLoading(true)
    setWeatherError(null)

    fetchWeatherForecast(savedLocation)
      .then((result) => {
        setWeather(result)
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Could not load weather.'
        setWeatherError(message)
      })
      .finally(() => {
        setWeatherLoading(false)
      })
  }, [userDoc?.profile?.weatherLocation])

  async function handleSyncNow() {
    if (!user) {
      setSyncError('Sign in before syncing Strava activities.')
      return
    }

    setSyncing(true)
    setSyncError(null)

    try {
      const result = await syncLatestNordicActivities(user)
      setSyncResult(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sync Nordic ski activities.'
      setSyncError(message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleWeatherSubmit(event: FormEvent) {
    event.preventDefault()

    if (!weatherQuery.trim()) {
      setWeatherError('Enter a location first.')
      return
    }

    setWeatherLoading(true)
    setWeatherError(null)

    try {
      const result = await fetchWeatherForecast({ query: weatherQuery.trim() })
      setWeather(result)
      setWeatherEditorOpen(false)
      await saveWeatherLocation(result.location)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load weather.'
      setWeatherError(message)
    } finally {
      setWeatherLoading(false)
    }
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setWeatherError('Geolocation is not supported in this browser.')
      return
    }

    setWeatherLoading(true)
    setWeatherError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const currentLocation: WeatherLocation = {
            name: '',
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          }
          const result = await fetchWeatherForecast(currentLocation)
          setWeather(result)
          setWeatherQuery(result.location.name)
          setWeatherEditorOpen(false)
          await saveWeatherLocation(result.location)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Could not load weather.'
          setWeatherError(message)
        } finally {
          setWeatherLoading(false)
        }
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : 'Could not read your current location.'
        setWeatherError(message)
        setWeatherLoading(false)
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    )
  }

  return (
    <div className="home">
      <div className="dashboard-top">
        <header className="dashboard-header">
          <p className="dashboard-header__eyebrow">Overview</p>
          <h1 className="dashboard-header__title">Dashboard</h1>
          <p className="dashboard-header__subtitle">
            A quick view of today&apos;s ski suggestion, your latest outings, and sync status.
          </p>
        </header>

        <aside className="yr-widget" aria-label="YR weather widget">
          <div className="yr-widget__top">
            <span className="yr-widget__updated">
              {weather?.updatedAt ? `Updated ${new Date(weather.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'YR weather'}
            </span>
            <div className="yr-widget__top-actions">
              <button
                type="button"
                className="yr-widget__change"
                onClick={() => setWeatherEditorOpen((open) => !open)}
              >
                Change location
              </button>
            </div>
          </div>

          <div className="yr-widget__hero">
            <div>
              <h2 className="yr-widget__place">{weather?.location.name ?? 'Choose location'}</h2>
              <p className="yr-widget__sub">
                {weather?.symbolCode ? weather.symbolCode.replace(/_/g, ' ') : 'Local forecast'}
              </p>
            </div>
            <div className="yr-widget__main">
              <span className="yr-widget__symbol" aria-hidden>
                {weatherIcon(weather?.symbolCode ?? null)}
              </span>
              <span className="yr-widget__temp">
                {weather?.airTemperature === null || weather?.airTemperature === undefined
                  ? '—'
                  : `${Math.round(weather.airTemperature)}°`}
              </span>
            </div>
          </div>

          <div className="yr-widget__stats">
            <div>
              <span className="yr-widget__stat-label">Wind</span>
              <span className="yr-widget__stat-value">
                {weather?.windSpeed === null || weather?.windSpeed === undefined
                  ? '—'
                  : `${weather.windSpeed} m/s`}
              </span>
            </div>
            <div>
              <span className="yr-widget__stat-label">Clouds</span>
              <span className="yr-widget__stat-value">
                {weather?.cloudAreaFraction === null || weather?.cloudAreaFraction === undefined
                  ? '—'
                  : `${Math.round(weather.cloudAreaFraction)}%`}
              </span>
            </div>
            <div>
              <span className="yr-widget__stat-label">1h</span>
              <span className="yr-widget__stat-value">
                {weather?.precipitationNextHour === null || weather?.precipitationNextHour === undefined
                  ? '—'
                  : `${weather.precipitationNextHour} mm`}
              </span>
            </div>
            <div>
              <span className="yr-widget__stat-label">6h</span>
              <span className="yr-widget__stat-value">
                {weather?.precipitationNext6Hours === null || weather?.precipitationNext6Hours === undefined
                  ? '—'
                  : `${weather.precipitationNext6Hours} mm`}
              </span>
            </div>
          </div>

          {weatherEditorOpen ? (
            <form className="yr-widget__form" onSubmit={handleWeatherSubmit}>
              <input
                className="yr-widget__input"
                value={weatherQuery}
                onChange={(event) => setWeatherQuery(event.target.value)}
                placeholder="Set location"
              />
              <button type="submit" className="yr-widget__submit" disabled={weatherLoading}>
                {weatherLoading ? '…' : 'Set'}
              </button>
              <button
                type="button"
                className="yr-widget__submit yr-widget__submit--secondary"
                onClick={handleUseCurrentLocation}
                disabled={weatherLoading}
              >
                Use current
              </button>
            </form>
          ) : null}

          {weatherError ? <p className="yr-widget__error">{weatherError}</p> : null}
        </aside>
      </div>

      <section className="dashboard-grid" aria-label="Dashboard overview">
        <article className="dashboard-card dashboard-card--suggestion">
          <div className="dashboard-card__header">
            <p className="dashboard-card__eyebrow">AI suggestion</p>
            <span className="dashboard-card__badge">Today</span>
          </div>
          <div className="dashboard-visual dashboard-visual--suggestion" aria-hidden>
            <span className="dashboard-ai-stars">
              <span className="dashboard-ai-star dashboard-ai-star--lg" />
              <span className="dashboard-ai-star dashboard-ai-star--sm" />
            </span>
            <span className="dashboard-visual__dot dashboard-visual__dot--strong" />
            <span className="dashboard-visual__dot" />
            <span className="dashboard-visual__dot" />
            <span className="dashboard-visual__line dashboard-visual__line--short" />
            <span className="dashboard-visual__line dashboard-visual__line--long" />
          </div>
          <h2 className="dashboard-card__title">Try Madshus Redline 2.0 Cold</h2>
          <p className="dashboard-card__text">
            Best fit for a slightly cold day with fresh snow and stable conditions.
          </p>
          <p className="dashboard-card__hint">
            Cold grind, lower RA, strong recent feedback.
          </p>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card__header">
            <p className="dashboard-card__eyebrow">Last skis used</p>
            <span className="dashboard-card__badge">Recent</span>
          </div>
          <ul className="dashboard-activity-list">
            {LAST_USED.map((item) => (
              <li key={`${item.ski}-${item.date}`} className="dashboard-activity-item">
                <div className="dashboard-activity-item__top">
                  <h2 className="dashboard-activity-item__ski">{item.ski}</h2>
                  <span className="dashboard-activity-item__date">{item.date}</span>
                </div>
                <p className="dashboard-activity-item__meta">Feeling: {item.feeling}</p>
                <p className="dashboard-activity-item__meta">Conditions: {item.condition}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="dashboard-card dashboard-card--sync">
          <div className="dashboard-card__header">
            <p className="dashboard-card__eyebrow">Sync status</p>
            <span
              className={
                isConnected
                  ? 'dashboard-sync-status dashboard-sync-status--online'
                  : 'dashboard-sync-status dashboard-sync-status--offline'
              }
            >
              {isConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <div className="dashboard-visual dashboard-visual--sync" aria-hidden>
            <span className="dashboard-sync-bar dashboard-sync-bar--one" />
            <span className="dashboard-sync-bar dashboard-sync-bar--two" />
            <span className="dashboard-sync-bar dashboard-sync-bar--three" />
            <span className="dashboard-sync-ring" />
          </div>
          <h2 className="dashboard-card__title">
            {isConnected ? 'Strava sync is ready' : 'Strava sync needs setup'}
          </h2>
          <p className="dashboard-card__text">
            {isConnected
              ? 'Fetch your latest five Nordic ski activities and parse their private notes with Gemini.'
              : 'Activity syncing is inactive. Connect Strava to enable automatic imports.'}
          </p>
          {isConnected ? (
            <button type="button" className="btn primary" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          ) : (
            <NavLink to="/profile" className="btn primary">
              Connect Strava
            </NavLink>
          )}
          {syncError ? <p className="dashboard-sync-error">{syncError}</p> : null}
          <p className="dashboard-card__hint">
            Last sync: {syncResult?.syncedAt ? new Date(syncResult.syncedAt).toLocaleString() : 'never'}.
          </p>
        </article>
      </section>

      <section className="dashboard-results" aria-labelledby="dashboard-results-heading">
        <div className="dashboard-results__header">
          <p className="dashboard-header__eyebrow">Latest sync</p>
          <h2 id="dashboard-results-heading" className="dashboard-results__title">
            Latest Nordic ski activities
          </h2>
          <p className="dashboard-results__text">
            The activities below are fetched from Strava, parsed on demand, and saved to your
            `activities` collection. When the parsed ski ID matches a ski in your park, the
            activity is linked automatically.
          </p>
        </div>

        {!syncResult ? (
          <div className="dashboard-results__empty" role="status">
            Press `Sync now` to load the latest 5 Nordic ski activities.
          </div>
        ) : syncResult.activities.length === 0 ? (
          <div className="dashboard-results__empty" role="status">
            No Nordic ski activities were returned from Strava.
          </div>
        ) : (
          <div className="dashboard-sync-list">
            {syncResult.activities.map((activity) => (
              <article key={activity.stravaActivityId} className="dashboard-sync-item">
                <div className="dashboard-sync-item__top">
                  <div>
                    <h3 className="dashboard-sync-item__title">{activity.name}</h3>
                    <p className="dashboard-sync-item__subtitle">
                      {activity.startDate || 'Unknown date'} · {activity.distanceKm ?? '—'} km ·{' '}
                      {activity.movingTimeMinutes ?? '—'} min · {activity.sportType}
                      {activity.type ? ` / ${activity.type}` : ''}
                    </p>
                  </div>
                  <span className="dashboard-sync-item__id">#{activity.stravaActivityId}</span>
                </div>

                <p className="dashboard-sync-item__status">
                  Saved: {activity.saved ? 'yes' : 'no'} · Linked ski:{' '}
                  {activity.matchedSkiName ?? activity.skiId ?? 'none'}
                </p>

                {activity.parsedReport ? (
                  <dl className="dashboard-sync-item__report">
                    <div>
                      <dt>Ski ID</dt>
                      <dd>{activity.parsedReport.id ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Weather</dt>
                      <dd>{activity.parsedReport.weather ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Temp</dt>
                      <dd>
                        {activity.parsedReport.temperature === null
                          ? '—'
                          : `${activity.parsedReport.temperature} °C`}
                      </dd>
                    </div>
                    <div>
                      <dt>Snow</dt>
                      <dd>{activity.parsedReport.snow ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Feeling</dt>
                      <dd>{activity.parsedReport.feeling ?? '—'}</dd>
                    </div>
                    <div className="dashboard-sync-item__report--wide">
                      <dt>Comment</dt>
                      <dd>{activity.parsedReport.comment ?? '—'}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="dashboard-sync-item__error">
                    {activity.parseError ?? 'Could not parse this activity.'}
                  </p>
                )}

                {activity.privateNote ? (
                  <details className="dashboard-sync-item__note">
                    <summary>Show private note</summary>
                    <p>{activity.privateNote}</p>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
