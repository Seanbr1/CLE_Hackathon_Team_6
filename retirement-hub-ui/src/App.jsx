import { useEffect, useRef, useState } from 'react'
import {
  acceptLead,
  assessPolicyMaturity,
  bookAppointment,
  createPolicy,
  detectCaseOwners,
  fetchCases,
  fetchCaseJourney,
  fetchEfficiencyMetrics,
  fetchPolicy,
  issueMaturityPackages,
  recordJourneyDocument,
  recordRecommendation,
  requestAdvice,
  resetDemoData,
  resolveCaseException,
  updateCase as updateBackendCase,
} from './api/caseApi'
import './App.css'

const maturityOptionLabels = {
  ANNUITY: 'Guaranteed income (annuity)',
  LUMP_SUM: 'Take a lump sum',
  REINVEST: 'Reinvest your pension',
}

const documentLabels = {
  PASSPORT: 'Passport',
  BANK_DETAILS: 'Bank details',
}

/** Plain-language case status for staff screens (broker and case worker). */
const staffStatusLabels = {
  NEW: 'New',
  MATURITY_DETECTED: 'Maturity detected',
  CLE_OWNER_DETECTED: 'Routed to In-House Sales',
  NON_CLE_OWNER_DETECTED: 'Routed to broker',
  ADVICE_REQUESTED: 'Advice requested',
  APPOINTMENT_BOOKED: 'Appointment booked',
  IN_PROGRESS: 'Advice recorded',
  MATURITY_PACKAGE_SENT: 'Formal pack issued',
  AWAITING_INFORMATION: 'Missing information',
  AWAITING_CUSTOMER: 'Awaiting customer',
  ON_HOLD: 'Human review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

/** What the customer sees as their status. */
const customerStatusLabels = {
  NEW: 'Explore your options',
  MATURITY_DETECTED: 'Explore your options',
  CLE_OWNER_DETECTED: 'Explore your options',
  NON_CLE_OWNER_DETECTED: 'Explore your options',
  ADVICE_REQUESTED: 'Advice requested',
  APPOINTMENT_BOOKED: 'Advice appointment booked',
  IN_PROGRESS: 'Option agreed with your advisor',
  MATURITY_PACKAGE_SENT: 'Documents needed',
  AWAITING_INFORMATION: 'Documents needed',
  AWAITING_CUSTOMER: 'We need something from you',
  ON_HOLD: 'Under review',
  COMPLETED: 'All done',
  CANCELLED: 'Closed',
}

function staffStatus(status) {
  return staffStatusLabels[String(status || '').toUpperCase()] || status || 'Unknown'
}

function customerStatus(status) {
  return customerStatusLabels[String(status || '').toUpperCase()] || 'In progress'
}

/** Owner codes from the policy system, shown as who actually advises the client. */
const ownerLabels = {
  'BROKER-1027': 'Broker',
  'EXTERNAL-BROKER': 'External broker',
  'CLE-TEAM': 'In-House Sales',
  CLE: 'In-House Sales',
  UNASSIGNED: 'Not assigned',
}

const ownerTypeLabels = {
  NON_CLE: 'Broker-managed',
  CLE: 'Direct (In-House Sales)',
}

/** Audit action codes follow the spec's action framework (5.3). */
const auditActionLabels = {
  ACTION_MATURITY_01: 'Journey opened',
  ACTION_MATURITY_02: 'Annual statement check',
  ACTION_MATURITY_03: 'Formal maturity pack',
  ACTION_MATURITY_04: 'Targeted reminder',
  ACTION_MATURITY_05: 'Advisor routing',
  ADVICE_REQUESTED: 'Advice requested',
  LEAD_ACCEPTED: 'Lead accepted',
  APPOINTMENT_BOOKED: 'Appointment booked',
  ADVICE_COMPLETED: 'Advice recorded',
  RESPONSE_RECEIVED: 'Customer response',
  STP_COMPLETED: 'Straight-through completion',
  MANUAL_REVIEW: 'Human review',
  VALIDATION_CONFLICT: 'Validation conflict',
  EXCEPTION_RESOLVED: 'Exception resolved',
  CASE_COMPLETED: 'Case completed',
}

function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'the client'
}

function initials(fullName) {
  return String(fullName || '').trim().split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase() || '?'
}

/** Name read from Maria's bank details in the demo: her married name, which validation flags. */
const DEMO_ACCOUNT_HOLDER = 'Maria Schneider-Wolf'

/** Pre-filled case worker note for resolving that conflict. */
const DEFAULT_REVIEW_NOTE = 'Name change confirmed against the passport on file. The account belongs to the policyholder.'

/** Pre-filled so the presenter can record advice with a single click. */
const DEFAULT_RATIONALE = 'Maria wanted the full cash sum, but most of it was earmarked for day-to-day '
  + 'living. A guaranteed income covers her fixed outgoings for life, so we agreed an annuity.'

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>
}

/** Straight-through-processing lanes a case falls into once the customer responds. */
const laneMeta = {
  GREEN: {
    label: 'Green · straight-through',
    short: 'Green',
    tone: 'green',
    detail: 'Complete and consistent. Executed with no manual handling.',
  },
  AMBER: {
    label: 'Amber · targeted follow-up',
    short: 'Amber',
    tone: 'amber',
    detail: 'Isolated information outstanding. One targeted request, no generic reminder.',
  },
  RED: {
    label: 'Red · human review',
    short: 'Red',
    tone: 'red',
    detail: 'Conflict or exception. Automation stopped and handed over with context.',
  },
}

function LanePill({ lane, short = false }) {
  const meta = laneMeta[lane]
  if (!meta) return <span className="lane-none" title="Sorted into a lane once the customer responds">—</span>
  return <StatusPill tone={meta.tone}>{short ? meta.short : meta.label}</StatusPill>
}

function mapBackendCase(record, index) {
  if (
    !record
    || typeof record !== 'object'
    || typeof record.caseId !== 'string'
    || typeof record.caseName !== 'string'
    || typeof record.caseStatus !== 'string'
  ) {
    throw new Error(`Case service returned an invalid case record at item ${index + 1}.`)
  }

  return {
    id: record.caseId,
    customer: record.caseName,
    policy: record.policyId || 'Not provided',
    status: staffStatus(record.caseStatus),
    backendStatus: record.caseStatus,
    detail: record.description || 'No summary yet.',
    owner: record.owner || 'Unassigned',
    ownerType: record.ownerType || 'Not provided',
    email: record.email || 'Not provided',
    maturityOption: record.maturityOption || null,
    customerPreference: record.customerPreference || null,
    adviceRecord: record.adviceRecord || null,
    leadAcceptedAt: record.leadAcceptedAt || null,
    appointmentAt: record.appointmentAt || null,
    uploadedDocuments: Array.isArray(record.uploadedDocuments) ? record.uploadedDocuments : [],
    outstandingDocuments: Array.isArray(record.outstandingDocuments) ? record.outstandingDocuments : [],
    processingLane: record.processingLane || null,
    exceptionReason: record.exceptionReason || '',
    journeyEvents: Array.isArray(record.journeyEvents) ? record.journeyEvents : [],
    sla: record.caseSla == null ? 'Not provided' : String(record.caseSla),
    createdAt: record.createdAt || 'Not provided',
    updatedAt: record.updatedAt || 'Not provided',
    isBackend: true,
  }
}

/** Seeded prototype scenario used as the worked example. */
const SCENARIO_A = 'CASE-2027-10021'
/** The amber and red scenarios, held back until the demo compares lanes. */
const OTHER_SCENARIOS = ['CASE-2027-10044', 'CASE-2027-10078']

/** Who the audience is watching at each step. */
const personas = {
  customer: { name: 'Maria Schneider', role: 'Customer portal', tone: 'customer' },
  broker: { name: 'Broker consultant', role: 'Broker workspace', tone: 'broker' },
  caseworker: { name: 'CLE Operations', role: 'Case worker', tone: 'caseworker' },
}

/**
 * The guided demo, written for a non-technical audience watching one screen.
 * Each chapter puts Maria's case into the state it needs on entry (`requires`),
 * so the driver can move forwards or backwards without hitting an error.
 * Live chapters highlight the one thing to click and say what it did.
 */
const demoFlowSteps = [
  {
    id: 'slide-solution',
    when: 'Presentation · 1 of 2',
    title: 'Our solution',
    line: 'Retirement Hub: every maturity handled early, only exceptions need a person.',
    role: 'caseworker',
    caseId: SCENARIO_A,
    caseworkerPage: 'queue',
    requires: 'NON_CLE_OWNER_DETECTED',
    slide: 'solution',
  },
  {
    id: 'slide-opportunity',
    when: 'Presentation · 2 of 2',
    title: 'The opportunity',
    line: 'Maturities nearly double by 2034. Next: the live platform.',
    role: 'caseworker',
    caseId: SCENARIO_A,
    caseworkerPage: 'queue',
    requires: 'NON_CLE_OWNER_DETECTED',
    slide: 'opportunity',
  },
  {
    id: 'starts',
    when: '12 months before maturity',
    title: 'Case opened automatically',
    line: 'The platform detects the upcoming maturity, opens a case and routes it to the responsible broker.',
    role: 'caseworker',
    caseId: SCENARIO_A,
    caseworkerPage: 'case',
    requires: 'NON_CLE_OWNER_DETECTED',
  },
  {
    id: 'statement',
    when: '7 months before maturity',
    title: 'Maturity information in the annual statement',
    line: 'The scheduled annual statement carries Maria’s maturity options. No separate mailing is issued.',
    role: 'customer',
    caseId: SCENARIO_A,
    customerFocus: 'annual-statement',
    requires: 'NON_CLE_OWNER_DETECTED',
    highlight: '.statement-next-step .button',
  },
  {
    id: 'ask',
    when: '6 months before maturity',
    title: 'Customer requests advice',
    line: 'Maria reviews her options online. They are presented as information only; the decision is made with her broker.',
    done: 'Request delivered to the broker as a qualified lead.',
    role: 'customer',
    caseId: SCENARIO_A,
    requires: 'NON_CLE_OWNER_DETECTED',
    advancesTo: 'ADVICE_REQUESTED',
    highlight: '.advice-cta .button',
    scrollToHighlight: true,
  },
  {
    id: 'advise',
    when: '6 months before maturity',
    title: 'Broker-led advice',
    line: 'The broker picks up the lead, schedules the advice conversation and records the advised option.',
    done: 'Advice recorded. Formal documentation is issued automatically.',
    role: 'broker',
    brokerPage: 'list',
    caseId: SCENARIO_A,
    requires: 'ADVICE_REQUESTED',
    advancesTo: 'IN_PROGRESS',
    highlight: '.pick-up-lead, .process-step.current .button-primary',
    scrollToHighlight: true,
  },
  {
    id: 'paperwork',
    when: '5 months before maturity',
    title: 'Formal pack and documents',
    line: 'The formal pack is issued automatically. Maria submits the two required documents online.',
    done: 'Validation flagged a mismatch on the bank details. Payment is held for review.',
    doneTone: 'warn',
    role: 'customer',
    caseId: SCENARIO_A,
    requires: 'MATURITY_PACKAGE_SENT',
    advancesTo: 'ON_HOLD',
    highlight: '.document-upload-button',
    scrollToHighlight: true,
  },
  {
    id: 'exception',
    when: '5 months before maturity',
    title: 'Exception handled by CLE Operations',
    line: 'Only the exception reaches a case worker, with the evidence already assembled. One review releases the case.',
    done: 'Exception resolved. The case is complete and ready for payment at maturity.',
    role: 'caseworker',
    caseId: SCENARIO_A,
    caseworkerPage: 'queue',
    requires: 'ON_HOLD',
    advancesTo: 'COMPLETED',
    highlight: '.case-row-focus .table-action, .exception-approve-button',
    scrollToHighlight: true,
  },
  {
    id: 'timeline',
    when: 'At maturity',
    title: 'Activity by participant',
    line: 'Automation handled the routine work. CLE Operations made one targeted intervention, compared with around nine today.',
    role: 'caseworker',
    caseId: SCENARIO_A,
    caseworkerPage: 'timeline',
    requires: 'COMPLETED',
  },
  {
    id: 'next',
    when: 'Roadmap',
    title: 'Next steps',
    line: 'From prototype to pilot: German-language journeys, agent-assisted operations and core-system integration.',
    role: 'caseworker',
    caseId: SCENARIO_A,
    caseworkerPage: 'timeline',
    requires: 'COMPLETED',
    slide: 'next',
  },
]

/** Where a status sits in Maria's journey, for preparing chapters. */
const journeyOrder = [
  'NEW', 'MATURITY_DETECTED', 'NON_CLE_OWNER_DETECTED', 'ADVICE_REQUESTED', 'APPOINTMENT_BOOKED',
  'IN_PROGRESS', 'MATURITY_PACKAGE_SENT', 'AWAITING_INFORMATION', 'ON_HOLD', 'COMPLETED',
]

function journeyRank(status) {
  return journeyOrder.indexOf(status === 'CLE_OWNER_DETECTED' ? 'NON_CLE_OWNER_DETECTED' : status)
}

/** Loads the policy linked to a case, re-fetching whenever the policy changes. */
function usePolicyDetails(policyId) {
  const hasPolicy = Boolean(policyId) && policyId !== 'Not provided'
  const [request, setRequest] = useState({ policyId: '', status: 'idle', data: null, error: '' })

  useEffect(() => {
    if (!hasPolicy) return undefined

    const controller = new AbortController()
    fetchPolicy(policyId, { signal: controller.signal })
      .then((policy) => setRequest({ policyId, status: 'success', data: policy, error: '' }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setRequest({
          policyId,
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Could not load policy details.',
        })
      })

    return () => controller.abort()
  }, [hasPolicy, policyId])

  if (!hasPolicy) return { status: 'success', data: null, error: '' }
  return request.policyId === policyId ? request : { status: 'loading', data: null, error: '' }
}

