import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useActivities } from '../hooks/useActivities'
import { useAuth } from '../hooks/useAuth'
import { type SkiInput, useSkis } from '../hooks/useSkis'
import {
  type ActivityDocument,
  SKI_INTENDED_TEMP_MAX,
  SKI_INTENDED_TEMP_MIN,
  type SkiDocument,
} from '../firebase'
import '../styles/pages.css'
import './SkiParkPage.css'

type SkiFormState = {
  skiName: string
  brand: string
  grind: string
  base: string
  intendedTempC: number
  ra: string
  details: string
  isActive: boolean
}

const EMPTY_FORM: SkiFormState = {
  skiName: '',
  brand: '',
  grind: '',
  base: '',
  intendedTempC: 0,
  ra: '',
  details: '',
  isActive: true,
}

function formatDate(ts: { toDate: () => Date }) {
  try {
    return ts.toDate().toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

function formatActivityDate(ts: { toDate: () => Date }) {
  try {
    return ts.toDate().toLocaleDateString(undefined, {
      dateStyle: 'medium',
    })
  } catch {
    return '—'
  }
}

function activitySummary(activity: ActivityDocument) {
  const parts: string[] = []

  if (activity.condition?.trim()) parts.push(activity.condition.trim())
  if (activity.snow_condition?.trim()) parts.push(activity.snow_condition.trim())
  if (activity.feeling !== null && activity.feeling !== undefined) {
    parts.push(`Feeling ${activity.feeling}/10`)
  }
  if (activity.distance) {
    parts.push(`${(activity.distance / 1000).toFixed(1)} km`)
  }

  return parts.length ? parts.join(' · ') : 'No parsed summary'
}

function formatIntendedTempLabel(c: number): string {
  if (c <= SKI_INTENDED_TEMP_MIN) return '−15 °C and colder'
  if (c >= SKI_INTENDED_TEMP_MAX) return '+5 °C and warmer'
  const sign = c > 0 ? '+' : ''
  return `${sign}${c} °C`
}

function intendedDisplay(data: SkiDocument): string {
  if (typeof data.intendedTempC === 'number' && !Number.isNaN(data.intendedTempC)) {
    return formatIntendedTempLabel(data.intendedTempC)
  }
  const legacy = data.intended_condition?.trim()
  if (legacy) return legacy
  return '—'
}

function parseRaInput(
  raw: string,
): { ok: true; ra?: number } | { ok: false; message: string } {
  const t = raw.trim()
  if (!t) return { ok: true }
  const n = Number(t.replace(',', '.'))
  if (Number.isNaN(n)) return { ok: false, message: 'RA must be a number.' }
  const rounded = Math.round(n * 10) / 10
  if (rounded < 2 || rounded > 4) {
    return { ok: false, message: 'RA must be between 2 and 4 (one decimal).' }
  }
  return { ok: true, ra: rounded }
}

export function SkiParkPage() {
  const { user, loading: authLoading } = useAuth()
  const { skis, loading: skisLoading, error: skisError, addSki } = useSkis(user?.uid)
  const { activities, loading: activitiesLoading, error: activitiesError } = useActivities(user?.uid)
  const [form, setForm] = useState<SkiFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const missing: string[] = []
    if (!form.skiName.trim()) missing.push('ski ID / name')
    if (!form.brand.trim()) missing.push('brand')
    if (!form.grind.trim()) missing.push('grind')
    if (!form.base.trim()) missing.push('base')
    if (missing.length) {
      setFormError(`Please fill in: ${missing.join(', ')}.`)
      return
    }

    const raResult = parseRaInput(form.ra)
    if (!raResult.ok) {
      setFormError(raResult.message)
      return
    }

    const payload: SkiInput = {
      skiName: form.skiName,
      brand: form.brand,
      grind: form.grind,
      base: form.base,
      intendedTempC: form.intendedTempC,
      isActive: form.isActive,
      details: form.details,
    }
    if (raResult.ra !== undefined) {
      payload.ra = raResult.ra
    }

    setSubmitting(true)
    try {
      await addSki(payload)
      setForm(EMPTY_FORM)
      setIsAddModalOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save ski.'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="page page--wide">
        <p className="page-intro">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page page--wide">
        <header className="page-header">
          <h1>Your ski park</h1>
          <p className="page-intro">
            Sign in to register cross-country ski pairs and keep them in your personal Firestore
            ski park.
          </p>
        </header>
        <p className="ski-park-signin">
          <Link to="/sign-in" className="btn primary">
            Sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="page page--wide ski-park">
      <header className="page-header">
        <h1>Your ski park</h1>
        <p className="page-intro">
          Add each pair with ID, brand, grind, base, intended air temperature, and optional RA and
          notes. Everything is stored under your account in Firestore.
        </p>
      </header>

      <section className="ski-park-section" aria-labelledby="add-ski-heading">
        <div className="ski-park-actions">
          <div>
            <h2 id="add-ski-heading" className="ski-park-section__title">
              Add a pair
            </h2>
            <p className="ski-park-actions__text">
              Open the ski registration form when you want to add a new pair to your park.
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setFormError(null)
              setIsAddModalOpen(true)
            }}
          >
            Add ski pair
          </button>
        </div>
      </section>

      {isAddModalOpen ? (
        <div className="ski-modal" role="dialog" aria-modal="true" aria-labelledby="ski-modal-heading">
          <div className="ski-modal__backdrop" onClick={() => !submitting && setIsAddModalOpen(false)} />
          <div className="ski-modal__panel">
            <div className="ski-modal__header">
              <div>
                <p className="ski-modal__eyebrow">Ski park</p>
                <h2 id="ski-modal-heading" className="ski-modal__title">
                  Add ski pair
                </h2>
              </div>
              <button
                type="button"
                className="ski-modal__close"
                onClick={() => !submitting && setIsAddModalOpen(false)}
                aria-label="Close add ski form"
              >
                ×
              </button>
            </div>

            <form className="ski-form" onSubmit={handleSubmit}>
              <div className="ski-form__grid">
                <label className="ski-form__field ski-form__field--wide">
                  <span className="ski-form__label">Ski ID / name</span>
                  <input
                    className="ski-form__input"
                    name="skiName"
                    autoComplete="off"
                    value={form.skiName}
                    onChange={(e) => setForm((f) => ({ ...f, skiName: e.target.value }))}
                    placeholder="e.g. 67 or alpha"
                  />
                </label>
                <label className="ski-form__field">
                  <span className="ski-form__label">Brand</span>
                  <input
                    className="ski-form__input"
                    name="brand"
                    autoComplete="off"
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="e.g. Madshus"
                  />
                </label>
                <label className="ski-form__field">
                  <span className="ski-form__label">Grind</span>
                  <input
                    className="ski-form__input"
                    name="grind"
                    autoComplete="off"
                    value={form.grind}
                    onChange={(e) => setForm((f) => ({ ...f, grind: e.target.value }))}
                    placeholder="e.g. M61"
                  />
                </label>
                <label className="ski-form__field">
                  <span className="ski-form__label">Base</span>
                  <input
                    className="ski-form__input"
                    name="base"
                    autoComplete="off"
                    value={form.base}
                    onChange={(e) => setForm((f) => ({ ...f, base: e.target.value }))}
                    placeholder="e.g. F3"
                  />
                </label>
              </div>

              <div className="ski-form__field ski-form__field--wide ski-form__temp">
                <span className="ski-form__label" id="intended-temp-label">
                  Intended air temperature
                </span>
                <div className="ski-form__temp-row" role="group" aria-labelledby="intended-temp-label">
                  <span className="ski-form__temp-cap" aria-hidden>
                    +5 °C and warmer
                  </span>
                  <div className="ski-form__temp-slider-wrap">
                    <input
                      id="ski-intended-temp"
                      type="range"
                      className="ski-form__range"
                      min={SKI_INTENDED_TEMP_MIN}
                      max={SKI_INTENDED_TEMP_MAX}
                      step={1}
                      value={form.intendedTempC}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          intendedTempC: Number(e.target.value),
                        }))
                      }
                      aria-valuemin={SKI_INTENDED_TEMP_MIN}
                      aria-valuemax={SKI_INTENDED_TEMP_MAX}
                      aria-valuenow={form.intendedTempC}
                      aria-valuetext={formatIntendedTempLabel(form.intendedTempC)}
                    />
                    <output className="ski-form__temp-output" htmlFor="ski-intended-temp">
                      {formatIntendedTempLabel(form.intendedTempC)}
                    </output>
                  </div>
                  <span className="ski-form__temp-cap" aria-hidden>
                    −15 °C and colder
                  </span>
                </div>
              </div>

              <label className="ski-form__field ski-form__field--wide ski-form__field--ra">
                <span className="ski-form__label">RA (optional)</span>
                <input
                  className="ski-form__input"
                  name="ra"
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  min={2}
                  max={4}
                  value={form.ra}
                  onChange={(e) => setForm((f) => ({ ...f, ra: e.target.value }))}
                  placeholder="2.0–4.0"
                />
              </label>

              <label className="ski-form__field ski-form__field--wide ski-form__field--details">
                <span className="ski-form__label">Details (optional)</span>
                <textarea
                  className="ski-form__textarea"
                  name="details"
                  rows={3}
                  value={form.details}
                  onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                  placeholder="e.g. Intended for new snow conditions"
                />
              </label>

              <label className="ski-form__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <span>Active in rotation</span>
              </label>
              {formError ? (
                <p className="ski-form__error" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="ski-modal__actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => !submitting && setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Add pair'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="ski-park-section" aria-labelledby="ski-list-heading">
        <h2 id="ski-list-heading" className="ski-park-section__title">
          Your pairs
        </h2>
        {skisError ? (
          <p className="ski-form__error" role="alert">
            {skisError}
          </p>
        ) : null}
        {activitiesError ? (
          <p className="ski-form__error" role="alert">
            {activitiesError}
          </p>
        ) : null}
        {skisLoading ? (
          <p className="page-intro">Loading skis…</p>
        ) : skis.length === 0 ? (
          <div className="page-placeholder ski-park-empty" role="status">
            No skis yet. Add your first pair above.
          </div>
        ) : (
          <ul className="ski-list">
            {skis.map(({ id, data }) => (
              (() => {
                const recentActivities = activities.filter((activity) => activity.data.skiId === id).slice(0, 3)

                return (
                  <li key={id} className="ski-card">
                    <div className="ski-card__top">
                      <div className="ski-card__title-block">
                        <span className="ski-card__ski-name">
                          {data.skiName?.trim() || '—'}
                        </span>
                        <span className="ski-card__brand">{data.brand}</span>
                      </div>
                      {!data.isActive ? (
                        <span className="ski-card__badge">Inactive</span>
                      ) : null}
                    </div>
                    <dl className="ski-card__meta">
                      <div>
                        <dt>Grind</dt>
                        <dd>{data.grind}</dd>
                      </div>
                      <div>
                        <dt>Base</dt>
                        <dd>{data.base}</dd>
                      </div>
                      <div className="ski-card__meta--wide">
                        <dt>Intended temperature</dt>
                        <dd>{intendedDisplay(data)}</dd>
                      </div>
                      {typeof data.ra === 'number' && !Number.isNaN(data.ra) ? (
                        <div>
                          <dt>RA</dt>
                          <dd>{data.ra.toFixed(1)}</dd>
                        </div>
                      ) : null}
                      {data.details?.trim() ? (
                        <div className="ski-card__meta--wide">
                          <dt>Details</dt>
                          <dd className="ski-card__details">{data.details.trim()}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <section className="ski-card__usage" aria-label="Recent activity summary">
                      <div className="ski-card__usage-head">
                        <h3 className="ski-card__usage-title">Recent activity summary</h3>
                        <span className="ski-card__usage-count">
                          {recentActivities.length} recent
                        </span>
                      </div>
                      {activitiesLoading ? (
                        <p className="ski-card__usage-empty">Loading linked activities…</p>
                      ) : recentActivities.length === 0 ? (
                        <p className="ski-card__usage-empty">
                          No synced activities linked to this ski yet.
                        </p>
                      ) : (
                        <ul className="ski-card__usage-list">
                          {recentActivities.map(({ id: activityId, data: activity }) => (
                            <li key={activityId} className="ski-card__usage-item">
                              <div className="ski-card__usage-top">
                                <span className="ski-card__usage-name">{activity.name}</span>
                                <span className="ski-card__usage-date">
                                  {formatActivityDate(activity.startDate)}
                                </span>
                              </div>
                              <p className="ski-card__usage-meta">{activitySummary(activity)}</p>
                              {activity.comment?.trim() ? (
                                <p className="ski-card__usage-note">{activity.comment.trim()}</p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <p className="ski-card__date">Added {formatDate(data.createdAt)}</p>
                  </li>
                )
              })()
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
