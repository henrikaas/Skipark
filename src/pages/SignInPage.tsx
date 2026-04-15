import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../styles/pages.css'

export function SignInPage() {
  const { user, loading, error, signInWithGoogle } = useAuth()

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="page page--wide">
      <header className="page-header">
        <h1>Sign in</h1>
        <p className="page-intro">
          Use Google to access Skipark. Ski inventory, Strava imports, and charts will build on this
          account later.
        </p>
      </header>

      <div className="sign-in-layout">
        {loading ? (
          <p className="page-intro">Checking sign-in…</p>
        ) : (
          <section className="auth-panel" aria-label="Sign in">
            <p className="lede">Sign in with your Google account.</p>
            <button type="button" className="btn primary" onClick={signInWithGoogle}>
              Sign in with Google
            </button>
          </section>
        )}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