function App() {
  const [role, setRole] = useState('caseworker')
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [caseworkerPage, setCaseworkerPage] = useState('queue')
  const [brokerPage, setBrokerPage] = useState('list')
  const [demoStepIndex, setDemoStepIndex] = useState(null)
  const [customerFocus, setCustomerFocus] = useState('')
  const [optionReview, setOptionReview] = useState(null)
  // Brief card shown when the demo moves to another person.
  const [handoff, setHandoff] = useState(null)
  // Chapter preparation: puts Maria's case into the state a chapter needs.
  const [prepState, setPrepState] = useState({ busy: false, error: '' })
  const prepToken = useRef(0)
  const scrolledTarget = useRef(null)
  const [caseLoadState, setCaseLoadState] = useState({
    status: 'loading',
    cases: [],
    error: '',
  })
  const [caseReload, setCaseReload] = useState(0)
  const [efficiencyState, setEfficiencyState] = useState({ status: 'loading', data: null, error: '' })
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const [workflowResult, setWorkflowResult] = useState(null)
  const [caseActionBusy, setCaseActionBusy] = useState(false)
  const [caseActionError, setCaseActionError] = useState('')
  const [toast, setToast] = useState('')
  const [journeyReload, setJourneyReload] = useState(0)
  const [journeyState, setJourneyState] = useState({
    requestKey: '',
    status: 'idle',
    data: null,
    error: '',
    actionError: '',
    actionBusy: false,
  })
  const displayedCases = caseLoadState.cases
  const demoStep = demoStepIndex === null ? null : demoFlowSteps[demoStepIndex]
  // The demo follows Maria alone until the result. Cases created live still show.
  const demoFocused = Boolean(demoStep)
  const viewCases = demoFocused
    ? caseLoadState.cases.filter((item) => !OTHER_SCENARIOS.includes(item.id))
    : caseLoadState.cases
  const selectedCase = displayedCases.find((item) => item.id === selectedCaseId)
    ?? displayedCases.find((item) => item.id === SCENARIO_A)
    ?? displayedCases[0]
  const journeyCaseId = role === 'customer' ? selectedCase?.id : ''
  const journeyRequestKey = journeyCaseId ? `${journeyCaseId}:${journeyReload}` : ''
  const currentJourneyState = journeyRequestKey && journeyState.requestKey === journeyRequestKey
    ? journeyState
    : journeyRequestKey
      ? { status: 'loading', data: null, error: '', actionError: '', actionBusy: false }
      : { status: 'idle', data: null, error: '', actionError: '', actionBusy: false }

  useEffect(() => {
    const controller = new AbortController()
    fetchCases({ signal: controller.signal })
      .then((records) => {
        const mappedCases = records.map(mapBackendCase)
        setCaseLoadState({ status: 'success', cases: mappedCases, error: '' })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setCaseLoadState({
          status: 'error',
          cases: [],
          error: error instanceof Error ? error.message : 'Could not load cases.',
        })
      })

    return () => controller.abort()
  }, [role, caseReload])

  // Efficiency measures are recounted whenever the case store changes, so the
  // dashboard reflects transitions made during the demo.
  useEffect(() => {
    const controller = new AbortController()
    fetchEfficiencyMetrics({ signal: controller.signal })
      .then((data) => setEfficiencyState({ status: 'success', data, error: '' }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setEfficiencyState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Could not load efficiency measures.',
        })
      })

    return () => controller.abort()
  }, [caseReload, caseLoadState.cases])

  useEffect(() => {
    if (!journeyRequestKey || role !== 'customer' || !journeyCaseId) return undefined

    const controller = new AbortController()
    fetchCaseJourney(journeyCaseId, { signal: controller.signal })
      .then((data) => setJourneyState({
        requestKey: journeyRequestKey,
        status: 'success',
        data,
        error: '',
        actionError: '',
        actionBusy: false,
      }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setJourneyState({
          requestKey: journeyRequestKey,
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Could not load this case journey.',
          actionError: '',
          actionBusy: false,
        })
      })

    return () => controller.abort()
  }, [role, journeyCaseId, journeyRequestKey])

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  const reloadCases = () => {
    setCaseLoadState({ status: 'loading', cases: [], error: '' })
    setCaseReload((count) => count + 1)
  }

  const refreshCases = async () => {
    const records = await fetchCases()
    const mappedCases = records.map(mapBackendCase)
    setCaseLoadState({ status: 'success', cases: mappedCases, error: '' })
    return mappedCases
  }

  const runLiveJourney = async (policyInput) => {
    setWorkflowBusy(true)
    setWorkflowResult({ kind: 'info', message: 'Creating the policy and checking its maturity date…' })
    let createdPolicyId = ''
    let currentStep = 'policy creation'
    try {
      const policy = await createPolicy(policyInput)
      createdPolicyId = policy.policyId
      currentStep = 'maturity assessment'
      const assessment = await assessPolicyMaturity(policy.policyId)
      if (!assessment.maturityDetected || !assessment.linkedCase) {
        await refreshCases()
        setWorkflowResult({
          kind: 'warning',
          message: `Policy ${policy.policyId} was created, but it does not mature within the next 12 months, so no case was opened yet.`,
        })
        return
      }

      let ownerResult = null
      if (assessment.linkedCase.caseStatus === 'MATURITY_DETECTED') {
        currentStep = 'owner detection'
        const results = await detectCaseOwners()
        ownerResult = results.find((result) => result.policyId === policy.policyId)
      }

      currentStep = 'refreshing the case queue'
      const mappedCases = await refreshCases()
      setSelectedCaseId(assessment.linkedCase.caseId)

      const currentCase = mappedCases.find((item) => item.id === assessment.linkedCase.caseId)
      const routing = ownerResult
        ? ` It was routed to ${ownerResult.ownerType === 'NON_CLE' ? 'the broker' : 'In-House Sales'} automatically.`
        : ` It is ${staffStatus(currentCase?.backendStatus ?? assessment.linkedCase.caseStatus)}.`
      setWorkflowResult({
        kind: 'success',
        message: `Case ${assessment.linkedCase.caseId} opened for policy ${policy.policyId} and added to the queue.${routing}`,
      })
    } catch (error) {
      const cause = error instanceof Error ? error.message : 'Unexpected error.'
      setWorkflowResult({
        kind: 'error',
        message: createdPolicyId
          ? `Policy ${createdPolicyId} was created, but ${currentStep} failed: ${cause}`
          : `Policy creation failed: ${cause}`,
      })
      try {
        await refreshCases()
      } catch (refreshError) {
        const refreshMessage = refreshError instanceof Error ? refreshError.message : 'Unknown refresh error.'
        setCaseLoadState({
          status: 'error',
          cases: [],
          error: `Could not refresh cases after the workflow error: ${refreshMessage}`,
        })
      }
    } finally {
      setWorkflowBusy(false)
    }
  }

  const persistCaseAction = async (item) => {
    setCaseActionBusy(true)
    setCaseActionError('')
    try {
      await updateBackendCase(item.id, { caseStatus: 'AWAITING_CUSTOMER' })
      await refreshCases()
      notify('Case marked as waiting on the customer.')
    } catch (error) {
      setCaseActionError(error instanceof Error ? error.message : 'Could not update this case.')
    } finally {
      setCaseActionBusy(false)
    }
  }

  const mutateJourney = async (action) => {
    if (!selectedCase) return
    setJourneyState((current) => ({ ...current, actionBusy: true, actionError: '' }))
    try {
      const data = await action(selectedCase.id)
      setJourneyState({
        requestKey: `${selectedCase.id}:${journeyReload}`,
        status: 'success',
        data,
        error: '',
        actionError: '',
        actionBusy: false,
      })
      setCaseReload((count) => count + 1)
      return data
    } catch (error) {
      setJourneyState((current) => ({
        ...current,
        requestKey: `${selectedCase.id}:${journeyReload}`,
        actionBusy: false,
        actionError: error instanceof Error ? error.message : 'The journey update failed.',
      }))
      return null
    }
  }

  // Customer-side journey actions.
  const submitAdviceRequest = (preference) => mutateJourney(
    (caseId) => requestAdvice(caseId, preference),
  )
  const submitJourneyDocument = (document, fileName, accountHolder) => mutateJourney(
    (caseId) => recordJourneyDocument(caseId, document, fileName, accountHolder),
  )

  // Advisor-side actions. These refresh the case list so the broker queue,
  // lane classification and efficiency measures all stay in step.
  const runAdvisorAction = async (action) => {
    if (!selectedCase) return null
    setCaseActionBusy(true)
    setCaseActionError('')
    try {
      const journey = await action(selectedCase.id)
      await refreshCases()
      setJourneyReload((count) => count + 1)
      return journey
    } catch (error) {
      setCaseActionError(error instanceof Error ? error.message : 'The advisor action failed.')
      return null
    } finally {
      setCaseActionBusy(false)
    }
  }

  const advisorAcceptLead = (advisor) => runAdvisorAction(
    (caseId) => acceptLead(caseId, advisor),
  )

  const advisorScheduleConversation = (details) => runAdvisorAction(
    (caseId) => bookAppointment(caseId, details),
  )

  const caseworkerResolveException = (note) => runAdvisorAction(
    (caseId) => resolveCaseException(caseId, note),
  ).then((journey) => {
    if (journey) notify('Exception resolved and the case released.')
    return journey
  })

  const advisorRecordAdvice = (details) => runAdvisorAction(async (caseId) => {
    if (!selectedCase.leadAcceptedAt) await acceptLead(caseId, details.advisor)
    if (!selectedCase.appointmentAt) {
      await bookAppointment(caseId, {
        appointmentAt: new Date().toISOString(),
        advisor: details.advisor,
        channel: details.channel,
      })
    }
    return recordRecommendation(caseId, details)
  }).then((journey) => {
    if (journey) notify('Advice recorded against the case.')
    return journey
  })

  /** Issues the formal maturity pack once an advisor has recorded an option. */
  const issueFormalPack = async () => {
    setCaseActionBusy(true)
    setCaseActionError('')
    try {
      await issueMaturityPackages()
      await refreshCases()
      setJourneyReload((count) => count + 1)
      notify('Formal maturity pack issued. Maria has been asked for her documents.')
    } catch (error) {
      setCaseActionError(error instanceof Error ? error.message : 'Could not issue the formal pack.')
    } finally {
      setCaseActionBusy(false)
    }
  }

  const selectRole = (nextRole) => {
    setRole(nextRole)
    setCustomerFocus('')
    window.scrollTo({ top: 0 })
  }

  /**
   * Puts Maria's case into the state a chapter needs, using the real
   * endpoints. A case that is further on than the chapter is rewound by
   * restoring the demo data. A newer chapter change cancels an older one.
   */
  const prepareForStep = async (step) => {
    if (!step?.requires || !step.caseId) return
    const token = prepToken.current + 1
    prepToken.current = token
    const stale = () => prepToken.current !== token
    setPrepState({ busy: true, error: '' })
    try {
      const find = (records) => records.find((item) => item.caseId === step.caseId)
      let records = await fetchCases()
      let current = find(records)
      if (current && journeyRank(current.caseStatus) > journeyRank(step.advancesTo || step.requires)) {
        if (stale()) return
        records = await resetDemoData()
        current = find(records)
      }
      for (let guard = 0; guard < 10 && current; guard += 1) {
        if (stale()) return
        const status = current.caseStatus
        if (journeyRank(status) === -1 || journeyRank(status) >= journeyRank(step.requires)) break
        if (status === 'NON_CLE_OWNER_DETECTED' || status === 'CLE_OWNER_DETECTED') {
          await requestAdvice(step.caseId, 'LUMP_SUM')
        } else if (status === 'ADVICE_REQUESTED' || status === 'APPOINTMENT_BOOKED') {
          if (!current.leadAcceptedAt) await acceptLead(step.caseId, 'Broker')
          if (!current.appointmentAt) {
            await bookAppointment(step.caseId, {
              appointmentAt: new Date().toISOString(), advisor: 'Broker', channel: 'Telephone',
            })
          }
          await recordRecommendation(step.caseId, {
            recommendedOption: 'ANNUITY', rationale: DEFAULT_RATIONALE, advisor: 'Broker', channel: 'Telephone',
          })
        } else if (status === 'IN_PROGRESS') {
          await issueMaturityPackages()
        } else if (status === 'MATURITY_PACKAGE_SENT' || status === 'AWAITING_INFORMATION') {
          for (const documentType of current.outstandingDocuments ?? []) {
            await recordJourneyDocument(
              step.caseId, documentType, `${documentType.toLowerCase()}.pdf`,
              documentType === 'BANK_DETAILS' ? DEMO_ACCOUNT_HOLDER : null,
            )
          }
        } else if (status === 'ON_HOLD') {
          await resolveCaseException(step.caseId, DEFAULT_REVIEW_NOTE)
        } else {
          break
        }
        records = await fetchCases()
        current = find(records)
      }
      if (stale()) return
      setCaseLoadState({ status: 'success', cases: records.map(mapBackendCase), error: '' })
      setJourneyReload((count) => count + 1)
      setPrepState({ busy: false, error: '' })
    } catch (error) {
      if (stale()) return
      setPrepState({ busy: false, error: error instanceof Error ? error.message : 'Could not prepare this chapter.' })
    }
  }

  const goToDemoStep = (index) => {
    const step = demoFlowSteps[index]
    if (!step) return
    if (demoStep && demoStep.role !== step.role && !step.slide) {
      setHandoff({ step, key: Date.now() })
      window.setTimeout(() => setHandoff(null), 1600)
    }
    setDemoStepIndex(index)
    setRole(step.role)
    if (step.caseId) setSelectedCaseId(step.caseId)
    if (step.role === 'caseworker') setCaseworkerPage(step.caseworkerPage ?? 'queue')
    if (step.role === 'broker') setBrokerPage(step.brokerPage ?? 'list')
    setCustomerFocus(step.customerFocus ?? '')
    setOptionReview(null)
    setCaseActionError('')
    setJourneyReload((count) => count + 1)
    scrolledTarget.current = null
    window.scrollTo({ top: 0 })
    prepareForStep(step)
  }

  // While the demo runs, keep the case list fresh so work the platform does on
  // its own (such as issuing the formal pack) appears without a click.
  useEffect(() => {
    if (demoStepIndex === null) return undefined
    const timer = window.setInterval(() => {
      fetchCases()
        .then((records) => setCaseLoadState({ status: 'success', cases: records.map(mapBackendCase), error: '' }))
        .catch(() => {})
    }, 4000)
    return () => window.clearInterval(timer)
  }, [demoStepIndex])

  const restoreDemoData = async () => {
    setCaseActionBusy(true)
    try {
      const records = await resetDemoData()
      setCaseLoadState({ status: 'success', cases: records.map(mapBackendCase), error: '' })
      setJourneyReload((count) => count + 1)
      notify('Demo data restored.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not reset the demo data.')
    } finally {
      setCaseActionBusy(false)
    }
  }

  const exitDemoFlow = () => {
    setDemoStepIndex(null)
    setCustomerFocus('')
  }

  // The live chapter's next click gets a pulsing ring, so the driver never
  // hunts for it and the audience's eye follows.
  const demoStepDone = Boolean(demoStep?.advancesTo && selectedCase?.id === demoStep.caseId
    && journeyRank(selectedCase.backendStatus) >= journeyRank(demoStep.advancesTo))
  useEffect(() => {
    document.querySelectorAll('.demo-highlight').forEach((element) => element.classList.remove('demo-highlight'))
    if (!demoStep?.highlight || demoStepDone || prepState.busy || handoff) return
    const target = document.querySelector(demoStep.highlight)
    if (!target) return
    target.classList.add('demo-highlight')
    if (demoStep.scrollToHighlight && scrolledTarget.current !== target) {
      scrolledTarget.current = target
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })

  useEffect(() => {
    if (demoStepIndex === null) return undefined

    const onKeyDown = (event) => {
      const tag = event.target instanceof HTMLElement ? event.target.tagName : ''
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (!prepState.busy) goToDemoStep(Math.min(demoStepIndex + 1, demoFlowSteps.length - 1))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (!prepState.busy) goToDemoStep(Math.max(demoStepIndex - 1, 0))
      } else if (event.key === 'Escape') {
        // Close an open statement first rather than leaving the demo.
        if (customerFocus) setCustomerFocus('')
        else exitDemoFlow()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className={`app-shell role-${role}${demoStep ? ' demo-flow-active' : ''}`}>
      {role === 'caseworker' ? (
        <CaseworkerView
          cases={viewCases}
          demoFocused={demoFocused}
          selectedCase={selectedCase}
          selectedPage={caseworkerPage}
          loading={caseLoadState.status === 'loading'}
          error={caseLoadState.status === 'error' ? caseLoadState.error : ''}
          onRetry={reloadCases}
          onSelectPage={setCaseworkerPage}
          onSelectCase={(item) => {
            setSelectedCaseId(item.id)
            setCaseworkerPage('case')
          }}
          onBack={() => setCaseworkerPage('queue')}
          onRunJourney={runLiveJourney}
          workflowBusy={workflowBusy}
          workflowResult={workflowResult}
          caseActionBusy={caseActionBusy}
          caseActionError={caseActionError}
          onRequestInformation={persistCaseAction}
          onIssueFormalPack={issueFormalPack}
          onResolveException={caseworkerResolveException}
          highlightCaseId={demoStep?.caseId || ''}
          efficiencyState={efficiencyState}
          onRetryEfficiency={() => setCaseReload((count) => count + 1)}
          onPreviewCustomer={(caseId) => {
            setSelectedCaseId(caseId)
            selectRole('customer')
          }}
        />
      ) : null}
      {role === 'broker' ? (
        <BrokerCasesView
          cases={viewCases.filter((item) => item.ownerType === 'NON_CLE')}
          selectedCase={selectedCase}
          loading={caseLoadState.status === 'loading'}
          error={caseLoadState.status === 'error' ? caseLoadState.error : ''}
          onRetry={reloadCases}
          onSelectCase={setSelectedCaseId}
          onNotify={notify}
          page={brokerPage}
          onSelectPage={setBrokerPage}
          actionBusy={caseActionBusy}
          actionError={caseActionError}
          onRequestInformation={persistCaseAction}
          onAcceptLead={advisorAcceptLead}
          onScheduleConversation={advisorScheduleConversation}
          onRecordAdvice={advisorRecordAdvice}
          onPreviewCustomer={(caseId) => {
            setSelectedCaseId(caseId)
            selectRole('customer')
          }}
        />
      ) : null}
      {role === 'customer' ? (
        <CustomerView
          cases={viewCases}
          demoActive={Boolean(demoStep)}
          selectedCase={selectedCase}
          casesLoading={caseLoadState.status === 'loading'}
          casesError={caseLoadState.status === 'error' ? caseLoadState.error : ''}
          journeyState={currentJourneyState}
          focus={customerFocus}
          optionReview={optionReview}
          onOptionReview={setOptionReview}
          onOpenStatement={() => setCustomerFocus('annual-statement')}
          onSeeOptionsInDemo={demoStep?.id === 'statement' ? () => goToDemoStep(demoStepIndex + 1) : null}
          onClearFocus={() => setCustomerFocus('')}
          onSelectCase={(id) => setSelectedCaseId(id)}
          onRetryCases={reloadCases}
          onRetryJourney={() => setJourneyReload((count) => count + 1)}
          onRequestAdvice={submitAdviceRequest}
          onSubmitDocument={submitJourneyDocument}
          demoAccountHolder={demoStep ? DEMO_ACCOUNT_HOLDER : null}
          onNotify={notify}
        />
      ) : null}

      {demoStep?.slide ? <DemoSlide kind={demoStep.slide} key={demoStep.slide} /> : null}
      {handoff ? <DemoHandoff step={handoff.step} key={handoff.key} /> : null}
      {demoStep ? (
        <DemoCaption
          steps={demoFlowSteps}
          stepIndex={demoStepIndex}
          step={demoStep}
          done={demoStepDone}
          preparing={prepState.busy}
          error={prepState.error || caseActionError || currentJourneyState.actionError}
          resetBusy={caseActionBusy}
          onStep={goToDemoStep}
          onReset={async () => {
            await restoreDemoData()
            goToDemoStep(0)
          }}
          onExit={exitDemoFlow}
        />
      ) : (
        <RoleSwitcher role={role} onChange={selectRole} onStartDemo={() => goToDemoStep(0)} />
      )}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}

function RoleSwitcher({ role, onChange, onStartDemo }) {
  return (
    <div className="role-switcher" aria-label="Demo role selector">
      <button className="demo-flow-launch" type="button" onClick={onStartDemo}>
        <span aria-hidden="true">▶</span> Start demo
      </button>
      <span>View as</span>
      {[
        ['customer', 'Customer'],
        ['broker', 'Broker'],
        ['caseworker', 'Case worker'],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={role === value ? 'role-option active' : 'role-option'}
          aria-pressed={role === value}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * The demo's caption: one chapter title and one plain sentence, written for
 * the audience. Driver-only controls (reset, exit) sit behind the menu.
 */
function DemoCaption({
  steps, stepIndex, step, done, preparing, error, resetBusy, onStep, onReset, onExit,
}) {
  const barRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // Keep the page's bottom padding in step with the bar so nothing hides behind it.
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return undefined
    const apply = () => document.documentElement.style.setProperty('--demo-rail-height', `${bar.offsetHeight}px`)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--demo-rail-height')
    }
  }, [])

  return (
    <aside className="demo-caption" aria-label="Guided demo" ref={barRef}>
      <ol className="demo-caption-dots" aria-label="Chapters">
        {steps.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              className={index === stepIndex ? 'current' : index < stepIndex ? 'done' : ''}
              aria-label={`Chapter ${index + 1}: ${item.title}`}
              aria-current={index === stepIndex ? 'step' : undefined}
              onClick={() => onStep(index)}
            />
          </li>
        ))}
      </ol>
      <div className="demo-caption-copy" role="status">
        <span className="demo-caption-when">{step.when}</span>
        <strong>{step.title}</strong>
        <p className={preparing ? 'demo-caption-preparing' : done ? (step.doneTone === 'warn' ? 'demo-caption-warn' : 'demo-caption-done') : ''}>
          {preparing
            ? 'Preparing this step…'
            : done && step.done ? `${step.doneTone === 'warn' ? '⚠' : '✓'} ${step.done}` : step.line}
        </p>
        {error && !preparing ? <small className="demo-caption-error">{error}</small> : null}
      </div>
      <div className="demo-caption-controls">
        <button className="button button-secondary" type="button" disabled={stepIndex === 0 || preparing} onClick={() => onStep(stepIndex - 1)}>
          ←
        </button>
        <button className="button button-primary" type="button" disabled={stepIndex === steps.length - 1 || preparing} onClick={() => onStep(stepIndex + 1)}>
          Next →
        </button>
        <div className="demo-caption-menu">
          <button className="text-button" type="button" aria-expanded={menuOpen} aria-label="Demo menu" onClick={() => setMenuOpen((open) => !open)}>
            ⚙
          </button>
          {menuOpen ? (
            <div className="demo-caption-menu-list">
              <button type="button" disabled={resetBusy} onClick={() => { setMenuOpen(false); onReset() }}>
                {resetBusy ? 'Resetting…' : 'Restart demo'}
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onExit() }}>Exit demo</button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

/** Content for the presentation slides that open and close the demo. */
const teamMembers = [
  'Sean Breen', 'Niamh Conolly', 'Joshua Flores', 'Karl Mcintyre', 'Mihir Pednekar', 'Dmytro Proskurin',
]

const roleCards = [
  ['MS', 'Customer', 'Sees her options early and asks for advice online.', 'customer'],
  ['BC', 'Broker', 'Gets a ready-to-advise lead, with everything on one screen.', 'broker'],
  ['CO', 'CLE Operations', 'Steps in only when something needs a person.', 'caseworker'],
]

/** Maturing policies by end date (team analysis), by product type. */
const maturityWave = [
  { year: 2024, bav: 1218, basic: 965, privat: 4222, biometry: 521 },
  { year: 2025, bav: 1280, basic: 1088, privat: 4001, biometry: 602 },
  { year: 2026, bav: 1738, basic: 1297, privat: 5155, biometry: 723 },
  { year: 2027, bav: 2090, basic: 1463, privat: 5486, biometry: 781 },
  { year: 2028, bav: 2412, basic: 1720, privat: 6129, biometry: 730 },
  { year: 2029, bav: 2844, basic: 2018, privat: 7156, biometry: 885 },
  { year: 2030, bav: 3297, basic: 2145, privat: 7242, biometry: 1028 },
  { year: 2031, bav: 3724, basic: 2241, privat: 7704, biometry: 1184 },
  { year: 2032, bav: 4162, basic: 2280, privat: 8101, biometry: 1020 },
  { year: 2033, bav: 4365, basic: 2417, privat: 8080, biometry: 1033 },
  { year: 2034, bav: 4472, basic: 2341, privat: 8096, biometry: 1351 },
].map((row) => ({ ...row, total: row.bav + row.basic + row.privat + row.biometry }))

const opportunityStats = [
  ['+82%', 'more policies maturing by 2034: from 8,913 to 16,260 a year'],
  ['38.5%', 'team capacity freed by automation: 3.04 to 1.87 FTE for the same workload'],
  ['9 → 1', 'manual touches per case: today’s estimate against our journey'],
]

const numberFormat = new Intl.NumberFormat('en-IE')

/**
 * Total maturing policies per year. One series, so one hue: the start and end
 * of the wave are emphasised and labelled, and hovering a year shows its mix.
 */
function MaturityWaveChart() {
  const [hovered, setHovered] = useState(null)
  const width = 560
  const height = 280
  const margin = { top: 28, right: 8, bottom: 30, left: 44 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const max = 18000
  const band = plotWidth / maturityWave.length
  const barWidth = band - 10
  const y = (value) => margin.top + plotHeight - (value / max) * plotHeight
  const emphasised = (year) => year === 2026 || year === 2034
  const active = hovered === null ? null : maturityWave[hovered]

  return (
    <figure className="wave-chart">
      <figcaption>
        <strong>Policies maturing each year</strong>
        <span>2024–2034, all product types · hover a year for the mix</span>
      </figcaption>
      <div className="wave-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Maturing policies per year rise from 6,926 in 2024 to 16,260 in 2034">
          {[0, 5000, 10000, 15000].map((tick) => (
            <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="wave-grid" />
              <text x={margin.left - 8} y={y(tick) + 4} className="wave-axis" textAnchor="end">
                {tick === 0 ? '0' : `${tick / 1000}k`}
              </text>
            </g>
          ))}
          {maturityWave.map((row, index) => {
            const x = margin.left + index * band + 5
            const top = y(row.total)
            const barHeight = margin.top + plotHeight - top
            const r = 4
            // Rounded top, square base anchored to the baseline.
            const path = `M${x},${top + barHeight} V${top + r} Q${x},${top} ${x + r},${top} H${x + barWidth - r} Q${x + barWidth},${top} ${x + barWidth},${top + r} V${top + barHeight} Z`
            return (
              <g key={row.year}>
                <path d={path} className={emphasised(row.year) ? 'wave-bar wave-bar-strong' : 'wave-bar'} />
                {emphasised(row.year) ? (
                  <text x={x + barWidth / 2} y={top - 8} textAnchor="middle" className="wave-value">
                    {numberFormat.format(row.total)}
                  </text>
                ) : null}
                <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="wave-axis">
                  {String(row.year).slice(2)}
                </text>
                <rect
                  x={margin.left + index * band}
                  y={margin.top}
                  width={band}
                  height={plotHeight}
                  className="wave-hit"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            )
          })}
        </svg>
        {active ? (
          <div
            className="wave-tooltip"
            style={{ left: `${((margin.left + hovered * band + band / 2) / width) * 100}%` }}
            role="status"
          >
            <strong>{active.year} · {numberFormat.format(active.total)} policies</strong>
            <span>bAV {numberFormat.format(active.bav)}</span>
            <span>Basic {numberFormat.format(active.basic)}</span>
            <span>Private {numberFormat.format(active.privat)}</span>
            <span>Biometry {numberFormat.format(active.biometry)}</span>
          </div>
        ) : null}
      </div>
      <table className="visually-hidden">
        <caption>Maturing policies per year</caption>
        <thead><tr><th>Year</th><th>bAV</th><th>Basic</th><th>Private</th><th>Biometry</th><th>Total</th></tr></thead>
        <tbody>
          {maturityWave.map((row) => (
            <tr key={row.year}>
              <td>{row.year}</td><td>{row.bav}</td><td>{row.basic}</td><td>{row.privat}</td><td>{row.biometry}</td><td>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <small className="wave-source">Source: team analysis of maturing policies by end date (bAV, basic, private, biometry).</small>
    </figure>
  )
}

const nextSteps = [
  {
    title: 'German-language journeys',
    detail: 'Customer portal, statements and broker workspace in German, with German date and currency formats. Customer wording reviewed by Legal and Compliance.',
  },
  {
    title: 'Agent-assisted operations',
    detail: 'AI agents read uploaded documents, flag conflicts, summarise cases for brokers and case workers, and draft targeted requests within approved templates.',
  },
  {
    title: 'Deterministic controls',
    detail: 'Eligibility, routing, deadlines and payment calculations stay rule-based and auditable. Agents assist; they do not make binding decisions.',
  },
  {
    title: 'Integration and pilot',
    detail: 'Connect to iSuite and MSG Life Factory events, Salesforce and CCM, then pilot with a small group of brokers, measuring touchpoints, STP rate and lead acceptance.',
  },
]

/** Staggered build-in for slide elements. */
const reveal = (order) => ({ animationDelay: `${0.12 + order * 0.12}s` })

/** Full-screen presentation slide shown in place of the app. */
function DemoSlide({ kind }) {
  if (kind === 'solution') {
    return (
      <div className="demo-slide" role="presentation">
        <div className="demo-slide-card demo-slide-split">
          <div>
            <p className="eyebrow demo-reveal" style={reveal(0)}>01 / OUR SOLUTION</p>
            <p className="demo-slide-label demo-reveal" style={reveal(1)}>SOLUTION SUMMARY</p>
            <h1 className="demo-reveal" style={reveal(1)}>
              Retirement Hub
              <span>Every maturity handled early. Only exceptions need a person.</span>
            </h1>
            <p className="demo-slide-label demo-reveal" style={reveal(2)}>SOLUTION DESCRIPTION</p>
            <ul className="demo-slide-points demo-reveal" style={reveal(2)}>
              <li><strong>Starts at T-12</strong>, not T-3: every maturity case opens a year early.</li>
              <li><strong>Routes automatically</strong> to the right broker or in-house advisor.</li>
              <li><strong>Guides the customer</strong> from options to advice to payment, online.</li>
            </ul>
            <p className="demo-slide-label demo-reveal" style={reveal(3)}>TEAM 6</p>
            <ul className="demo-slide-team demo-reveal" style={reveal(3)}>
              {teamMembers.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </div>
          <div className="demo-slide-roles demo-slide-roles-stacked">
            {roleCards.map(([initialsText, name, detail, tone], index) => (
              <div className={`demo-slide-role demo-reveal role-tone-${tone}`} style={reveal(4 + index)} key={name}>
                <span className="demo-slide-avatar">{initialsText}</span>
                <div><strong>{name}</strong><p>{detail}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'opportunity') {
    return (
      <div className="demo-slide" role="presentation">
        <div className="demo-slide-card">
          <p className="eyebrow demo-reveal" style={reveal(0)}>THE OPPORTUNITY</p>
          <h1 className="demo-reveal" style={reveal(1)}>Maturities nearly double by 2034. Capacity has to be ready first.</h1>
          <div className="demo-slide-opportunity">
            <div className="demo-slide-stats demo-slide-stats-stacked">
              {opportunityStats.map(([figure, text], index) => (
                <div className="demo-slide-stat demo-reveal" style={reveal(2 + index)} key={figure}>
                  <strong>{figure}</strong>
                  <p>{text}</p>
                </div>
              ))}
            </div>
            <div className="demo-reveal" style={reveal(5)}>
              <MaturityWaveChart />
            </div>
          </div>
          <p className="demo-slide-footnote demo-reveal" style={reveal(6)}>
            Without automation, we hire at the pace of the wave. With Retirement Hub, today’s teams absorb it and
            focus on the cases that need them.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="demo-slide" role="presentation">
      <div className="demo-slide-card demo-next-card">
        <p className="eyebrow demo-reveal" style={reveal(0)}>NEXT STEPS</p>
        <h1 className="demo-reveal" style={reveal(1)}>From prototype to pilot</h1>
        <ol className="demo-next-list">
          {nextSteps.map((item, index) => (
            <li className="demo-reveal" style={reveal(2 + index)} key={item.title}>
              <span aria-hidden="true">{index + 1}</span>
              <div><strong>{item.title}</strong><p>{item.detail}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** Shown for a moment when the demo moves to another person. */
function DemoHandoff({ step }) {
  const persona = personas[step.role]
  return (
    <div className={`demo-handoff audience-${persona.tone}`} aria-live="polite">
      <span>{step.when}</span>
      <strong>{persona.name}</strong>
      <small>{persona.role}</small>
    </div>
  )
}

function Brand({ subline }) {
  return (
    <div className="brand-lockup">
      <div className="brand-logo-block">
        <img className="brand-logo" src="/canada-life-logo-white.svg" alt="Canada Life" />
      </div>
      {subline ? <div className="brand-subline">{subline}</div> : null}
    </div>
  )
}

const dateTimeFormat = new Intl.DateTimeFormat('en-IE', {
  day: 'numeric', month: 'short', year: 'numeric',
})

function formatEventDate(value) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : dateTimeFormat.format(parsed)
}

/**
 * Audit trail for a case. Separating automated from manual entries is what makes
 * the operational saving visible rather than asserted.
 */
function CaseAuditTrail({ events }) {
  if (!events.length) {
    return (
      <section className="panel audit-trail">
        <PanelHeading title="Audit trail" detail="Every state transition and decision recorded against this case" />
        <p className="muted-copy">No transitions recorded for this case yet.</p>
      </section>
    )
  }

  const automated = events.filter((event) => event.automated).length
  const manual = events.length - automated
  const ordered = [...events].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <section className="panel audit-trail">
      <PanelHeading
        title="Audit trail"
        detail={`${events.length} transitions · ${automated} automated · ${manual} needed a person`}
      />
      <ol className="audit-trail-list">
        {ordered.map((event, index) => (
          <li className={event.automated ? 'audit-entry automated' : 'audit-entry manual'} key={`${event.action}-${event.at}-${index}`}>
            <div className="audit-entry-head">
              <strong>{auditActionLabels[event.action] || event.action}</strong>
              {auditActionLabels[event.action] ? <code>{event.action}</code> : null}
              <span className={event.automated ? 'audit-actor automated' : 'audit-actor manual'}>
                {event.automated ? 'Automated' : event.actor}
              </span>
              <span className="audit-date">{formatEventDate(event.at)}</span>
            </div>
            <p>{event.detail}</p>
            {event.status ? <small>Case became: {staffStatus(event.status)}</small> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Operational efficiency dashboard: the headline outcome of the lane model. */
function EfficiencyDashboard({ state, onRetry }) {
  if (state.status === 'loading') {
    return (
      <section className="panel connection-state" role="status">
        <div className="loading-indicator" aria-hidden="true" />
        <div><strong>Loading efficiency measures</strong><p>Counting lanes and touchpoints…</p></div>
      </section>
    )
  }

  if (state.status === 'error' || !state.data) {
    return (
      <section className="panel connection-state connection-error" role="alert">
        <div><strong>Could not load efficiency measures</strong><p>{state.error}</p></div>
        <button className="button button-primary" type="button" onClick={onRetry}>Retry</button>
      </section>
    )
  }

  const metrics = state.data
  const laneRows = [
    ['GREEN', metrics.greenCases, 'Complete and ready for payment'],
    ['AMBER', metrics.amberCases, 'One item outstanding, targeted request sent'],
    ['RED', metrics.redCases, 'Awaiting a case worker decision'],
  ]
  // Bars are sized against the classified portfolio so they read as a share of
  // the whole, not relative to whichever lane happens to be largest.
  const laneDenominator = Math.max(1, metrics.classifiedCases)

  // The headline: what the journey removes, and where people still help.
  return (
      <div className="efficiency-summary">
        <article className="efficiency-hero efficiency-hero-large">
          <p className="eyebrow">MANUAL ADMIN AVOIDED</p>
          <strong>{Math.round(metrics.manualEffortReductionPercent)}%</strong>
          <span>
            {metrics.manualTouchpointsAvoided} of {metrics.baselineManualTouchpoints} manual touches removed
            across these maturities
          </span>
        </article>
        <section className="panel">
          <PanelHeading title="Where people still help" detail="Only the cases that need a person reach one" />
          <div className="lane-bars">
            {laneRows.map(([lane, count, detail]) => (
              <div className="lane-bar-row" key={lane}>
                <LanePill lane={lane} />
                <div className="lane-bar-track">
                  <div className={`lane-bar-fill lane-fill-${laneMeta[lane].tone}`} style={{ width: `${(count / laneDenominator) * 100}%` }} />
                </div>
                <strong className="lane-bar-count">{count}</strong>
                <span className="lane-bar-detail">{detail}</span>
              </div>
            ))}
          </div>
        </section>
        <p className="efficiency-assumption">
          Baseline: an assumed {metrics.baselineManualTouchpointsPerCase} manual operational touchpoints per maturity
          in today’s process. This is a stated assumption, not a measured figure. Advice conversations and
          customer self-service are not counted as operational handling.
        </p>
      </div>
    )
}

function CaseworkerView({
  cases,
  selectedCase,
  selectedPage,
  loading,
  error,
  onRetry,
  onSelectPage,
  onSelectCase,
  onBack,
  onRunJourney,
  workflowBusy,
  workflowResult,
  caseActionBusy,
  caseActionError,
  onRequestInformation,
  onIssueFormalPack,
  onResolveException,
  highlightCaseId,
  efficiencyState,
  onRetryEfficiency,
  onPreviewCustomer,
  demoFocused,
}) {
  const [queueFilter, setQueueFilter] = useState('all')
  const [workflowExpanded, setWorkflowExpanded] = useState(false)

  if (selectedPage === 'timeline' && selectedCase) {
    return (
      <div className="staff-layout">
        <aside className="sidebar">
          <Brand subline="Retirement Hub" />
          <SidebarLink active onClick={onBack}>Case queue</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('all')}>All cases</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('exceptions')}>Exceptions</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('lanes')}>Lanes</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('efficiency')}>Efficiency</SidebarLink>
          <div className="sidebar-footer">CLE Operations<br /><span>Case worker</span></div>
        </aside>
        <main className="staff-main">
          <button className="text-button back-link" type="button" onClick={() => onSelectPage('case')}>← Back to case</button>
          <JourneyTimeline selectedCase={selectedCase} />
        </main>
      </div>
    )
  }

  if (selectedPage === 'case' && selectedCase) {
    return (
      <div className="staff-layout">
        <aside className="sidebar">
          <Brand subline="Retirement Hub" />
          <SidebarLink active onClick={onBack}>Case queue</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('all')}>All cases</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('exceptions')}>Exceptions</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('lanes')}>Lanes</SidebarLink>
          <SidebarLink onClick={() => onSelectPage('efficiency')}>Efficiency</SidebarLink>
          <div className="sidebar-footer">CLE Operations<br /><span>Case worker</span></div>
        </aside>
        <main className="staff-main">
          <button className="text-button back-link" type="button" onClick={onBack}>← Back to case queue</button>
          <BackendCaseDetail
            selectedCase={selectedCase}
            actionBusy={caseActionBusy}
            actionError={caseActionError}
            onRequestInformation={onRequestInformation}
            onIssueFormalPack={onIssueFormalPack}
            onResolveException={onResolveException}
            onPreviewCustomer={onPreviewCustomer}
            onViewTimeline={() => onSelectPage('timeline')}
          />
        </main>
      </div>
    )
  }

  const showingAll = selectedPage === 'all'
  const showingExceptions = selectedPage === 'exceptions'
  const showingEfficiency = selectedPage === 'efficiency'
  const showingLanes = selectedPage === 'lanes'
  const redCases = cases.filter((item) => caseSignal(item.backendStatus) === 'red')
  const amberCases = cases.filter((item) => caseSignal(item.backendStatus) === 'amber')
  const greenCases = cases.filter((item) => caseSignal(item.backendStatus) === 'green')
  const activeCases = cases.filter((item) => caseSignal(item.backendStatus) === 'neutral')
  const activeFilter = showingExceptions ? 'red' : queueFilter
  const filteredCases = activeFilter === 'all'
    ? cases
    : cases.filter((item) => caseSignal(item.backendStatus) === activeFilter)

  return (
    <div className="staff-layout">
      <aside className="sidebar">
        <Brand subline="Retirement Hub" />
        <SidebarLink active={selectedPage === 'queue'} onClick={() => onSelectPage('queue')}>Case queue</SidebarLink>
        <SidebarLink active={showingAll} onClick={() => onSelectPage('all')}>All cases</SidebarLink>
        <SidebarLink active={showingExceptions} badge={redCases.length} onClick={() => onSelectPage('exceptions')}>Exceptions</SidebarLink>
        <SidebarLink active={showingLanes} onClick={() => onSelectPage('lanes')}>Lanes</SidebarLink>
        <SidebarLink active={showingEfficiency} onClick={() => onSelectPage('efficiency')}>Efficiency</SidebarLink>
        <div className="sidebar-footer">CLE Operations<br /><span>Case worker</span></div>
      </aside>
      <main className="staff-main">
        <header className="page-heading">
          <div>
            <p className="eyebrow">MATURITY OPERATIONS</p>
            <h1>
              {showingLanes
                ? 'Lanes'
                : showingEfficiency
                  ? 'Efficiency'
                  : showingExceptions ? 'Exceptions' : showingAll ? 'All cases' : 'Case queue'}
            </h1>
            <p className="muted-copy">
              {showingLanes
                ? 'Green is processed automatically, amber has one item outstanding, red needs a case worker.'
                : showingEfficiency
                  ? 'Operational workload across all maturity cases.'
                  : showingExceptions
                    ? 'Cases the platform stopped so a person can review them.'
                    : showingAll
                      ? 'Every maturity case, whatever its stage.'
                      : 'Policies maturing in the next 12 months.'}
            </p>
          </div>
        </header>
        {showingLanes ? (
          <LaneComparison cases={cases} onOpen={onSelectCase} />
        ) : showingEfficiency ? (
          <EfficiencyDashboard state={efficiencyState} onRetry={onRetryEfficiency} />
        ) : loading ? (
          <section className="panel connection-state" role="status">
            <div className="loading-indicator" aria-hidden="true" />
            <div><strong>Loading cases</strong><p>Fetching the latest maturity cases…</p></div>
          </section>
        ) : error ? (
          <section className="panel connection-state connection-error" role="alert">
            <div>
              <strong>Could not load cases</strong>
              <p>{error}</p>
              <p>Check that the backend is running and the API base URL is correct, then retry.</p>
            </div>
            <button className="button button-primary" type="button" onClick={onRetry}>Retry</button>
          </section>
        ) : (
          <>
            {!showingAll && !showingExceptions && !demoFocused ? (
              <section className="panel live-workflow-panel">
                <header className="live-workflow-toggle">
                  <div>
                    <h2>Add a maturing policy</h2>
                    <p>Create a test policy and watch the platform open a case and route it to the right advisor.</p>
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    aria-expanded={workflowExpanded}
                    onClick={() => setWorkflowExpanded((expanded) => !expanded)}
                  >
                    {workflowExpanded ? 'Hide workflow' : 'Show workflow'}
                    <span aria-hidden="true">{workflowExpanded ? '−' : '+'}</span>
                  </button>
                </header>
                {workflowExpanded ? (
                  <LivePolicyWorkflow
                    busy={workflowBusy}
                    result={workflowResult}
                    onSubmit={onRunJourney}
                  />
                ) : null}
              </section>
            ) : null}
            {!demoFocused ? (<>
            <div className="metric-grid">
              <Metric label="Maturity cases" value={cases.length} />
              <Metric label="Needs attention" value={redCases.length} tone="red" />
              <Metric label="In progress" value={amberCases.length + activeCases.length} tone="amber" />
            </div>
            <section className="case-signal-overview" aria-label="Case status overview">
              <button
                className={`signal-card signal-red ${activeFilter === 'red' ? 'signal-selected' : ''}`}
                type="button"
                onClick={() => showingExceptions ? onSelectPage('exceptions') : setQueueFilter('red')}
              >
                <span className="signal-dot" aria-hidden="true" />
                <span><strong>Needs attention</strong><small>Stopped for a person to review</small></span>
                <b>{redCases.length}</b>
              </button>
              <button
                className={`signal-card signal-amber ${activeFilter === 'amber' ? 'signal-selected' : ''}`}
                type="button"
                onClick={() => {
                  if (showingExceptions) onSelectPage('queue')
                  setQueueFilter('amber')
                }}
              >
                <span className="signal-dot" aria-hidden="true" />
                <span><strong>In progress</strong><small>Waiting on a customer or next step</small></span>
                <b>{amberCases.length}</b>
              </button>
              <button
                className={`signal-card signal-green ${activeFilter === 'green' ? 'signal-selected' : ''}`}
                type="button"
                onClick={() => {
                  if (showingExceptions) onSelectPage('queue')
                  setQueueFilter('green')
                }}
              >
                <span className="signal-dot" aria-hidden="true" />
                <span><strong>Completed</strong><small>Journey marked complete</small></span>
                <b>{greenCases.length}</b>
              </button>
              <button
                className={`signal-card signal-neutral ${activeFilter === 'neutral' ? 'signal-selected' : ''}`}
                type="button"
                onClick={() => {
                  if (showingExceptions) onSelectPage('queue')
                  setQueueFilter('neutral')
                }}
              >
                <span className="signal-dot" aria-hidden="true" />
                <span><strong>Moving on its own</strong><small>No one needs to act yet</small></span>
                <b>{activeCases.length}</b>
              </button>
            </section>
            </>) : null}
            <section className="panel">
              <PanelHeading
                title={showingExceptions ? 'Cases needing attention' : showingAll ? 'All cases' : 'Case queue'}
                detail={`${filteredCases.length} of ${cases.length} case${cases.length === 1 ? '' : 's'}`}
                action={
                  <div className="queue-actions">
                    {!showingExceptions ? (
                      <button className="text-button" type="button" onClick={() => setQueueFilter('all')}>Show all</button>
                    ) : null}
                    <button className="text-button" type="button" onClick={onRetry}>Refresh</button>
                  </div>
                }
              />
              {filteredCases.length ? (
                <BackendCasesTable cases={filteredCases} onOpen={onSelectCase} highlightCaseId={highlightCaseId} />
              ) : (
                <EmptyState
                  title={showingExceptions || activeFilter === 'red' ? 'No red exceptions' : 'No cases in this view'}
                  detail={showingExceptions || activeFilter === 'red'
                    ? 'Nothing needs a person right now.'
                    : 'Try another status filter or refresh the case list.'}
                />
              )}
            </section>
            <p className="prototype-note" hidden={demoFocused}>
              <strong>Colours:</strong> red needs a person, amber is waiting on the customer or advisor, green is done. Grey cases are moving on their own.
            </p>
          </>
        )}
      </main>
    </div>
  )
}

function localDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function LivePolicyWorkflow({ busy, result, onSubmit }) {
  const [dateDefaults] = useState(() => {
    const today = new Date()
    const maturity = new Date(today)
    maturity.setMonth(maturity.getMonth() + 6)
    return { today: localDateInput(today), maturity: localDateInput(maturity) }
  })
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const riskCommencementDate = String(form.get('riskCommencementDate'))
    const maturityDate = String(form.get('maturityDate'))
    if (maturityDate <= riskCommencementDate) {
      setError('Maturity date must be after the policy start date.')
      return
    }
    const today = new Date()
    const latestMaturity = new Date(today)
    latestMaturity.setFullYear(latestMaturity.getFullYear() + 1)
    if (maturityDate <= localDateInput(today) || maturityDate > localDateInput(latestMaturity)) {
      setError('Choose a maturity date within the next 12 months. That is when the journey starts.')
      return
    }

    onSubmit({
      policyId: String(form.get('policyId')).trim() || null,
      riskCommencementDate,
      maturityDate,
      partnerId: String(form.get('partnerId')).trim(),
      owner: String(form.get('owner')),
    })
    event.currentTarget.reset()
  }

  return (
      <form className="live-workflow-form" onSubmit={handleSubmit}>
        <label>
          Customer reference
          <input name="partnerId" required placeholder="e.g. PARTNER-DEMO-10004" />
        </label>
        <label>
          Policy number <span className="form-hint">(optional)</span>
          <input name="policyId" placeholder="Generated if left blank" />
        </label>
        <label>
          Who advises this customer?
          <select name="owner" defaultValue="EXTERNAL-BROKER">
            <option value="EXTERNAL-BROKER">A broker (broker-managed)</option>
            <option value="CLE-TEAM">In-House Sales (direct)</option>
          </select>
        </label>
        <label>
          Policy start date
          <input name="riskCommencementDate" type="date" required defaultValue={dateDefaults.today} />
        </label>
        <label>
          Maturity date
          <input name="maturityDate" type="date" required defaultValue={dateDefaults.maturity} />
        </label>
        {error ? <p className="workflow-message workflow-error" role="alert">{error}</p> : null}
        {result ? <p className={`workflow-message workflow-${result.kind}`} role="status">{result.message}</p> : null}
        <div className="live-workflow-footer">
          <span>The case opens automatically if the policy matures within 12 months.</span>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Opening case…' : 'Create policy & open case'}
          </button>
        </div>
      </form>
  )
}

/**
 * The case worker's view of a validation exception: what conflicts, the
 * evidence already on the case, and one action to release it.
 */
function ExceptionReview({ selectedCase, busy, error, onResolve }) {
  const [note, setNote] = useState(DEFAULT_REVIEW_NOTE)
  const flagged = [...selectedCase.journeyEvents].reverse().find((event) => event.action === 'VALIDATION_CONFLICT')
  const evidence = [
    ['Policyholder', selectedCase.customer],
    ['Advised option', maturityOptionLabels[selectedCase.maturityOption] || selectedCase.maturityOption],
    ['Documents received', selectedCase.uploadedDocuments.map((document) => documentLabels[document] || document).join(', ') || 'None'],
    ['Advisor', ownerLabels[selectedCase.owner] || selectedCase.owner],
  ]

  return (
    <section className="exception-review" aria-label="Exception review">
      <header>
        <p className="eyebrow">EXCEPTION · REVIEW REQUIRED</p>
        <h2>Payment held: bank details need verification</h2>
        <p>{selectedCase.exceptionReason.charAt(0).toUpperCase() + selectedCase.exceptionReason.slice(1)}</p>
        {flagged ? <small>Flagged automatically {formatEventDate(flagged.at)}. Routine processing has continued on all other cases.</small> : null}
      </header>
      <dl className="exception-evidence">
        {evidence.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <label className="exception-note">
        Review note
        <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className="workflow-message workflow-error" role="alert">{error}</p> : null}
      <div className="exception-actions">
        <button className="button button-primary exception-approve-button" type="button" disabled={busy} onClick={() => onResolve(note)}>
          {busy ? 'Releasing…' : 'Approve and release'}
        </button>
      </div>
    </section>
  )
}

/**
 * Lanes are not a point on the timeline — every case sorts into one as soon as
 * there is an answer to validate. Shown side by side so that reads clearly.
 */
function LaneComparison({ cases, onOpen }) {
  const groups = ['GREEN', 'AMBER', 'RED'].map((lane) => ({
    lane,
    meta: laneMeta[lane],
    items: cases.filter((item) => item.processingLane === lane),
  }))
  const waiting = cases.filter((item) => !item.processingLane)

  return (
    <>
      <section className="panel">
        <PanelHeading
          title="Processing lanes"
          detail="Cases sorted by what they need next"
        />
        <div className="lane-columns">
          {groups.map(({ lane, meta, items }) => (
            <div className={`lane-column lane-column-${meta.tone}`} key={lane}>
              <header>
                <LanePill lane={lane} short />
                <strong>{items.length}</strong>
              </header>
              <p className="lane-column-detail">{meta.detail}</p>
              {items.length ? items.map((item) => (
                <button className="lane-case" type="button" key={item.id} onClick={() => onOpen(item)}>
                  <strong>{item.customer}</strong>
                  <small>{item.policy}</small>
                  <small>
                    {lane === 'RED'
                      ? 'Needs a person'
                      : lane === 'AMBER'
                        ? `Waiting on ${item.outstandingDocuments.map((d) => documentLabels[d] || d).join(', ')}`
                        : 'Processed automatically'}
                  </small>
                </button>
              )) : <p className="lane-column-empty">No cases.</p>}
            </div>
          ))}
        </div>
        {waiting.length ? (
          <p className="muted-copy">
            {waiting.length} case{waiting.length === 1 ? '' : 's'} not yet sorted, awaiting a customer response.
          </p>
        ) : null}
      </section>
    </>
  )
}

function BackendCasesTable({ cases, onOpen, highlightCaseId }) {
  return (
    <div className="case-table-wrap">
      <table className="case-table backend-case-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Policy</th>
            <th>Advisor</th>
            <th>SLA</th>
            <th>Lane</th>
            <th>Case status</th>
            <th><span className="visually-hidden">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr
              className={`case-row-${caseSignal(item.backendStatus)}${item.id === highlightCaseId ? ' case-row-focus' : ''}`}
              key={item.id}
            >
              <td>
                <strong>{item.customer}</strong>
                {item.id === highlightCaseId ? <span className="case-focus-flag">Following this one</span> : null}
                <small>{item.id}</small>
                <small>{caseNextAction(item.backendStatus)}</small>
              </td>
              <td>{item.policy}</td>
              <td>{ownerLabels[item.owner] || item.owner}</td>
              <td>{item.sla}</td>
              <td><LanePill lane={item.processingLane} short /></td>
              <td><StatusPill tone={caseSignal(item.backendStatus)}>{item.status}</StatusPill></td>
              <td>
                <button className="text-button table-action" type="button" onClick={() => onOpen(item)}>
                  {caseActionLabel(item.backendStatus)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SidebarLink({ active = false, badge, children, onClick }) {
  return (
    <button className={active ? 'sidebar-link selected' : 'sidebar-link'} type="button" onClick={onClick}>
      <span>{children}</span>
      {badge > 0 ? <span className="sidebar-badge">{badge}</span> : null}
    </button>
  )
}

function Metric({ label, value, tone = 'navy' }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className={`metric-${tone}`}>{value}</strong>
    </div>
  )
}

function PanelHeading({ title, detail, action }) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {detail ? <span>{detail}</span> : null}
      </div>
      {action ?? null}
    </div>
  )
}

function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <span className="empty-check" aria-hidden="true">✓</span>
      <div><strong>{title}</strong><p>{detail}</p></div>
    </div>
  )
}

const adviceChannels = ['Telephone', 'Video', 'Face to face', 'Digital advice room']

/**
 * Where the advisor does their job: the qualified lead, the customer's data,
 * the options side by side, and the one action that moves the case on.
 *
 * The binding selection is made here rather than by the customer, so the
 * rationale is captured at the same moment.
 */
/** Tomorrow at 10:00, as a value for a datetime-local input. */
function defaultConversationTime() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(10, 0, 0, 0)
  return `${localDateInput(date)}T10:00`
}

function AdviceWorkspace({
  selectedCase, busy, error, onAcceptLead, onScheduleConversation, onRecordAdvice, onPreviewCustomer,
}) {
  const policyState = usePolicyDetails(selectedCase.policy)
  const pot = mockPotValue(selectedCase.policy)
  // Pre-filled so the presenter only has to confirm each step.
  const [recommended, setRecommended] = useState(selectedCase.maturityOption || 'ANNUITY')
  const [rationale, setRationale] = useState(DEFAULT_RATIONALE)
  const [channel, setChannel] = useState(adviceChannels[0])
  const [conversationAt, setConversationAt] = useState(defaultConversationTime)
  // Captured once so the countdown stays stable across re-renders.
  const [openedAt] = useState(() => Date.now())

  const advice = selectedCase.adviceRecord
  const leadAccepted = Boolean(selectedCase.leadAcceptedAt)
  const appointmentBooked = Boolean(selectedCase.appointmentAt)
  const adviceDone = Boolean(advice)
  const status = selectedCase.backendStatus
  // The broker cannot act until the customer asks for advice.
  const waitingForCustomer = ['NEW', 'MATURITY_DETECTED', 'CLE_OWNER_DETECTED', 'NON_CLE_OWNER_DETECTED'].includes(status)
  const canAct = ['ADVICE_REQUESTED', 'APPOINTMENT_BOOKED'].includes(status) && !adviceDone
  const currentStep = adviceDone ? 4 : !leadAccepted ? 1 : !appointmentBooked ? 2 : 3
  const requestedEvent = [...selectedCase.journeyEvents].reverse().find((event) => event.action === 'ADVICE_REQUESTED')
  const monthsToMaturity = policyState.data?.maturityDate
    ? Math.max(0, Math.round(
      (new Date(`${policyState.data.maturityDate}T12:00:00`).getTime() - openedAt) / (86400000 * 30.44),
    ))
    : null

  const advisor = selectedCase.ownerType === 'NON_CLE' ? 'Broker' : 'In-House Sales'
  const client = firstName(selectedCase.customer)

  const steps = [
    {
      title: 'Accept the lead',
      done: leadAccepted ? `Accepted ${formatEventDate(selectedCase.leadAcceptedAt)}` : '',
      body: (
        <>
          <p>Take ownership of {client}’s advice request. The client is notified that her broker will be in touch.</p>
          <button className="button button-primary" type="button" disabled={busy} onClick={() => onAcceptLead(advisor)}>
            {busy ? 'Accepting…' : 'Accept lead'}
          </button>
        </>
      ),
    },
    {
      title: 'Schedule the advice conversation',
      done: appointmentBooked ? `Scheduled for ${formatEventDate(selectedCase.appointmentAt)}` : '',
      body: (
        <>
          <div className="process-step-fields">
            <label>
              Channel
              <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                {adviceChannels.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Date and time
              <input type="datetime-local" value={conversationAt} onChange={(event) => setConversationAt(event.target.value)} />
            </label>
          </div>
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !conversationAt}
            onClick={() => onScheduleConversation({
              appointmentAt: new Date(conversationAt).toISOString(),
              advisor,
              channel,
            })}
          >
            {busy ? 'Scheduling…' : 'Schedule conversation'}
          </button>
        </>
      ),
    },
    {
      title: 'Record the advised option',
      done: adviceDone ? `${maturityOptionLabels[advice.recommendedOption] || advice.recommendedOption} · ${advice.channel}` : '',
      body: (
        <>
          <p>Select the advised option above and confirm the rationale. This sets the binding selection and issues the formal pack.</p>
          <label className="advice-rationale-field">
            Rationale
            <textarea rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} />
          </label>
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !recommended}
            onClick={() => onRecordAdvice({ recommendedOption: recommended, rationale, advisor, channel })}
          >
            {busy ? 'Recording…' : `Record advice: ${maturityOptionLabels[recommended]}`}
          </button>
        </>
      ),
    },
  ]

  return (
    <section className="advice-workspace" aria-label="Advice workspace">
      <header className="advice-workspace-head">
        <div>
          <p className="eyebrow">ADVICE LEAD · {advisor === 'Broker' ? 'BROKER-MANAGED' : 'IN-HOUSE SALES'}</p>
          <h2>{selectedCase.customer}</h2>
          <p className="muted-copy">
            Matures in {monthsToMaturity == null ? '—' : `${monthsToMaturity} months`}
            {' · '}{selectedCase.policy}
          </p>
        </div>
        <AdviceProgress
          leadAccepted={leadAccepted}
          appointmentBooked={appointmentBooked}
          adviceDone={adviceDone}
        />
      </header>

      {error ? <p className="workflow-message workflow-error" role="alert">{error}</p> : null}

      <section className="panel client-snapshot">
        <PanelHeading title="Client overview" detail="Consolidated from the policy and journey record" />
        <div className="snapshot-row">
          <div className="snapshot-pot">
            <span>{client}’s pot</span>
            <strong>{formatEuro(pot)}</strong>
            <small>Illustrative value</small>
          </div>
          <div className="lead-fields">
            <div>
              <span>Client preference</span>
              <strong>
                {selectedCase.customerPreference
                  ? maturityOptionLabels[selectedCase.customerPreference]
                  : 'None stated'}
              </strong>
            </div>
            <div><span>Maturity date</span><strong>{policyState.data?.maturityDate ? formatEventDate(policyState.data.maturityDate) : '—'}</strong></div>
            <div><span>Advice requested</span><strong>{requestedEvent ? formatEventDate(requestedEvent.at) : '—'}</strong></div>
          </div>
        </div>
        <div className="lead-actions">
          {waitingForCustomer ? (
            <span className="lead-waiting">Awaiting the client’s advice request.</span>
          ) : null}
          <button className="text-button" type="button" onClick={() => onPreviewCustomer(selectedCase.id)}>
            View the client’s portal
          </button>
        </div>
      </section>

      <section className="panel option-comparison">
        <PanelHeading title="Options side by side" detail={`The figures ${client} sees in her portal`} />
        <div className="comparison-grid">
          {['ANNUITY', 'LUMP_SUM', 'REINVEST'].map((option) => {
            const info = optionInformation[option]
            const headline = option === 'ANNUITY'
              ? `${formatEuro(pot * 0.04 / 12)} – ${formatEuro(pot * 0.06 / 12)} / month`
              : option === 'LUMP_SUM'
                ? formatEuro(pot)
                : `${formatEuro(projectedValue(pot, 0.04, 10))} after 10 years`
            const isPreference = selectedCase.customerPreference === option
            const isRecommended = (adviceDone ? advice.recommendedOption : recommended) === option
            return (
              <button
                key={option}
                type="button"
                className={`comparison-card${isRecommended ? ' comparison-selected' : ''}`}
                aria-pressed={isRecommended}
                disabled={!canAct || currentStep !== 3 || busy}
                onClick={() => setRecommended(option)}
              >
                <span className="comparison-head">
                  <strong>{maturityOptionLabels[option]}</strong>
                  {isPreference ? <em className="comparison-flag">Client preference</em> : null}
                </span>
                <span className="comparison-headline">{headline}</span>
                <span className="comparison-detail">{info.heading}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel advice-process">
        <PanelHeading
          title="Advice process"
          detail={adviceDone ? 'Complete. The rationale is saved against the case.' : 'Three steps, recorded against the case'}
        />
        <ol className="process-steps">
          {steps.map((step, index) => {
            const number = index + 1
            const state = number < currentStep ? 'done' : number === currentStep ? 'current' : 'upcoming'
            return (
              <li className={`process-step ${state}`} key={step.title}>
                <span className="process-step-marker" aria-hidden="true">{state === 'done' ? '✓' : number}</span>
                <div className="process-step-content">
                  <strong>{step.title}</strong>
                  {state === 'done' && step.done ? <small>{step.done}</small> : null}
                  {state === 'current' && canAct ? <div className="process-step-body">{step.body}</div> : null}
                </div>
              </li>
            )
          })}
        </ol>
        {adviceDone ? <p className="advice-process-rationale">{advice.rationale}</p> : null}
      </section>
    </section>
  )
}

/** Lead → appointment → advice, the three things measured for distribution. */
function AdviceProgress({ leadAccepted, appointmentBooked, adviceDone }) {
  const steps = [
    ['Lead accepted', leadAccepted],
    ['Appointment', appointmentBooked],
    ['Advice given', adviceDone],
  ]
  return (
    <ol className="advice-progress" aria-label="Advice progress">
      {steps.map(([label, done]) => (
        <li key={label} className={done ? 'advice-step done' : 'advice-step'}>
          <span aria-hidden="true">{done ? '✓' : '○'}</span>{label}
        </li>
      ))}
    </ol>
  )
}

function BrokerCasesView({
  cases,
  selectedCase,
  loading,
  error,
  onRetry,
  onSelectCase,
  onNotify,
  page,
  onSelectPage,
  actionBusy,
  actionError,
  onRequestInformation,
  onAcceptLead,
  onScheduleConversation,
  onRecordAdvice,
  onPreviewCustomer,
}) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [callNote, setCallNote] = useState('')
  const [callNotes, setCallNotes] = useState([])
  const redCases = cases.filter((item) => caseSignal(item.backendStatus) === 'red')
  const amberCases = cases.filter((item) => caseSignal(item.backendStatus) === 'amber')
  const greenCases = cases.filter((item) => caseSignal(item.backendStatus) === 'green')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleCases = cases.filter((item) => {
    const matchesFilter = filter === 'all' || caseSignal(item.backendStatus) === filter
    const matchesQuery = !normalizedQuery
      || [item.customer, item.policy, item.id, item.owner].some(
        (value) => value.toLocaleLowerCase().includes(normalizedQuery),
      )
    return matchesFilter && matchesQuery
  }).sort((first, second) => {
    const priority = { red: 0, amber: 1, neutral: 2, green: 3 }
    return priority[caseSignal(first.backendStatus)] - priority[caseSignal(second.backendStatus)]
  })

  return (
    <div className="broker-layout">
      <header className="topbar">
        <Brand subline="Retirement Hub for brokers" />
        <nav className="top-nav" aria-label="Broker navigation">
          <button className={page !== 'case' ? 'top-nav-link active' : 'top-nav-link'} onClick={() => onSelectPage('list')}>Cases</button>
          <button className="top-nav-link" onClick={() => onNotify('You are up to date.')}>Notifications</button>
          <span className="user-name">Broker consultant</span>
        </nav>
      </header>
      <main className="broker-main">
        {page === 'case' && selectedCase ? (
          <>
            <button className="text-button back-link" type="button" onClick={() => onSelectPage('list')}>← Back to cases</button>
            <AdviceWorkspace
              selectedCase={selectedCase}
              busy={actionBusy}
              error={actionError}
              onAcceptLead={onAcceptLead}
              onScheduleConversation={onScheduleConversation}
              onRecordAdvice={onRecordAdvice}
              onPreviewCustomer={onPreviewCustomer}
              onNotify={onNotify}
            />
            <details className="panel broker-case-record">
              <summary>Full case record and audit trail</summary>
              <BackendCaseDetail
                selectedCase={selectedCase}
                actionBusy={actionBusy}
                actionError={actionError}
                onRequestInformation={onRequestInformation}
                onPreviewCustomer={onPreviewCustomer}
              />
            </details>
            <BrokerContactLog
              caseId={selectedCase.id}
              value={callNote}
              entries={callNotes.filter((entry) => entry.caseId === selectedCase.id)}
              onChange={setCallNote}
              onAdd={(message) => {
                setCallNotes((entries) => [
                  { caseId: selectedCase.id, message, createdAt: new Date().toLocaleString('en-IE') },
                  ...entries,
                ])
                setCallNote('')
              }}
              onRequestInformation={onRequestInformation}
              onPreviewCustomer={onPreviewCustomer}
            />
          </>
        ) : (
          <>
            <header className="page-heading broker-heading">
              <div>
                <p className="eyebrow">BROKER CONSULTANT</p>
                <h1>Your clients approaching maturity</h1>
                <p className="muted-copy">Qualified advice leads for your clients, ordered by urgency.</p>
              </div>
              <button className="button button-secondary" type="button" onClick={onRetry}>Refresh</button>
            </header>
            <div className="broker-summary-grid">
              <button className={`broker-summary broker-summary-red ${filter === 'red' ? 'broker-summary-selected' : ''}`} type="button" onClick={() => setFilter(filter === 'red' ? 'all' : 'red')}>
                <span>Needs attention</span><strong>{redCases.length}</strong><small>Exceptions to review</small>
              </button>
              <button className={`broker-summary broker-summary-amber ${filter === 'amber' ? 'broker-summary-selected' : ''}`} type="button" onClick={() => setFilter(filter === 'amber' ? 'all' : 'amber')}>
                <span>In progress</span><strong>{amberCases.length}</strong><small>Waiting on a next step</small>
              </button>
              <button className={`broker-summary broker-summary-green ${filter === 'green' ? 'broker-summary-selected' : ''}`} type="button" onClick={() => setFilter(filter === 'green' ? 'all' : 'green')}>
                <span>Completed</span><strong>{greenCases.length}</strong><small>Journey completed</small>
              </button>
            </div>
            <section className="panel client-list-panel">
              <div className="client-list-heading">
                <div>
                  <h2>Client cases</h2>
                  <span>{visibleCases.length} of {cases.length} clients</span>
                </div>
                <label className="broker-search">
                  <span className="visually-hidden">Search cases</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, policy or case" />
                </label>
              </div>
              <div className="broker-filter-row" aria-label="Filter client cases">
                {[
                  ['all', 'All cases'],
                  ['red', 'Needs attention'],
                  ['amber', 'In progress'],
                  ['green', 'Completed'],
                ].map(([value, label]) => (
                  <button
                    className={`broker-filter ${filter === value ? 'broker-filter-active' : ''}`}
                    type="button"
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >{label}</button>
                ))}
              </div>
              {loading ? (
                <div className="connection-state" role="status"><div className="loading-indicator" aria-hidden="true" /><strong>Loading cases…</strong></div>
              ) : error ? (
                <div className="connection-state connection-error" role="alert">
                  <p>{error}</p><button className="button button-primary" type="button" onClick={onRetry}>Retry</button>
                </div>
              ) : visibleCases.length ? visibleCases.map((item) => (
                <article className={`client-row client-row-${caseSignal(item.backendStatus)}`} key={item.id}>
                  <div className="client-main">
                    <div className="client-name-line">
                      <strong>{item.customer}</strong>
                      <span className="subtle">Policy {item.policy}</span>
                    </div>
                    <p>{caseNextAction(item.backendStatus)}</p>
                  </div>
                  <div className="broker-row-status">
                    <StatusPill tone={caseSignal(item.backendStatus)}>{item.status}</StatusPill>
                    <small>Case {item.id}</small>
                  </div>
                  <button
                    className={`button button-primary${item.backendStatus === 'ADVICE_REQUESTED' ? ' pick-up-lead' : ''}`}
                    type="button"
                    onClick={() => {
                      onSelectCase(item.id)
                      onSelectPage('case')
                    }}
                  >{caseActionLabel(item.backendStatus)}</button>
                </article>
              )) : (
                <EmptyState title="No matching cases" detail="Try another status filter or search term." />
              )}
              <p className="prototype-note">
                Showing broker-managed clients only. Direct clients go to In-House Sales.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function BackendCaseDetail({
  selectedCase,
  actionBusy,
  actionError,
  onRequestInformation,
  onIssueFormalPack,
  onResolveException,
  onPreviewCustomer,
  onViewTimeline,
}) {
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)
  const policyState = usePolicyDetails(selectedCase.policy)
  const fields = [
    ['Case ID', selectedCase.id],
    ['Status', selectedCase.status],
    ['Policy', selectedCase.policy],
    ['Advisor', ownerLabels[selectedCase.owner] || selectedCase.owner],
    ['Relationship', ownerTypeLabels[selectedCase.ownerType] || 'Not identified'],
    ['Routed to', selectedCase.email],
    ['Agreed option', selectedCase.maturityOption
      ? maturityOptionLabels[selectedCase.maturityOption] || selectedCase.maturityOption
      : 'Not agreed yet'],
    ['Documents received', selectedCase.uploadedDocuments.length
      ? selectedCase.uploadedDocuments.map((document) => documentLabels[document] || document).join(', ')
      : 'None yet'],
    ['SLA', selectedCase.sla],
    ['Opened', formatEventDate(selectedCase.createdAt) || selectedCase.createdAt],
    ['Last updated', formatEventDate(selectedCase.updatedAt) || selectedCase.updatedAt],
  ]

  return (
    <div className="case-detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">CASE RECORD</p>
          <h1>{selectedCase.customer}</h1>
          <p className="muted-copy">{selectedCase.policy} · Case ID {selectedCase.id}</p>
        </div>
        <StatusPill tone={caseSignal(selectedCase.backendStatus)}>{selectedCase.status}</StatusPill>
      </header>
      {onResolveException && selectedCase.backendStatus === 'ON_HOLD'
        && selectedCase.exceptionReason && selectedCase.maturityOption ? (
          <ExceptionReview
            selectedCase={selectedCase}
            busy={actionBusy}
            error={actionError}
            onResolve={onResolveException}
          />
        ) : <CaseStatusSummary status={selectedCase.backendStatus} />}
      {selectedCase.processingLane && !(selectedCase.backendStatus === 'ON_HOLD' && selectedCase.maturityOption) ? (
        <ProcessingLaneBanner
          lane={selectedCase.processingLane}
          exceptionReason={selectedCase.exceptionReason}
          outstanding={selectedCase.outstandingDocuments}
          resolvedByReview={selectedCase.journeyEvents.some((event) => event.action === 'EXCEPTION_RESOLVED')}
        />
      ) : null}
      <CaseProgressTrail status={selectedCase.backendStatus} documentStage={Boolean(selectedCase.maturityOption)} />
      <section className="panel next-step-panel">
        <PanelHeading title="Actions" />
        <div className="next-step-body">
          {selectedCase.backendStatus === 'CANCELLED' ? (
            <p className="backend-exception-note">This case is cancelled.</p>
          ) : null}
          {selectedCase.backendStatus === 'AWAITING_CUSTOMER' ? (
            <p className="next-step-note">This case is waiting on the customer.</p>
          ) : null}
          <div className="case-communication-actions">
            {selectedCase.backendStatus === 'IN_PROGRESS' && selectedCase.adviceRecord ? (
              <button
                className="button button-primary"
                type="button"
                disabled={actionBusy}
                onClick={onIssueFormalPack}
              >
                {actionBusy ? 'Issuing…' : 'Issue the formal pack'}
              </button>
            ) : null}
            {caseSignal(selectedCase.backendStatus) !== 'red'
              && !['AWAITING_CUSTOMER', 'COMPLETED', 'CANCELLED'].includes(selectedCase.backendStatus) ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={actionBusy}
                  title="Marks the case as waiting on the customer."
                  onClick={() => onRequestInformation(selectedCase)}
                >
                  {actionBusy ? 'Updating case…' : 'Request information'}
                </button>
              ) : null}
            <button
              className="button button-secondary"
              type="button"
              disabled={!policyState.data || policyState.status !== 'success'}
              onClick={() => setEmailPreviewOpen(true)}
            >
              Preview annual statement
            </button>
            {onViewTimeline ? (
              <button className="button button-secondary" type="button" onClick={onViewTimeline}>
                Case timeline
              </button>
            ) : null}
            <button className="text-button" type="button" onClick={() => onPreviewCustomer(selectedCase.id)}>
              See the customer’s screen
            </button>
          </div>
          {actionError ? <p className="workflow-message workflow-error" role="alert">{actionError}</p> : null}
        </div>
      </section>
      <details className="panel case-overview-panel">
        <summary>
          <span>Case overview</span>
          <small>Policy and case details</small>
        </summary>
        <div className="case-agent-summary">
          <strong>Case summary</strong>
          <p>{selectedCase.detail}</p>
        </div>
        <div className="backend-case-fields">
          {fields.map(([label, value]) => (
            <div key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
          {policyState.status === 'success' && policyState.data ? (
            <>
              <div><span>Customer reference</span><strong>{policyState.data.partnerId || 'Not provided'}</strong></div>
              <div><span>Policy start</span><strong>{policyState.data.riskCommencementDate || 'Not provided'}</strong></div>
              <div><span>Maturity date</span><strong>{policyState.data.maturityDate || 'Not provided'}</strong></div>
            </>
          ) : null}
        </div>
        {policyState.status === 'loading' ? <p className="inline-state">Loading linked policy details…</p> : null}
        {policyState.status === 'error' ? <p className="backend-exception-note" role="alert">Could not load linked policy details: {policyState.error}</p> : null}
      </details>
      <CaseAuditTrail events={selectedCase.journeyEvents} />
      {emailPreviewOpen ? (
        <AnnualStatementPreview
          selectedCase={selectedCase}
          policy={policyState.data}
          onClose={() => setEmailPreviewOpen(false)}
          onOpenPortal={() => onPreviewCustomer(selectedCase.id)}
        />
      ) : null}
    </div>
  )
}

function BrokerContactLog({ caseId, value, entries, onChange, onAdd }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    const note = value.trim()
    if (note) onAdd(note)
  }

  return (
    <section className="panel broker-contact-log">
      <PanelHeading
        title="Customer contact log"
        detail="Calls and follow-ups with this client"
      />
      <form className="contact-note-form" onSubmit={handleSubmit}>
        <label htmlFor={`contact-note-${caseId}`}>Add a call or follow-up note</label>
        <textarea
          id={`contact-note-${caseId}`}
          value={value}
          maxLength={400}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. Called to confirm the appointment time"
          required
        />
        <button className="button button-secondary" type="submit" disabled={!value.trim()}>Add note</button>
      </form>
      {entries.length ? (
        <ol className="contact-note-list">
          {entries.map((entry, index) => (
            <li key={`${entry.createdAt}-${index}`}>
              <strong>{entry.createdAt}</strong>
              <p>{entry.message}</p>
            </li>
          ))}
        </ol>
      ) : <p className="empty-note">No notes yet.</p>}
    </section>
  )
}

/**
 * Shows which straight-through-processing lane the case landed in, and why.
 */
function ProcessingLaneBanner({ lane, exceptionReason, outstanding = [], resolvedByReview = false }) {
  const meta = laneMeta[lane]
  const detail = lane === 'GREEN' && resolvedByReview
    ? 'Complete. Released after one review by CLE Operations.'
    : meta ? meta.detail : 'The lane is decided once the customer responds. Nothing to validate yet.'

  return (
    <section className={`lane-banner lane-banner-${meta ? meta.tone : 'neutral'}`} aria-label="Processing lane">
      <LanePill lane={lane} />
      <div className="lane-banner-copy">
        <strong>{detail}</strong>
        {exceptionReason ? <p>{exceptionReason}</p> : null}
        {!exceptionReason && lane === 'AMBER' && outstanding.length ? (
          <p>
            Outstanding: {outstanding.map((document) => documentLabels[document] || document).join(', ')}.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Stages follow the broker-led journey: advice happens before the formal pack,
 * so the paperwork confirms a decision rather than asking for one.
 */
function CaseProgressTrail({ status, documentStage = false }) {
  const currentStep = {
    NEW: 0,
    MATURITY_DETECTED: 1,
    // Ownership exceptions stop at advisor routing; document conflicts at documents.
    ON_HOLD: documentStage ? 4 : 1,
    CANCELLED: 1,
    CLE_OWNER_DETECTED: 2,
    NON_CLE_OWNER_DETECTED: 2,
    ADVICE_REQUESTED: 2,
    APPOINTMENT_BOOKED: 2,
    IN_PROGRESS: 3,
    MATURITY_PACKAGE_SENT: 4,
    AWAITING_INFORMATION: 4,
    AWAITING_CUSTOMER: 4,
    // Past the final index so every stage renders as done for a completed case.
    COMPLETED: 5,
  }[status] ?? 0
  const stages = ['Case opened', 'Advisor identified', 'Advice', 'Formal pack', 'Documents']
  // What the current stage is waiting on, so it reads as in progress.
  const currentDetail = {
    NEW: 'Checking',
    MATURITY_DETECTED: 'Checking',
    ON_HOLD: 'Needs a person',
    CANCELLED: 'Cancelled',
    CLE_OWNER_DETECTED: 'Waiting for the customer',
    NON_CLE_OWNER_DETECTED: 'Waiting for the customer',
    ADVICE_REQUESTED: 'Advice requested',
    APPOINTMENT_BOOKED: 'Appointment booked',
    IN_PROGRESS: 'Issuing now',
    MATURITY_PACKAGE_SENT: 'Waiting for documents',
    AWAITING_INFORMATION: 'One document missing',
    AWAITING_CUSTOMER: 'Waiting for the customer',
  }[status] || 'In progress'

  return (
    <section className="case-progress-panel" aria-label="Case journey stage">
      <p className="eyebrow">CASE JOURNEY</p>
      <ol>
        {stages.map((stage, index) => (
          <li className={index < currentStep ? 'stage-done' : index === currentStep ? 'stage-current' : ''} key={stage}>
            <span aria-hidden="true">{index < currentStep ? '✓' : index + 1}</span>
            <strong>{stage}</strong>
            {index === currentStep ? <em className="stage-current-tag">In progress · {currentDetail}</em> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

function PensionPotVisual() {
  return (
    <svg className="pension-pot-illustration" viewBox="0 0 260 190" aria-hidden="true">
      <ellipse cx="130" cy="167" rx="92" ry="12" fill="#dce9e3" />
      <path d="M54 82h152l-13 72a17 17 0 0 1-17 14H84a17 17 0 0 1-17-14L54 82Z" fill="#e9f3ee" stroke="#326f61" strokeWidth="4" />
      <path d="M62 101h136l-7 42a13 13 0 0 1-13 11H82a13 13 0 0 1-13-11l-7-42Z" fill="#c9e3d7" />
      <rect x="46" y="79" width="168" height="16" rx="7" fill="#326f61" />
      <circle cx="95" cy="67" r="22" fill="#f5d27f" stroke="#d4a63e" strokeWidth="4" />
      <circle cx="95" cy="67" r="12" fill="none" stroke="#d4a63e" strokeWidth="2" />
      <circle cx="138" cy="53" r="25" fill="#f8df9e" stroke="#d4a63e" strokeWidth="4" />
      <circle cx="138" cy="53" r="14" fill="none" stroke="#d4a63e" strokeWidth="2" />
      <circle cx="178" cy="69" r="20" fill="#f5d27f" stroke="#d4a63e" strokeWidth="4" />
      <circle cx="178" cy="69" r="11" fill="none" stroke="#d4a63e" strokeWidth="2" />
      <path d="M110 122h40" stroke="#77a896" strokeWidth="5" strokeLinecap="round" />
      <path d="M117 136h26" stroke="#77a896" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

function PensionPotCard({ policy, potValue, caseStatus, selectedOption, outstandingCount }) {
  return (
    <section className="pension-overview panel" aria-labelledby="pension-overview-title">
      <div className="pension-overview-copy">
        <p className="eyebrow">YOUR RETIREMENT SAVINGS</p>
        <h2 id="pension-overview-title">Your pension pot</h2>
        <div className="valuation-status"><span className="signal-dot" />Illustrative value</div>
        <strong className="pension-pot-value">{formatEuro(potValue)}</strong>
        <p className="muted-copy">
          Illustrative value. Your final amount is confirmed at maturity.
        </p>
        <div className="pension-overview-details">
          <div><span>Policy</span><strong>{policy}</strong></div>
          <div><span>Status</span><strong>{customerStatus(caseStatus)}</strong></div>
          <div><span>Your next step</span><strong>{selectedOption ? `${outstandingCount} ${outstandingCount === 1 ? 'document' : 'documents'} outstanding` : 'Talk to your advisor'}</strong></div>
        </div>
      </div>
      <div className="pension-illustration-wrap">
        <PensionPotVisual />
      </div>
    </section>
  )
}

function JourneyProgress({ selectedOption, outstandingCount, status }) {
  const activeStep = status === 'COMPLETED'
    ? 2
    : !selectedOption
      ? 0
      : outstandingCount > 0
        ? 1
        : 2
  const steps = ['Talk to your advisor', 'Share information', 'We complete your case']
  return (
    <ol className="journey-progress customer-journey-progress" aria-label="Your retirement journey progress">
      {steps.map((step, index) => {
        const completed = status === 'COMPLETED' || index < activeStep
        const current = index === activeStep && status !== 'COMPLETED'
        return (
          <li className={`journey-step ${completed ? 'step-complete' : ''} ${current ? 'step-current' : ''}`} key={step}>
            <span aria-hidden="true">{completed ? '✓' : index + 1}</span>
            <div><strong>{step}</strong><small>{current ? 'Your current step' : completed ? 'Complete' : ''}</small></div>
          </li>
        )
      })}
    </ol>
  )
}

/** Fixed, round-number pots for the seeded scenarios; other policies fall back to a stable hash. */
const mockPotValues = {
  'POL-2027-10021': 248000,
  'POL-2027-10044': 186500,
  'POL-2027-10078': 212000,
}

const optionInformation = {
  ANNUITY: {
    heading: 'A regular income from some or all of your pot',
    detail: 'An annuity can pay you a regular income for life. How much you get depends on rates at the time you buy it.',
    illustration: 'income',
  },
  LUMP_SUM: {
    heading: 'Your pension pot paid out as cash',
    detail: 'A lump sum gives you the whole pot in one go. You decide how to use and manage it.',
    illustration: 'cash',
  },
  REINVEST: {
    heading: 'Your pot stays invested',
    detail: 'Your investments remain exposed to markets, so their value may rise or fall over time.',
    illustration: 'growth',
  },
}

function formatEuro(amount) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function mockPotValue(policyId) {
  if (mockPotValues[policyId]) return mockPotValues[policyId]
  const hash = Array.from(policyId || 'demo').reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    7,
  )
  return 95000 + (hash % 140001)
}

function projectedValue(pot, annualRate, years) {
  return Math.round(pot * ((1 + annualRate) ** years))
}

function OptionIllustration({ kind }) {
  if (kind === 'income') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <path d="M17 62h86" stroke="#c9d9d2" strokeWidth="5" strokeLinecap="round" />
        <path d="M27 49c10-23 20 23 31 0s20 23 31 0" fill="none" stroke="#32715f" strokeWidth="5" strokeLinecap="round" />
        <circle cx="90" cy="26" r="14" fill="#f8df9e" stroke="#d4a63e" strokeWidth="3" />
        <path d="M90 18v16m-4-12h6a3 3 0 0 1 0 6h-5a3 3 0 0 0 0 6h7" fill="none" stroke="#8c6a19" strokeWidth="2" />
      </svg>
    )
  }
  if (kind === 'cash') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <rect x="17" y="19" width="86" height="47" rx="7" fill="#eaf4ed" stroke="#32715f" strokeWidth="3" />
        <path d="M25 28h70M25 57h70" stroke="#a7caba" strokeWidth="3" />
        <circle cx="60" cy="42" r="13" fill="#f8df9e" stroke="#d4a63e" strokeWidth="3" />
        <path d="M60 34v16m-4-12h6a3 3 0 0 1 0 6h-5a3 3 0 0 0 0 6h7" fill="none" stroke="#8c6a19" strokeWidth="2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true">
      <path d="M17 64h89" stroke="#c9d9d2" strokeWidth="4" strokeLinecap="round" />
      <path d="M25 57 47 43l15 7 28-30" fill="none" stroke="#32715f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 20h14v14" fill="none" stroke="#32715f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="43" r="5" fill="#f8df9e" stroke="#d4a63e" strokeWidth="2" />
      <circle cx="62" cy="50" r="5" fill="#f8df9e" stroke="#d4a63e" strokeWidth="2" />
    </svg>
  )
}

/** Sample figures for one option. The customer reads; the advisor decides. */
function OptionReview({ option, options, pot, preference, status, busy, onBack, onSelectOption, onRequestAdvice }) {
  const information = optionInformation[option]
  const isPreferred = preference === option
  // Once advice is requested the request stands for every option, not just the one she was viewing.
  const adviceRequested = status === 'ADVICE_REQUESTED' || status === 'APPOINTMENT_BOOKED'
  const range = option === 'ANNUITY'
    ? [['Lower example', pot * 0.04 / 12], ['Higher example', pot * 0.06 / 12]]
    : option === 'LUMP_SUM'
      ? [['Illustrative one-off amount', pot]]
      : [
          ['2% per year · 10 years', projectedValue(pot, 0.02, 10)],
          ['4% per year · 10 years', projectedValue(pot, 0.04, 10)],
          ['6% per year · 10 years', projectedValue(pot, 0.06, 10)],
        ]

  return (
    <div className="option-review" aria-labelledby="option-review-heading">
      <div className="option-review-nav">
        <button className="text-button option-back" type="button" onClick={onBack}>← All options</button>
        <div className="option-tabs" role="tablist" aria-label="Maturity options">
          {options.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === option}
              className={item === option ? 'option-tab active' : 'option-tab'}
              onClick={() => onSelectOption(item)}
            >
              {maturityOptionLabels[item] || item}
            </button>
          ))}
        </div>
      </div>
      <div className="option-review-heading">
        <div className={`option-art option-art-${information.illustration}`}><OptionIllustration kind={information.illustration} /></div>
        <div>
          <p className="eyebrow">ILLUSTRATIVE FIGURES</p>
          <h4 id="option-review-heading">{maturityOptionLabels[option]}</h4>
          <strong>{information.heading}</strong>
        </div>
      </div>
      <p className="option-explanation">{information.detail}</p>
      <div className="option-projection">
        <div className="projection-pot"><span>Your pot</span><strong>{formatEuro(pot)}</strong></div>
        {range.map(([label, value]) => (
          <div className="projection-row" key={label}>
            <span>{label}</span>
            <strong>{formatEuro(value)}{option === 'ANNUITY' ? ' / month' : ''}</strong>
            {option === 'REINVEST' ? (
              <div className="projection-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (value / projectedValue(pot, 0.06, 10)) * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
        <small>
          {option === 'ANNUITY'
            ? 'Example range based on 4–6% of your pot a year, paid monthly. Not a quote.'
            : option === 'LUMP_SUM'
              ? 'Before any tax.'
              : 'Example growth rates only, before fees, tax and inflation. Not guaranteed.'}
        </small>
      </div>
      <p className="backend-disclaimer">
        This is information, not advice or a recommendation. Only your advisor can advise you on which
        option suits you.
      </p>
      <div className="option-review-actions">
        {adviceRequested ? (
          <span className="option-requested-badge">✓ Advice requested</span>
        ) : (
          <button
            className="button button-primary"
            type="button"
            disabled={busy || isPreferred}
            onClick={() => onRequestAdvice(option)}
          >
            {busy ? 'Sending…' : 'Discuss this with my advisor'}
          </button>
        )}
      </div>
      {adviceRequested ? (
        <p className="option-request-note" role="status">
          {preference
            ? `Your advisor has your request. You said you are leaning towards ${maturityOptionLabels[preference]}${isPreferred ? ' (this option)' : ''}.`
            : 'Your advisor has your request and will be in touch.'}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Customer-side entry into the advice process. Asking for advice shares an
 * optional non-binding steer; it never selects anything.
 */
function AdviceRequestPanel({ status, preference, appointmentAt, busy, onRequestAdvice }) {
  const requested = status === 'ADVICE_REQUESTED' || status === 'APPOINTMENT_BOOKED'

  if (status === 'APPOINTMENT_BOOKED') {
    return (
      <section className="advice-cta advice-cta-booked" role="status">
        <span className="confirmation-check" aria-hidden="true">✓</span>
        <div>
          <strong>Your advice appointment is booked</strong>
          <p>
            {appointmentAt ? `Scheduled for ${formatEventDate(appointmentAt)}. ` : ''}
            Your advisor will confirm your option with you and record it on your case.
          </p>
        </div>
      </section>
    )
  }

  if (requested) {
    return (
      <section className="advice-cta advice-cta-requested" role="status">
        <span className="confirmation-check" aria-hidden="true">✓</span>
        <div>
          <strong>Your advisor has your request</strong>
          <p>
            {preference
              ? `You told them you are leaning towards ${maturityOptionLabels[preference]}. `
              : ''}
            They will be in touch to talk the options through before anything is decided.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="advice-cta">
      <div>
        <strong>Not sure which is right for you?</strong>
        <p>
          Ask your advisor to talk these through. You can share which one you are leaning towards —
          it is not a decision, just a starting point for the conversation.
        </p>
      </div>
      <button
        className="button button-primary"
        type="button"
        disabled={busy}
        onClick={() => onRequestAdvice(null)}
      >
        {busy ? 'Sending…' : 'Ask my advisor for advice'}
      </button>
    </section>
  )
}

/** What the customer sees once their advisor has recorded the option with them. */
function AdvisedOptionSummary({ option, advice, preference }) {
  return (
    <div className="advised-option">
      <div className="selected-option-summary">
        <span className="confirmation-check" aria-hidden="true">✓</span>
        <div>
          <strong>{maturityOptionLabels[option] || option}</strong>
          <small>
            {advice?.advisedBy
              ? `Agreed with ${advice.advisedBy === 'Broker' ? 'your broker' : advice.advisedBy}${advice.channel && advice.channel !== 'Not recorded' ? ` by ${advice.channel.toLowerCase()}` : ''}.`
              : 'Agreed with your advisor.'}
          </small>
        </div>
      </div>
      {advice?.rationale ? (
        <details className="advice-rationale">
          <summary>Why this option</summary>
          <p>{advice.rationale}</p>
          {preference && preference !== option ? (
            <small>
              You were leaning towards {maturityOptionLabels[preference]} before your advice conversation.
            </small>
          ) : null}
        </details>
      ) : null}
    </div>
  )
}

/**
 * Works out when the annual statement actually falls for a policy.
 *
 * The statement is driven by the policy anniversary, not by the maturity date,
 * so it lands at a different distance from maturity for every contract. That
 * variability is the whole reason the communication decision has to be made at
 * runtime rather than on a fixed schedule.
 */
function annualStatementTiming(policy) {
  const maturityDate = new Date(`${policy.maturityDate}T12:00:00`)
  if (!policy.riskCommencementDate) {
    const fallback = new Date(maturityDate)
    fallback.setFullYear(fallback.getFullYear() - 1)
    return { maturityDate, statementDate: fallback, monthsBeforeMaturity: 12 }
  }

  // Most recent policy anniversary on or before the maturity date.
  const commencement = new Date(`${policy.riskCommencementDate}T12:00:00`)
  const statementDate = new Date(commencement)
  statementDate.setFullYear(maturityDate.getFullYear())
  if (statementDate > maturityDate) {
    statementDate.setFullYear(statementDate.getFullYear() - 1)
  }

  const monthsBeforeMaturity = Math.max(1, Math.round(
    (maturityDate - statementDate) / (1000 * 60 * 60 * 24 * 30.44),
  ))
  return { maturityDate, statementDate, monthsBeforeMaturity }
}

function AnnualStatementPreview({ selectedCase, policy, onClose, onOpenPortal, onSeeOptions }) {
  const { maturityDate, statementDate, monthsBeforeMaturity } = annualStatementTiming(policy)
  const dateFormat = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
  const pot = mockPotValue(selectedCase.policy)
  const maturityProjection = [
    ['Lower illustration · 2%', projectedValue(pot, 0.02, 1)],
    ['Mid illustration · 4%', projectedValue(pot, 0.04, 1)],
    ['Higher illustration · 6%', projectedValue(pot, 0.06, 1)],
  ]

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="modal-card annual-statement-modal" role="dialog" aria-modal="true" aria-labelledby="annual-statement-title">
        <button className="modal-close" type="button" aria-label="Close email preview" onClick={onClose}>×</button>
        <p className="eyebrow">ANNUAL STATEMENT</p>
        <h2 id="annual-statement-title">Annual pension statement</h2>
        <div className="email-headers">
          <p><span>To</span><strong>{selectedCase.customer}</strong></p>
          <p><span>Subject</span><strong>Your annual pension statement — {selectedCase.policy}</strong></p>
          <p>
            <span>Statement date</span>
            <strong>{dateFormat.format(statementDate)} · {monthsBeforeMaturity} months before maturity</strong>
          </p>
        </div>
        <div className="email-body">
          <p>Dear {firstName(selectedCase.customer)},</p>
          <p>Your policy is approaching its planned maturity date of {dateFormat.format(maturityDate)}. Here is a snapshot to help you start thinking about your next steps.</p>
          <p className="statement-timing-note">
            As your policy matures in {monthsBeforeMaturity} months, this statement also shows what your pot
            could be worth at maturity and the options available to you.
          </p>
          <div className="statement-value">
            <span>Your fund value today (illustrative)</span>
            <strong>{formatEuro(pot)}</strong>
            <small>Illustrative figure</small>
          </div>
          <strong>Illustrative value at planned maturity</strong>
          <div className="statement-projections">
            {maturityProjection.map(([label, value]) => <div key={label}><span>{label}</span><strong>{formatEuro(value)}</strong></div>)}
          </div>
          <p>Example growth rates before fees, tax and inflation. Not a forecast or a guarantee.</p>
          <div className="statement-next-step">
            <strong>What you can do now</strong>
            <p>
              Your options are ready to explore in your online portal: a guaranteed income, a lump sum,
              or staying invested. When you want to talk them through, ask your advisor from there.
            </p>
            {onOpenPortal ? (
              <button className="button button-primary" type="button" onClick={onOpenPortal}>Open the customer portal</button>
            ) : (
              <button className="button button-primary" type="button" onClick={onSeeOptions ?? onClose}>See my options →</button>
            )}
          </div>
        </div>
        {onOpenPortal ? <p className="email-preview-note">Shown as the customer receives it.</p> : null}
      </section>
    </div>
  )
}

function CustomerView({
  cases,
  selectedCase,
  casesLoading,
  casesError,
  journeyState,
  focus,
  demoActive,
  optionReview,
  onOptionReview: setOptionReview,
  onOpenStatement,
  onSeeOptionsInDemo,
  onClearFocus,
  onSelectCase,
  onRetryCases,
  onRetryJourney,
  onRequestAdvice,
  onSubmitDocument,
  demoAccountHolder,
}) {
  // Hidden file inputs behind each Upload button.
  const fileInputs = useRef({})
  const journey = journeyState.data
  const retirementCase = journey?.retirementCase
  const selectedOption = retirementCase?.maturityOption
  const customerPreference = retirementCase?.customerPreference || null
  const adviceRecord = retirementCase?.adviceRecord || null
  const uploadedDocuments = new Set(journey?.uploadedDocuments ?? [])
  const caseStatus = retirementCase?.caseStatus ?? selectedCase?.backendStatus
  const requiredDocuments = journey?.requiredDocuments ?? []
  const outstandingDocuments = new Set(journey?.outstandingDocuments ?? [])
  const potValue = mockPotValue(retirementCase?.policyId || selectedCase?.policy)
  const policyState = usePolicyDetails(selectedCase?.policy)
  const statementReady = policyState.status === 'success' && Boolean(policyState.data?.maturityDate)
  const statementTiming = statementReady ? annualStatementTiming(policyState.data) : null
  // The statement is opened by focus, so moving to another demo step closes it.
  const statementOpen = statementReady && focus === 'annual-statement'

  const closeStatement = () => onClearFocus?.()

  const seeOptions = () => {
    if (onSeeOptionsInDemo) {
      onSeeOptionsInDemo()
      return
    }
    closeStatement()
    setOptionReview(null)
    window.requestAnimationFrame(() => {
      document.getElementById('your-options')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="customer-page">
      <header className="customer-header">
        <Brand subline="Retirement Hub" />
        <div className="customer-header-right">
          <span>Help and support</span>
          <span className="avatar">{initials(selectedCase?.customer)}</span>
        </div>
      </header>
      <main className="customer-main">
        <div className="customer-welcome">
          <p className="eyebrow">YOUR RETIREMENT JOURNEY</p>
          <h1>{selectedCase ? `Welcome back, ${firstName(selectedCase.customer)}` : 'Your retirement'}</h1>
          <p className="muted-copy">Your pension is approaching maturity. Here is where things stand and what happens next.</p>
        </div>
        {casesLoading ? (
          <section className="panel connection-state" role="status">
            <div className="loading-indicator" aria-hidden="true" />
            <strong>Loading your details…</strong>
          </section>
        ) : casesError ? (
          <section className="panel connection-state connection-error" role="alert">
            <div><strong>Could not load cases</strong><p>{casesError}</p></div>
            <button className="button button-primary" type="button" onClick={onRetryCases}>Retry</button>
          </section>
        ) : cases.length === 0 ? (
          <section className="panel connection-state">
            <EmptyState title="No cases yet" detail="Add a maturing policy from the case worker view first." />
          </section>
        ) : selectedCase ? (
          <>
            <section className="panel live-case-selector" hidden={demoActive}>
              <label htmlFor="customer-case">Viewing as</label>
              <div className="customer-case-select-row">
                <select id="customer-case" value={selectedCase.id} onChange={(event) => {
                  setOptionReview(null)
                  onSelectCase(event.target.value)
                }}>
                  {cases.map((item) => (
                    <option value={item.id} key={item.id}>{item.customer} · {item.id}</option>
                  ))}
                </select>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={journeyState.status === 'loading' || journeyState.actionBusy}
                  onClick={onRetryJourney}
                >
                  Refresh
                </button>
              </div>
            </section>
            {journeyState.status === 'loading' ? (
              <section className="panel connection-state" role="status">
                <div className="loading-indicator" aria-hidden="true" /><strong>Loading journey…</strong>
              </section>
            ) : journeyState.status === 'error' ? (
              <section className="panel connection-state connection-error" role="alert">
                <div><strong>Could not load this journey</strong><p>{journeyState.error}</p></div>
                <button className="button button-primary" type="button" onClick={onRetryJourney}>Retry</button>
              </section>
            ) : journey ? (
              <>
                <section className="panel annual-statement-cta">
                  <div className="annual-statement-cta-copy">
                    <p className="eyebrow">ANNUAL STATEMENT</p>
                    <h2>Your yearly pension statement</h2>
                    <p className="muted-copy">
                      {statementTiming
                        ? `Sent on your policy anniversary, ${statementTiming.monthsBeforeMaturity} months before maturity. `
                        : 'Sent on your policy anniversary. '}
                      Because maturity is coming up, it also shows what your pot could be worth and what
                      your options are.
                    </p>
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!statementReady}
                    onClick={onOpenStatement}
                  >
                    {policyState.status === 'loading' ? 'Loading statement…' : 'Open annual statement'}
                  </button>
                </section>
                <PensionPotCard
                  policy={retirementCase.policyId || selectedCase.policy}
                  potValue={potValue}
                  caseStatus={caseStatus}
                  selectedOption={selectedOption}
                  outstandingCount={outstandingDocuments.size}
                />
                <JourneyProgress
                  selectedOption={selectedOption}
                  outstandingCount={outstandingDocuments.size}
                  status={caseStatus}
                />
                <section className="customer-card panel live-customer-card">
                  <header className="customer-card-heading">
                    <div>
                      <p className="eyebrow">POLICY {retirementCase.policyId || selectedCase.policy}</p>
                      <h2>Your next steps</h2>
                    </div>
                    <StatusPill tone={statusTone(caseStatus || '')}>{customerStatus(caseStatus)}</StatusPill>
                  </header>
                  {journey.message && !['MATURITY_PACKAGE_SENT', 'AWAITING_INFORMATION'].includes(caseStatus) ? (
                    <p className="journey-message">{journey.message.replace(/[[\]]/g, '')}</p>
                  ) : null}
                  {journeyState.actionError ? <p className="workflow-message workflow-error" role="alert">{journeyState.actionError}</p> : null}

                  <section className="live-journey-section" id="your-options">
                    <p className="eyebrow">YOUR MATURITY OPTIONS</p>
                    <h3>
                      {optionReview
                        ? 'Take a closer look'
                        : selectedOption ? 'Your advised option' : 'Explore your options'}
                    </h3>
                    {optionReview ? (
                      <OptionReview
                        option={optionReview}
                        options={journey.availableOptions}
                        onSelectOption={setOptionReview}
                        pot={potValue}
                        preference={customerPreference}
                        status={caseStatus}
                        busy={journeyState.actionBusy}
                        onBack={() => setOptionReview(null)}
                        onRequestAdvice={(option) => {
                          onRequestAdvice(option)
                          setOptionReview(null)
                        }}
                      />
                    ) : selectedOption ? (
                      <AdvisedOptionSummary
                        option={selectedOption}
                        advice={adviceRecord}
                        preference={customerPreference}
                      />
                    ) : journey.availableOptions.length ? (
                      <>
                        <p className="muted-copy">
                          Here is how each option works, with example figures. Nothing is chosen on this
                          screen: your advisor talks the options through with you.
                        </p>
                        <div className="option-list">
                          {journey.availableOptions.map((option) => (
                            <button
                              className="option-card"
                              type="button"
                              key={option}
                              disabled={journeyState.actionBusy}
                              onClick={() => setOptionReview(option)}
                            >
                              <span className={`option-art option-art-${optionInformation[option].illustration}`}><OptionIllustration kind={optionInformation[option].illustration} /></span>
                              <span className="option-copy">
                                <strong>{maturityOptionLabels[option] || option}</strong>
                                <span>{optionInformation[option].heading}</span>
                                <small>See example figures →</small>
                              </span>
                            </button>
                          ))}
                        </div>
                        <AdviceRequestPanel
                          status={caseStatus}
                          preference={customerPreference}
                          appointmentAt={retirementCase.appointmentAt}
                          busy={journeyState.actionBusy}
                          onRequestAdvice={onRequestAdvice}
                        />
                      </>
                    ) : <p className="muted-copy">No further maturity options are available for this case.</p>}
                  </section>

                  {selectedOption && !optionReview ? <section className="live-journey-section" id="your-documents">
                    <p className="eyebrow">REQUIRED DOCUMENTS</p>
                    <h3>Documents for this journey</h3>
                    {requiredDocuments.length ? (
                      <div className="live-document-list">
                        {requiredDocuments.map((document) => {
                          const label = documentLabels[document] || document
                          const uploaded = uploadedDocuments.has(document)
                          const outstanding = outstandingDocuments.has(document)
                          return (
                            <article className="live-document-row" key={document}>
                              <div className="live-document-copy">
                                <strong>{label}</strong>
                                <StatusPill tone={uploaded ? 'green' : 'amber'}>
                                  {uploaded ? 'Recorded' : outstanding ? 'Outstanding' : 'Required'}
                                </StatusPill>
                              </div>
                              {outstanding && !uploaded && selectedOption ? (
                                <div className="live-document-submit">
                                  <input
                                    hidden
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    ref={(element) => { fileInputs.current[document] = element }}
                                    onChange={(event) => {
                                      const name = event.target.files?.[0]?.name
                                      if (name) onSubmitDocument(document, name)
                                    }}
                                  />
                                  <button
                                    className="button button-primary document-upload-button"
                                    type="button"
                                    disabled={journeyState.actionBusy}
                                    onClick={() => (demoActive
                                      // The guided demo skips the file dialog.
                                      ? onSubmitDocument(
                                        document,
                                        `${document.toLowerCase()}.pdf`,
                                        document === 'BANK_DETAILS' ? demoAccountHolder : null,
                                      )
                                      : fileInputs.current[document]?.click())}
                                  >
                                    {journeyState.actionBusy ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
                                  </button>
                                </div>
                              ) : outstanding && !uploaded ? (
                                <small className="document-prerequisite">Your advisor records your option before documents are requested.</small>
                              ) : null}
                            </article>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="muted-copy">Your documents will appear here once your advisor has recorded your option.</p>
                    )}
                  </section> : null}
                  {caseStatus === 'COMPLETED' ? (
                    <div className="customer-complete-message" role="status">
                      <strong>You are all set</strong>
                      <p>We have everything we need. Your money will be ready on your maturity date.</p>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}
          </>
        ) : null}
        <p className="customer-privacy">
          Figures shown are illustrative and are not financial advice.
        </p>
      </main>
      {statementOpen && selectedCase && policyState.data ? (
        <AnnualStatementPreview
          selectedCase={selectedCase}
          policy={policyState.data}
          onClose={closeStatement}
          onSeeOptions={seeOptions}
        />
      ) : null}
      <footer className="customer-footer">
        <span>Canada Life</span><span>Privacy</span><span>Accessibility</span><span>Help</span>
      </footer>
    </div>
  )
}

function caseSignal(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'ON_HOLD' || normalized === 'CANCELLED') return 'red'
  if (normalized === 'COMPLETED') return 'green'
  if ([
    'AWAITING_CUSTOMER',
    'AWAITING_INFORMATION',
    'MATURITY_PACKAGE_SENT',
    'ADVICE_REQUESTED',
    'APPOINTMENT_BOOKED',
  ].includes(normalized)) return 'amber'
  return 'neutral'
}

function caseNextAction(status) {
  const nextActions = {
    NEW: 'The platform is checking the maturity date.',
    MATURITY_DETECTED: 'The platform is working out who advises this customer.',
    CLE_OWNER_DETECTED: 'Lead is with In-House Sales. Waiting for the customer to ask for advice.',
    NON_CLE_OWNER_DETECTED: 'Lead is with the broker. Waiting for the customer to ask for advice.',
    ADVICE_REQUESTED: 'Accept the lead and book the advice conversation.',
    APPOINTMENT_BOOKED: 'Give the advice and record the option with the client.',
    IN_PROGRESS: 'Advice recorded. The formal maturity pack goes out automatically.',
    MATURITY_PACKAGE_SENT: 'Formal pack issued. Waiting for the customer’s documents.',
    AWAITING_INFORMATION: 'One targeted request sent for the missing document.',
    AWAITING_CUSTOMER: 'Waiting on the customer.',
    ON_HOLD: 'Automation stopped. A case worker needs to resolve this.',
    CANCELLED: 'Case cancelled. Nothing more to do.',
    COMPLETED: 'Nothing to do. Ready to pay out at maturity.',
  }
  return nextActions[String(status || '').toUpperCase()] || 'Open the case to review its current status.'
}

function caseActionLabel(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'ADVICE_REQUESTED') return 'Pick up lead'
  if (normalized === 'APPOINTMENT_BOOKED') return 'Give advice'
  const signal = caseSignal(status)
  if (signal === 'red') return 'Review exception'
  if (signal === 'amber') return 'Review next step'
  if (signal === 'green') return 'View completed'
  return 'Open case'
}

function CaseStatusSummary({ status }) {
  const signal = caseSignal(status)
  const heading = signal === 'red'
    ? 'Needs attention'
    : signal === 'amber'
      ? 'Waiting on the customer or advisor'
      : signal === 'green'
        ? 'Journey complete'
        : 'Moving automatically'
  return (
    <section className={`case-status-summary summary-${signal}`}>
      <span className="signal-dot" aria-hidden="true" />
      <div><strong>{heading}</strong><p>{caseNextAction(status)}</p></div>
    </section>
  )
}

function statusTone(status) {
  const signal = caseSignal(status)
  if (signal !== 'neutral') return signal
  const normalized = status.toLowerCase()
  if (normalized.includes('decision') || normalized.includes('review') || normalized.includes('cancel')) return 'red'
  if (normalized.includes('ready') || normalized.includes('received') || normalized.includes('completed')) return 'green'
  if (normalized.includes('customer') || normalized.includes('signature') || normalized.includes('hold')) return 'amber'
  return 'neutral'
}

/** Which swimlane an audit entry belongs in, from who performed it. */
function timelineLane(event) {
  if (event.automated) return 'platform'
  const actor = String(event.actor || '')
  if (actor === 'Customer') return 'customer'
  if (/broker|in-house/i.test(actor)) return 'advisor'
  return 'operations'
}

const timelineLanes = [
  ['platform', 'Platform', 'Automated'],
  ['customer', 'Customer', 'Self-service'],
  ['advisor', 'Advisor', 'Broker or In-House Sales'],
  ['operations', 'CLE Operations', 'Manual admin'],
]

/**
 * One case from start to finish, laid out by who did each step. The
 * operations row is the measure: the fewer entries, the less manual effort.
 */
function JourneyTimeline({ selectedCase }) {
  const events = [...selectedCase.journeyEvents].sort((a, b) => new Date(a.at) - new Date(b.at))
  const counts = Object.fromEntries(timelineLanes.map(([key]) => [key, 0]))
  events.forEach((event) => { counts[timelineLane(event)] += 1 })

  return (
    <div className="journey-timeline-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">CASE TIMELINE</p>
          <h1>{selectedCase.customer}</h1>
          <p className="muted-copy">{selectedCase.policy} · every action on this case, by who performed it</p>
        </div>
        <StatusPill tone={caseSignal(selectedCase.backendStatus)}>{selectedCase.status}</StatusPill>
      </header>
      <section className="panel journey-timeline">
        {timelineLanes.map(([key, label, detail]) => {
          const laneEvents = events
            .map((event, index) => ({ event, order: index + 1 }))
            .filter(({ event }) => timelineLane(event) === key)
          return (
            <div className={`timeline-row timeline-row-${key}`} key={key}>
              <div className="timeline-lane-label">
                <strong>{label}</strong>
                <small>{detail}</small>
                <span className="timeline-lane-count">{laneEvents.length}</span>
              </div>
              <div className="timeline-lane-events">
                {laneEvents.length ? laneEvents.map(({ event, order }) => (
                  <div className={`timeline-event timeline-event-${key}`} key={order} title={event.detail}>
                    <span className="timeline-event-order">{order}</span>
                    <strong>{auditActionLabels[event.action] || event.action}</strong>
                    <small>{formatEventDate(event.at)}</small>
                  </div>
                )) : <p className="timeline-lane-empty">No manual activity</p>}
              </div>
            </div>
          )
        })}
      </section>
      <div className="metric-grid timeline-summary">
        <Metric label="Done by the platform" value={counts.platform} tone="green" />
        <Metric label="Customer self-service" value={counts.customer} />
        <Metric label="Advice from the advisor" value={counts.advisor} />
        <Metric label="Manual admin by CLE Operations" value={counts.operations} tone={counts.operations ? 'red' : 'green'} />
      </div>
    </div>
  )
}

export default App
