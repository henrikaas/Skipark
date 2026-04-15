import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './AppLayout.css'

const NAV = [
  { to: '/park', label: 'Ski park', shortLabel: 'P' },
  { to: '/ask-bjorn', label: 'Ask Bjørn', shortLabel: 'B' },
  { to: '/statistics', label: 'Statistics', shortLabel: 'S' },
  { to: '/ski-tests', label: 'Ski tests', shortLabel: 'T' },
] as const

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'
}

export function AppLayout() {
  const { user, loading, signOutUser } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__row">
          <NavLink to="/" className="app-brand" end>
            Skipark
          </NavLink>
        </div>
      </header>
      <div className="app-shell__body">
        <aside className="app-sidebar" aria-label="Primary">
          <div className="app-sidebar__inner">
            <nav className="app-nav" aria-label="Main">
              <div className="app-sidebar__label">Menu</div>
              {NAV.map(({ to, label, shortLabel }) => (
                <NavLink key={to} to={to} className={navClass}>
                  <span className="app-nav__icon" aria-hidden>
                    {shortLabel}
                  </span>
                  <span className="app-nav__text">{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="app-sidebar__footer">
              <div className="app-sidebar__label">Account</div>
              {loading ? (
                <div className="app-sidebar__status">
                  <span className="app-header__spinner" aria-hidden />
                  <span className="app-sidebar__status-text">Loading account</span>
                </div>
              ) : user ? (
                <>
                  <NavLink to="/profile" className="app-header__user" title="Profile">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="avatar avatar--sm"
                        width={36}
                        height={36}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="avatar avatar-placeholder avatar--sm" aria-hidden />
                    )}
                    <span className="app-header__user-copy">
                      <span className="app-header__user-name">
                        {user.displayName?.split(' ')[0] ?? 'Account'}
                      </span>
                      <span className="app-header__user-subtitle">Open profile</span>
                    </span>
                  </NavLink>
                  <button type="button" className="btn ghost small app-sidebar__signout" onClick={signOutUser}>
                    Sign out
                  </button>
                </>
              ) : (
                <NavLink to="/sign-in" className="btn primary small app-sidebar__signin">
                  Sign in
                </NavLink>
              )}
            </div>
          </div>
        </aside>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
