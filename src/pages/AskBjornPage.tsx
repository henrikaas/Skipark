import '../styles/pages.css'

export function AskBjornPage() {
  return (
    <div className="page page--wide">
      <header className="page-header">
        <h1>Ask Bjørn</h1>
        <p className="page-intro">
          This page will become your in-app AI assistant. Later, you will be able to ask about ski
          choice, conditions, usage history, activity notes, and anything else inside Skipark.
        </p>
      </header>

      <section className="page-placeholder" aria-label="Ask Bjørn placeholder">
        Ask Bjørn is not interactive yet, but this is the dedicated workspace for the agent.
      </section>
    </div>
  )
}
