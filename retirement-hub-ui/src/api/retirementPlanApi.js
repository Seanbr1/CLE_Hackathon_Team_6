const DEFAULT_API_BASE_URL = 'http://localhost:8080/demo/api/v1/cases'

const API_BASE_URL = (
  import.meta.env.VITE_CASE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, '').replace(/\/cases$/i, '')

/**
 * Asks the backend for an AI-generated retirement plan built from a free-text
 * query, e.g.
 *   "I want a pension of EUR 3000 per month having a pension pot of
 *    EUR 500000 with 1 year left for existing pension fund to mature."
 *
 * @param {string} query natural-language request from the customer
 * @param {{ signal?: AbortSignal }} options
 * @returns {Promise<object>} the generated retirement plan
 */
export async function generateRetirementPlanFromQuery(query, { signal } = {}) {
  const trimmed = (query || '').trim()
  if (!trimmed) {
    throw new Error('Enter a question before asking for guidance.')
  }

  const url = `${API_BASE_URL}/retirement-plans/from-query?query=${encodeURIComponent(trimmed)}`
  const response = await fetch(url, { method: 'POST', signal })

  const responseText = await response.text()
  let data = null
  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      // A non-JSON body is only meaningful when the request failed.
      if (response.ok) {
        throw new Error('Retirement planning service returned invalid JSON.')
      }
    }
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error(
        'We could not read that request. Include a monthly amount and a pension pot, '
        + 'for example "EUR 3000 per month from a pension pot of EUR 500000".',
      )
    }
    throw new Error(
      data?.message || data?.error || `Retirement planning service returned HTTP ${response.status}.`,
    )
  }

  if (!data || typeof data !== 'object' || !Array.isArray(data.yearlyPlans)) {
    throw new Error('Retirement planning service returned an unexpected plan.')
  }

  return data
}