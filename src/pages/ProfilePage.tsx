import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useUserDocument } from '../hooks/useUserDocument'
import { connectToStrava, getStravaApiBase } from '../strava'
import '../styles/pages.css'
import './ProfilePage.css'

function formatExpiry(ts: { toDate: () => Date } | null | undefined) {
  if (!ts) return '—'

  try {
    return ts.toDate().toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

export function ProfilePage() {
  const { user } = useAuth()
  const { data: userDoc, loading: userDocLoading, error: userDocError } = useUserDocument(user?.uid)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const strava = userDoc?.strava
  const isConnected = Boolean(strava?.connected)

  async function handleConnect() {
    if (!user) {
      setConnectError('Sign in before connecting Strava.')
      return
    }

    setConnecting(true)
    setConnectError(null)

    try {
      await connectToStrava(user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start Strava OAuth.'
      setConnectError(message)
      setConnecting(false)
    }
  }

  return (
    <div className="page page--wide">
      <header className="page-header">
        <h1>Profile</h1>
        <p className="page-intro">
          Account details and external connections. Strava now starts through a backend endpoint so
          token exchange can stay server-side.
        </p>
      </header>

      <div className="profile-blocks">
        <section className="profile-block" aria-labelledby="profile-account-heading">
          <h2 id="profile-account-heading">Account</h2>
          <p className="profile-block__text">
            Name, email, and sign-in provider are managed through Firebase Authentication. Editable
            profile fields can live here later.
          </p>
          {user ? (
            <dl className="profile-details">
              <div>
                <dt>Name</dt>
                <dd>{user.displayName ?? '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email ?? '—'}</dd>
              </div>
              <div>
                <dt>UID</dt>
                <dd>{user.uid}</dd>
              </div>
            </dl>
          ) : (
            <div className="page-placeholder profile-block__placeholder" role="status">
              Sign in to view account details.
            </div>
          )}
        </section>

        <section className="profile-block" aria-labelledby="profile-strava-heading">
          <div className="profile-block__head">
            <h2 id="profile-strava-heading">Strava</h2>
            <span className="badge">{isConnected ? 'Connected' : 'Backend OAuth'}</span>
          </div>
          <p className="profile-block__text">
            Connect your Strava account so Skipark can start OAuth through Firebase Functions, then
            exchange the authorization code on the backend.
          </p>
          <div className="strava-placeholder">
            <p className="strava-placeholder__title">Connect Strava</p>
            <p className="strava-placeholder__hint">
              API base: {getStravaApiBase()}
            </p>
            <p className="strava-placeholder__hint">
              Callback route after backend redirect: {window.location.origin}/strava/callback
            </p>
            {!user ? (
              <p className="strava-placeholder__error">
                Sign in first. The backend ties the Strava connection to your Firebase user.
              </p>
            ) : null}
            {userDocLoading && user ? (
              <p className="strava-placeholder__hint">Loading current Strava status…</p>
            ) : null}
            {userDocError ? <p className="strava-placeholder__error">{userDocError}</p> : null}
            {isConnected ? (
              <dl className="strava-status">
                <div>
                  <dt>Status</dt>
                  <dd>Connected</dd>
                </div>
                <div>
                  <dt>Athlete ID</dt>
                  <dd>{strava?.athleteId || '—'}</dd>
                </div>
                <div className="strava-status__wide">
                  <dt>Scopes</dt>
                  <dd>{strava?.scopes?.length ? strava.scopes.join(', ') : '—'}</dd>
                </div>
                <div className="strava-status__wide">
                  <dt>Token expires</dt>
                  <dd>{formatExpiry(strava?.tokenExpiresAt)}</dd>
                </div>
              </dl>
            ) : user && !userDocLoading ? (
              <p className="strava-placeholder__hint">
                No Strava connection stored for this account yet.
              </p>
            ) : null}
            {connectError ? <p className="strava-placeholder__error">{connectError}</p> : null}
            <button
              type="button"
              className="btn primary"
              onClick={handleConnect}
              disabled={!user || connecting}
            >
              {connecting ? 'Connecting…' : isConnected ? 'Reconnect Strava' : 'Connect to Strava'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
