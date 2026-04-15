import '../styles/pages.css'

export function StatisticsPage() {
  return (
    <div className="page page--wide">
      <header className="page-header">
        <h1>Statistics</h1>
        <p className="page-intro">
          This dashboard will collect ski usage, mileage, and other key trends once the activity
          pipeline is in place.
        </p>
      </header>
      <div className="page-placeholder" role="status">
        Statistics widgets are not implemented yet.
      </div>
    </div>
  )
}
