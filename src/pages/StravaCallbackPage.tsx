import { Link, useSearchParams } from 'react-router-dom'
import '../styles/pages.css'

function getStatusMessage(error: string | null, status: string | null) {
  if (error) {
    return {
      title: 'Strava connection failed',
      text: `Strava returned an OAuth error: ${error}.`,
    }
  }

  if (status === 'success') {
    return {
      title: 'Strava connected',
      text: 'The backend completed the OAuth exchange and stored the Strava connection for your account.',
    }
  }

  return {
    title: 'Missing Strava response',
    text: 'The callback loaded, but no connection status was returned.',
  }
}

export function StravaCallbackPage() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status')
  const error = searchParams.get('error')
  const connected = searchParams.get('connected')
  const { title, text } = getStatusMessage(error, status)

  return (
    <div className="page page--wide">
      <header className="page-header">
        <h1>{title}</h1>
        <p className="page-intro">{text}</p>
      </header>

      <section className="page-placeholder strava-callback" aria-label="Strava callback details">
        <p className="strava-callback__row">
          <strong>Status:</strong> {status ?? '—'}
        </p>
        <p className="strava-callback__row">
          <strong>Connected:</strong> {connected ?? '—'}
        </p>
        <p className="strava-callback__row">
          <strong>Error:</strong> {error ?? '—'}
        </p>
      </section>

      <p className="strava-callback__actions">
        <Link to="/profile" className="btn primary">
          Back to profile
        </Link>
      </p>
    </div>
  )
}
