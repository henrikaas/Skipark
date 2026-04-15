export type WeatherLocation = {
  name: string
  lat: number
  lon: number
}

export type WeatherForecast = {
  location: WeatherLocation
  updatedAt: string
  airTemperature: number | null
  windSpeed: number | null
  cloudAreaFraction: number | null
  symbolCode: string | null
  precipitationNextHour: number | null
  precipitationNext6Hours: number | null
}

const WEATHER_API_BASE = import.meta.env.VITE_STRAVA_API_BASE?.trim() || '/api/strava'

export async function fetchWeatherForecast(input: { query: string } | WeatherLocation) {
  const response = await fetch(`${WEATHER_API_BASE}/weather/forecast`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() }

  if (!response.ok) {
    throw new Error(payload?.error || 'Could not load weather forecast.')
  }

  return payload as WeatherForecast
}
