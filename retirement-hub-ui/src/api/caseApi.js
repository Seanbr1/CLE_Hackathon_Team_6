const DEFAULT_CASE_API_BASE_URL = 'http://localhost:8080/demo/api/v1/cases'

const API_BASE_URL = (
  import.meta.env.VITE_CASE_API_BASE_URL || DEFAULT_CASE_API_BASE_URL
).replace(/\/+$/, '').replace(/\/cases$/i, '')

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  const responseText = await response.text()
  let data = null
  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      throw new Error('Case service returned invalid JSON.')
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Case service returned HTTP ${response.status}.`)
  }

  return data
}

export async function fetchCases({ signal } = {}) {
  const cases = await request('/cases', { signal })
  if (!Array.isArray(cases)) {
    throw new Error('Case service response must be a JSON array.')
  }

  return cases
}

export function fetchPolicy(policyId, { signal } = {}) {
  return request(`/policies/${encodeURIComponent(policyId)}`, { signal }).then((result) => {
    if (
      !result
      || typeof result !== 'object'
      || result.policyId !== policyId
      || typeof result.maturityDate !== 'string'
    ) {
      throw new Error('Policy service returned an unexpected record.')
    }
    return result
  })
}

export function createPolicy(policy) {
  return request('/policies', { method: 'POST', body: policy }).then((result) => {
    if (!result || typeof result.policyId !== 'string') {
      throw new Error('Policy service returned a response without a policy ID.')
    }
    return result
  })
}

export function assessPolicyMaturity(policyId) {
  return request(`/policies/${encodeURIComponent(policyId)}/maturity-assessment`, {
    method: 'POST',
  }).then((result) => {
    if (!result || typeof result.maturityDetected !== 'boolean') {
      throw new Error('Maturity assessment returned an invalid response.')
    }
    return result
  })
}

export function detectCaseOwners() {
  return request('/cases/owner-detection', { method: 'POST' }).then((result) => {
    if (!Array.isArray(result)) {
      throw new Error('Owner detection returned an invalid response.')
    }
    return result
  })
}

export function updateCase(caseId, updates) {
  return request(`/cases/${encodeURIComponent(caseId)}`, {
    method: 'PUT',
    body: updates,
  }).then((result) => {
    if (!result || result.caseId !== caseId) {
      throw new Error('Case service returned an unexpected update response.')
    }
    return result
  })
}

export function fetchCaseJourney(caseId, { signal } = {}) {
  return request(`/cases/${encodeURIComponent(caseId)}/journey`, { signal }).then((result) => {
    if (
      !result
      || typeof result !== 'object'
      || !result.retirementCase
      || !Array.isArray(result.availableOptions)
      || !Array.isArray(result.requiredDocuments)
      || !Array.isArray(result.uploadedDocuments)
      || !Array.isArray(result.outstandingDocuments)
    ) {
      throw new Error('Case journey service returned an invalid response.')
    }
    return result
  })
}

function adviceAction(caseId, path, body) {
  return request(`/cases/${encodeURIComponent(caseId)}/advice/${path}`, {
    method: 'POST',
    body: body ?? {},
  }).then((result) => {
    if (!result || typeof result !== 'object' || !result.retirementCase) {
      throw new Error('Advice service returned an invalid journey.')
    }
    return result
  })
}

/** Customer asks their advisor to advise, optionally sharing a non-binding preference. */
export function requestAdvice(caseId, preference) {
  return adviceAction(caseId, 'request', { preference: preference ?? null })
}

/** Advisor accepts the qualified lead. */
export function acceptLead(caseId, advisor) {
  return adviceAction(caseId, 'accept', { advisor })
}

/** Advisor books the advice appointment. */
export function bookAppointment(caseId, { appointmentAt, advisor, channel }) {
  return adviceAction(caseId, 'appointment', { appointmentAt, advisor, channel })
}

/** Advisor records the advice given and the resulting binding selection. */
export function recordRecommendation(caseId, { recommendedOption, rationale, advisor, channel }) {
  return adviceAction(caseId, 'recommendation', { recommendedOption, rationale, advisor, channel })
}

/**
 * Issues the formal maturity pack for every advised case. Idempotent, and only
 * picks up cases where an advisor has already recorded an option.
 */
export function issueMaturityPackages() {
  return request('/cases/maturity-package-email', { method: 'POST' }).then((result) => {
    if (!Array.isArray(result)) {
      throw new Error('Maturity package service returned an invalid response.')
    }
    return result
  })
}

/**
 * Records a customer document. `accountHolder` is the name read from bank
 * details; a mismatch with the policyholder holds the case for review.
 */
export function recordJourneyDocument(caseId, document, fileName, accountHolder = null) {
  return request(`/cases/${encodeURIComponent(caseId)}/journey/documents`, {
    method: 'POST',
    body: { document, fileName, accountHolder },
  }).then((result) => {
    if (!result || typeof result !== 'object' || !result.retirementCase) {
      throw new Error('Document service returned an invalid journey.')
    }
    return result
  })
}

export function fetchEfficiencyMetrics({ signal } = {}) {
  return request('/metrics/efficiency', { signal }).then((result) => {
    if (!result || typeof result !== 'object' || typeof result.totalCases !== 'number') {
      throw new Error('Efficiency metrics service returned an invalid response.')
    }
    return result
  })
}

export function resetDemoData() {
  return request('/demo/reset', { method: 'POST' }).then((result) => {
    if (!Array.isArray(result)) {
      throw new Error('Demo reset returned an invalid response.')
    }
    return result
  })
}

/** A case worker clears a validation exception after reviewing it. */
export function resolveCaseException(caseId, note) {
  return request(`/cases/${encodeURIComponent(caseId)}/journey/exception/resolve`, {
    method: 'POST',
    body: { note, actor: 'Case worker' },
  }).then((result) => {
    if (!result || typeof result !== 'object' || !result.retirementCase) {
      throw new Error('Exception service returned an invalid journey.')
    }
    return result
  })
}
