import '../styles/pages.css'

export function SkiTestsPage() {
  return (
    <div className="page page--wide">
      <header className="page-header">
        <h1>Ski tests</h1>
        <p className="page-intro">
          Record ski tests, compare pairs, and keep notes about conditions, feel, and setup changes.
        </p>
      </header>
      <div className="page-placeholder" role="status">
        Ski test registration and history are not implemented yet.
      </div>
    </div>
  )
}
