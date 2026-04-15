import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AskBjornPage } from './pages/AskBjornPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { SignInPage } from './pages/SignInPage'
import { SkiParkPage } from './pages/SkiParkPage'
import { SkiTestsPage } from './pages/SkiTestsPage'
import { StatisticsPage } from './pages/StatisticsPage'
import { StravaCallbackPage } from './pages/StravaCallbackPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="ask-bjorn" element={<AskBjornPage />} />
          <Route path="park" element={<SkiParkPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="ski-tests" element={<SkiTestsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="strava/callback" element={<StravaCallbackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
