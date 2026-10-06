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

/** Pre-filled so the presenter can record advice with a single click. */
const DEFAULT_RATIONALE = 'Mary wanted the full cash sum, but most of it was earmarked for day-to-day '
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
  if (!meta) return <StatusPill tone="neutral">Awaiting response</StatusPill>
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
    status: record.caseStatus.toLowerCase().split('_').map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1),
    ).join(' '),
    backendStatus: record.caseStatus,
    detail: record.description || 'No description provided by the case service.',
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

/**
 * Ordered presenter script for the guided demo. Each step drives the real
 * application into the view the named audience would see at that point in the
 * timeline, selecting the scenario case the step is about, so the demo shows
 * live screens and live state rather than mock-ups.
 */
/** Who the audience is watching at each step. */
const personas = {
  customer: { name: 'Mary Doyle', role: 'Customer', tone: 'customer' },
  broker: { name: 'Meridian Financial', role: 'Her broker', tone: 'broker' },
  caseworker: { name: 'Canada Life', role: 'Operations', tone: 'caseworker' },
}

const demoFlowSteps = [
  {
    id: 'detect',
    when: 'A year before maturity',
    title: 'We spot it before anyone asks',
    role: 'caseworker',
    caseId: SCENARIO_A,
    page: 'Operations queue — every maturity we know about.',
    doNow: 'Open Mary’s case live, or point at the one already in the queue.',
    summary: 'A year out, the policy raises its own case. Nobody had to remember.',
    createCase: true,
    caseworkerPage: 'queue',
  },
  {
    id: 'advisor-routing',
    when: 'A year before maturity',
    title: 'We work out who advises her',
    role: 'caseworker',
    caseId: SCENARIO_A,
    page: 'Mary’s case — who owns the relationship.',
    doNow: 'Point at the broker: Meridian Financial, decided automatically.',
    summary: 'Mary is a broker client, so the lead belongs to her broker — not to us.',
    caseworkerPage: 'case',
  },
  {
    id: 'annual-statement',
    when: 'Seven months before',
    title: 'Her yearly statement does the work',
    role: 'customer',
    caseId: SCENARIO_A,
    page: 'Mary’s portal — the statement she was getting anyway.',
    doNow: 'Point out we added maturity to a letter she already receives.',
    summary: 'No extra mailing. We used the statement she was already due.',
    customerFocus: 'annual-statement',
  },
  {
    id: 'request-advice',
    when: 'Six months before',
    title: 'Mary asks for advice',
    role: 'customer',
    caseId: SCENARIO_A,
    status: 'NON_CLE_OWNER_DETECTED',
    advancesTo: 'ADVICE_REQUESTED',
    live: true,
    page: 'Mary’s portal — her options, with nothing to sign.',
    doNow: 'Open an option, then ask her broker to talk it through.',
    summary: 'She can read about her options, but she cannot pick one here. That is deliberate.',
  },
  {
    id: 'lead-arrives',
    when: 'Six months before',
    title: 'It lands with her broker',
    role: 'broker',
    caseId: SCENARIO_A,
    status: 'ADVICE_REQUESTED',
    page: 'Broker queue — Meridian’s clients, most urgent first.',
    doNow: 'Find Mary and click “Pick up lead”.',
    summary: 'No email, no handover. The request appears in her broker’s own list.',
    brokerPage: 'list',
  },
  {
    id: 'broker-workspace',
    when: 'Six months before',
    title: 'Everything already in one place',
    role: 'broker',
    caseId: SCENARIO_A,
    status: 'ADVICE_REQUESTED',
    advancesTo: 'APPOINTMENT_BOOKED',
    live: true,
    page: 'Advice workspace — Mary’s details and her options together.',
    doNow: 'Accept the lead, then book the appointment.',
    summary: 'This is the screen that saves the broker the most time.',
    brokerPage: 'case',
  },
  {
    id: 'broker-advises',
    when: 'Six months before',
    title: 'The broker advises Mary',
    role: 'broker',
    caseId: SCENARIO_A,
    status: 'APPOINTMENT_BOOKED',
    advancesTo: 'IN_PROGRESS',
    live: true,
    page: 'Advice workspace — record the advice.',
    doNow: 'The option and reason are pre-filled. Just click Record.',
    summary: 'The broker decides with Mary, and the reason is saved at the same moment.',
    brokerPage: 'case',
  },
  {
    id: 'formalise',
    when: 'Five months before',
    title: 'Now we make it official',
    role: 'caseworker',
    caseId: SCENARIO_A,
    status: 'IN_PROGRESS',
    advancesTo: 'MATURITY_PACKAGE_SENT',
    live: true,
    page: 'Mary’s case — issue the formal pack.',
    doNow: 'Click “Issue the formal pack”.',
    summary: 'Paperwork comes last, and it confirms a decision instead of asking for one.',
    caseworkerPage: 'case',
  },
  {
    id: 'documents',
    when: 'Four months before',
    title: 'Mary sends what we need',
    role: 'customer',
    caseId: SCENARIO_A,
    status: 'MATURITY_PACKAGE_SENT',
    advancesTo: 'COMPLETED',
    live: true,
    page: 'Mary’s portal — her agreed option and the documents for it.',
    doNow: 'Record both documents.',
    summary: 'She only sends documents once her choice is already agreed.',
  },
  {
    id: 'lanes',
    when: 'At any point',
    title: 'Three clients, three outcomes',
    role: 'caseworker',
    page: 'Operations — how every case sorts itself.',
    doNow: 'Compare the three: only the red one needs a person.',
    summary: 'This is not a date on the timeline. Every case sorts into one of three lanes as soon as we have an answer.',
    caseworkerPage: 'lanes',
  },
  {
    id: 'maturity',
    when: 'Maturity day',
    title: 'Mary is ready to be paid',
    role: 'caseworker',
    caseId: SCENARIO_A,
    status: 'COMPLETED',
    page: 'Mary’s case — done, and done early.',
    doNow: 'Her case was finished months ago. Nobody chased her.',
    summary: 'Everything was settled well before today, with no operational handling at all.',
    caseworkerPage: 'case',
  },
]

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
  const selectedCase = displayedCases.find((item) => item.id === selectedCaseId)
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
    setWorkflowResult({ kind: 'info', message: 'Creating policy and assessing maturity…' })
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
          message: `Policy ${policy.policyId} was created, but it did not meet the backend’s one-year maturity rule. No case was created.`,
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
      const classification = ownerResult
        ? ` Owner detection classified this as ${ownerResult.ownerType} and assigned ${ownerResult.email}; no email was sent.`
        : ` Owner detection was already applied; the case is ${currentCase?.backendStatus ?? assessment.linkedCase.caseStatus}.`
      setWorkflowResult({
        kind: 'success',
        message: `Policy ${policy.policyId} was assessed and case ${assessment.linkedCase.caseId} is now in the live queue.${classification} The scheduled backend job may generate a maturity-package email body, but does not deliver email.`,
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
      notify('Case updated in the backend: awaiting customer.')
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
  const submitJourneyDocument = (document, fileName) => mutateJourney(
    (caseId) => recordJourneyDocument(caseId, document, fileName),
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
  ).then((journey) => {
    if (journey) notify('Lead accepted. You now own this conversation.')
    return journey
  })

  const advisorBookAppointment = (details) => runAdvisorAction(
    (caseId) => bookAppointment(caseId, details),
  ).then((journey) => {
    if (journey) notify('Advice appointment booked.')
    return journey
  })

  const advisorRecordAdvice = (details) => runAdvisorAction(
    (caseId) => recordRecommendation(caseId, details),
  ).then((journey) => {
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
      notify('Formal maturity pack issued. Mary has been asked for her documents.')
    } catch (error) {
      setCaseActionError(error instanceof Error ? error.message : 'Could not issue the formal pack.')
    } finally {
      setCaseActionBusy(false)
    }
  }

  const selectRole = (nextRole) => {
    setRole(nextRole)
  }

  const demoStep = demoStepIndex === null ? null : demoFlowSteps[demoStepIndex]

  const goToDemoStep = (index) => {
    const step = demoFlowSteps[index]
    if (!step) return
    setDemoStepIndex(index)
    setRole(step.role)
    if (step.caseId) setSelectedCaseId(step.caseId)
    if (step.role === 'caseworker') setCaseworkerPage(step.caseworkerPage ?? 'queue')
    if (step.role === 'broker') setBrokerPage(step.brokerPage ?? 'list')
    setCustomerFocus(step.customerFocus ?? '')
  }

  const restoreDemoData = async () => {
    setCaseActionBusy(true)
    try {
      const records = await resetDemoData()
      setCaseLoadState({ status: 'success', cases: records.map(mapBackendCase), error: '' })
      setJourneyReload((count) => count + 1)
      notify('Demo data restored to the three prototype scenarios.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not reset the demo data.')
    } finally {
      setCaseActionBusy(false)
    }
  }

  /**
   * Drives the demo case forward to whatever state the current step expects,
   * using the real endpoints. Lets a presenter jump to any step without hitting
   * an out-of-order error.
   */
  const catchUpToStep = async (step) => {
    const targetCaseId = step?.caseId
    if (!targetCaseId || !step.status) return

    setCaseActionBusy(true)
    setCaseActionError('')
    try {
      const order = [
        'NON_CLE_OWNER_DETECTED',
        'CLE_OWNER_DETECTED',
        'ADVICE_REQUESTED',
        'APPOINTMENT_BOOKED',
        'IN_PROGRESS',
        'MATURITY_PACKAGE_SENT',
        'COMPLETED',
      ]
      // CLE and NON_CLE owner detection are the same point in the journey.
      const rank = (status) => (status === 'CLE_OWNER_DETECTED' ? 0 : order.indexOf(status))
      const targetIndex = rank(step.status)
      let records = await fetchCases()
      let current = records.find((item) => item.caseId === targetCaseId)

      // Rewind first if the case has already moved past the step.
      if (current && rank(current.caseStatus) > targetIndex) {
        const reset = await resetDemoData()
        records = reset
        current = records.find((item) => item.caseId === targetCaseId)
      }

      for (let guard = 0; guard < 8; guard += 1) {
        const index = rank(current?.caseStatus)
        if (index === -1 || index >= targetIndex) break

        if (current.caseStatus === 'NON_CLE_OWNER_DETECTED' || current.caseStatus === 'CLE_OWNER_DETECTED') {
          await requestAdvice(targetCaseId, 'LUMP_SUM')
        } else if (current.caseStatus === 'ADVICE_REQUESTED') {
          await bookAppointment(targetCaseId, {
            appointmentAt: new Date(Date.now() + 3 * 86400000).toISOString(),
            advisor: 'Meridian Financial',
            channel: 'Telephone',
          })
        } else if (current.caseStatus === 'APPOINTMENT_BOOKED') {
          await recordRecommendation(targetCaseId, {
            recommendedOption: 'ANNUITY',
            rationale: DEFAULT_RATIONALE,
            advisor: 'Meridian Financial',
            channel: 'Telephone',
          })
        } else if (current.caseStatus === 'IN_PROGRESS') {
          await issueMaturityPackages()
        } else if (current.caseStatus === 'MATURITY_PACKAGE_SENT') {
          await recordJourneyDocument(targetCaseId, 'PASSPORT', 'demo-passport.pdf')
          await recordJourneyDocument(targetCaseId, 'BANK_DETAILS', 'demo-bank.pdf')
        }

        records = await fetchCases()
        current = records.find((item) => item.caseId === targetCaseId)
      }

      setCaseLoadState({ status: 'success', cases: records.map(mapBackendCase), error: '' })
      setJourneyReload((count) => count + 1)
      notify(`${targetCaseId} is ready for this step.`)
    } catch (error) {
      setCaseActionError(error instanceof Error ? error.message : 'Could not prepare this step.')
    } finally {
      setCaseActionBusy(false)
    }
  }

  const exitDemoFlow = () => {
    setDemoStepIndex(null)
    setCustomerFocus('')
  }

  useEffect(() => {
    if (demoStepIndex === null) return undefined

    const onKeyDown = (event) => {
      const tag = event.target instanceof HTMLElement ? event.target.tagName : ''
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToDemoStep(Math.min(demoStepIndex + 1, demoFlowSteps.length - 1))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToDemoStep(Math.max(demoStepIndex - 1, 0))
      } else if (event.key === 'Escape') {
        exitDemoFlow()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className={`app-shell role-${role}${demoStep ? ' demo-flow-active' : ''}`}>
      {role === 'caseworker' ? (
        <CaseworkerView
          cases={caseLoadState.cases}
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
          onNotify={notify}
          onRunJourney={runLiveJourney}
          workflowBusy={workflowBusy}
          workflowResult={workflowResult}
          caseActionBusy={caseActionBusy}
          caseActionError={caseActionError}
          onRequestInformation={persistCaseAction}
          onIssueFormalPack={issueFormalPack}
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
          cases={caseLoadState.cases}
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
          onBookAppointment={advisorBookAppointment}
          onRecordAdvice={advisorRecordAdvice}
          onPreviewCustomer={(caseId) => {
            setSelectedCaseId(caseId)
            selectRole('customer')
          }}
        />
      ) : null}
      {role === 'customer' ? (
        <CustomerView
          cases={caseLoadState.cases}
          selectedCase={selectedCase}
          casesLoading={caseLoadState.status === 'loading'}
          casesError={caseLoadState.status === 'error' ? caseLoadState.error : ''}
          journeyState={currentJourneyState}
          focus={customerFocus}
          onClearFocus={() => setCustomerFocus('')}
          onSelectCase={(id) => setSelectedCaseId(id)}
          onRetryCases={reloadCases}
          onRetryJourney={() => setJourneyReload((count) => count + 1)}
          onRequestAdvice={submitAdviceRequest}
          onSubmitDocument={submitJourneyDocument}
          onNotify={notify}
        />
      ) : null}

      {demoStep ? (
        <>
          <DemoStepBanner step={demoStep} stepIndex={demoStepIndex} total={demoFlowSteps.length} />
          <DemoFlowRail
            steps={demoFlowSteps}
            stepIndex={demoStepIndex}
            step={demoStep}
            caseStatus={selectedCase?.backendStatus || ''}
            caseId={selectedCase?.id || ''}
            resetBusy={caseActionBusy}
            onReset={restoreDemoData}
            onCatchUp={() => catchUpToStep(demoStep)}
            onStep={goToDemoStep}
            onExit={exitDemoFlow}
          />
        </>
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
        <span aria-hidden="true">▶</span> Demo flow
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
 * Presenter control for the guided walkthrough. It drives the real application
 * into each step's view, so the audience always sees live screens.
 */
/**
 * Sits on top of whichever screen the demo is showing and says, in plain terms,
 * what this page is and what to do on it. Keeps the audience oriented without
 * the presenter having to narrate the mechanics.
 */
function DemoStepBanner({ step, stepIndex, total }) {
  const persona = personas[step.role]
  return (
    <div className={`demo-step-banner audience-${persona.tone}`} role="status">
      <span className="demo-step-banner-index">{stepIndex + 1}/{total}</span>
      <span className="demo-step-banner-when">{step.when}</span>
      <span className="demo-step-banner-persona">
        <strong>{persona.name}</strong>
        <small>{persona.role}</small>
      </span>
      <span className="demo-step-banner-page">{step.page}</span>
      {step.doNow ? (
        <span className="demo-step-banner-do">
          <strong>{step.live ? 'Do now:' : 'Say:'}</strong> {step.doNow}
        </span>
      ) : null}
    </div>
  )
}

function DemoFlowRail({
  steps, stepIndex, step, caseStatus, caseId, resetBusy, onReset, onCatchUp, onStep, onExit,
}) {
  const railRef = useRef(null)
  const atStart = stepIndex === 0
  const atEnd = stepIndex === steps.length - 1

  // Live steps are the ones the presenter performs on stage, so they report
  // progress rather than warning that the case has moved on.
  let cue = null
  if (step.live && caseStatus === step.advancesTo) {
    cue = { tone: 'done', text: `Done. ${caseId} advanced to ${caseStatus}.` }
  } else if (step.status && caseStatus === step.status) {
    cue = {
      tone: 'ready',
      text: step.live
        ? `Ready. ${caseId} is at ${caseStatus} — perform the action now.`
        : `${caseId} is at ${caseStatus}, as this step describes.`,
    }
  } else if (step.status && caseStatus && step.status !== caseStatus) {
    cue = {
      tone: 'warn',
      text: `This step needs ${step.status}, but ${caseId || 'the case'} is at ${caseStatus}.`,
      fixable: true,
    }
  }

  // Keep the page's bottom padding in step with the rail so nothing hides behind it.
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return undefined

    const apply = () => document.documentElement.style.setProperty('--demo-rail-height', `${rail.offsetHeight}px`)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(rail)

    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--demo-rail-height')
    }
  }, [])

  return (
    <aside className="demo-flow-rail" aria-label="Guided demo flow" ref={railRef}>
      <div className="demo-flow-timeline" role="tablist" aria-label="Demo flow steps">
        {steps.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === stepIndex}
            title={`${item.when} — ${item.title}`}
            className={
              index === stepIndex
                ? 'demo-flow-tick current'
                : index < stepIndex
                  ? 'demo-flow-tick done'
                  : 'demo-flow-tick'
            }
            onClick={() => onStep(index)}
          >
            <span className="demo-flow-tick-time">{item.when}</span>
            <span className="demo-flow-tick-label">{item.title}</span>
          </button>
        ))}
      </div>

      <div className="demo-flow-body">
        <div className="demo-flow-headline">
          <span className={`demo-flow-audience audience-${personas[step.role].tone}`}>
            {personas[step.role].name}
          </span>
          <div className="demo-flow-title-block">
            <strong>{step.title}</strong>
            <span className="demo-flow-counter">
              {step.when} · Step {stepIndex + 1} of {steps.length}
            </span>
            {step.live ? <span className="demo-flow-live">Do this live</span> : null}
          </div>
        </div>

        <p className="demo-flow-summary">{step.summary}</p>

        {cue ? (
          <p className={`demo-flow-hint demo-flow-hint-${cue.tone}`} role="status">
            {cue.text}
            {cue.fixable ? (
              <button className="demo-flow-fix" type="button" disabled={resetBusy} onClick={onCatchUp}>
                {resetBusy ? 'Preparing…' : 'Catch the case up'}
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="demo-flow-controls">
        <button className="button button-secondary" type="button" disabled={atStart} onClick={() => onStep(stepIndex - 1)}>
          ← Back
        </button>
        <button className="button button-primary" type="button" disabled={atEnd} onClick={() => onStep(stepIndex + 1)}>
          Next →
        </button>
        <button className="text-button demo-flow-exit" type="button" onClick={onExit}>
          Exit
        </button>
        <button className="text-button demo-flow-reset" type="button" disabled={resetBusy} onClick={onReset}>
          {resetBusy ? 'Restoring…' : 'Reset demo data'}
        </button>
        <span className="demo-flow-keys">← → to move · Esc to exit</span>
      </div>
    </aside>
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
              <code>{event.action}</code>
              <span className={event.automated ? 'audit-actor automated' : 'audit-actor manual'}>
                {event.automated ? 'Automated' : event.actor}
              </span>
              <span className="audit-date">{formatEventDate(event.at)}</span>
            </div>
            <p>{event.detail}</p>
            {event.status ? <small>Resulting status: {event.status}</small> : null}
          </li>
        ))}
      </ol>
      <p className="backend-disclaimer">
        Seeded history uses representative timestamps. Transitions you trigger during the demo are recorded live.
      </p>
    </section>
  )
}

/** Operational efficiency dashboard: the headline outcome of the lane model. */
function EfficiencyDashboard({ state, onRetry }) {
  if (state.status === 'loading') {
    return (
      <section className="panel connection-state" role="status">
        <div className="loading-indicator" aria-hidden="true" />
        <div><strong>Loading efficiency measures</strong><p>Counting lanes and touchpoints from the live case store…</p></div>
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
    ['GREEN', metrics.greenCases, 'Executed straight through'],
    ['AMBER', metrics.amberCases, 'One targeted request outstanding'],
    ['RED', metrics.redCases, 'Held for a human decision'],
  ]
  // Bars are sized against the classified portfolio so they read as a share of
  // the whole, not relative to whichever lane happens to be largest.
  const laneDenominator = Math.max(1, metrics.classifiedCases)

  return (
    <>
      <section className="efficiency-headline">
        <article className="efficiency-hero">
          <p className="eyebrow">OPERATIONAL TOUCHPOINTS AVOIDED</p>
          <strong>{metrics.manualTouchpointsAvoided}</strong>
          <span>
            of {metrics.baselineManualTouchpoints} in the current process
            · {metrics.manualEffortReductionPercent}% less operational handling
          </span>
        </article>
        <div className="efficiency-metrics">
          <Metric label="Straight-through rate" value={`${metrics.stpRatePercent}%`} tone="green" />
          <Metric label="Exception rate" value={`${metrics.exceptionRatePercent}%`} tone="red" />
          <Metric label="Automated actions" value={metrics.automatedTouchpoints} />
          <Metric label="Operations handling" value={metrics.operationalTouchpoints} tone="amber" />
        </div>
      </section>

      <section className="panel">
        <PanelHeading
          title="Where the human effort goes"
          detail="Not all human effort is waste — only operational handling is what this removes"
        />
        <div className="efficiency-metrics">
          <Metric label="Advice conversations" value={metrics.adviceTouchpoints} tone="green" />
          <Metric label="Client self-service" value={metrics.selfServiceTouchpoints} />
          <Metric label="Operations handling" value={metrics.operationalTouchpoints} tone="amber" />
        </div>
        <p className="muted-copy">
          Advice is the value the broker adds, and self-service replaces a call or a letter. Neither is
          counted against the baseline. Only operational handling is.
        </p>
      </section>

      <section className="panel">
        <PanelHeading
          title="Processing lanes"
          detail={`${metrics.classifiedCases} of ${metrics.totalCases} cases classified · ${metrics.unclassifiedCases} still awaiting a customer response`}
        />
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
        <p className="muted-copy">
          The operating principle is not 100% automation. It is that the platform handles predictable
          work so people spend their time on the red lane.
        </p>
      </section>

      <section className="panel">
        <PanelHeading
          title="Distribution"
          detail="How the advice process is performing for brokers and In-House Sales"
        />
        <div className="efficiency-metrics">
          <Metric label="Leads created" value={metrics.leadsCreated} />
          <Metric label="Leads accepted" value={`${metrics.leadsAccepted} · ${metrics.leadAcceptanceRatePercent}%`} tone="green" />
          <Metric label="Appointments booked" value={`${metrics.appointmentsBooked} · ${metrics.appointmentRatePercent}%`} />
          <Metric label="Advice completed" value={`${metrics.adviceCompleted} · ${metrics.adviceCompletionRatePercent}%`} tone="green" />
        </div>
        <p className="muted-copy">
          Acceptance is measured against leads created, appointments against leads accepted, and advice
          completion against leads created — the drop-off points the pilot needs to watch.
        </p>
      </section>

      <section className="panel">
        <PanelHeading title="How this is measured" detail="What is counted and what is assumed" />
        <ul className="efficiency-method">
          <li>
            <strong>Counted:</strong> lane classification, automated and manual actions are read from the
            audit trail of every live case, including the transitions you trigger in this demo.
          </li>
          <li>
            <strong>Assumed:</strong> {metrics.baselineNote}
          </li>
        </ul>
      </section>
    </>
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
  onNotify,
  onRunJourney,
  workflowBusy,
  workflowResult,
  caseActionBusy,
  caseActionError,
  onRequestInformation,
  onIssueFormalPack,
  highlightCaseId,
  efficiencyState,
  onRetryEfficiency,
  onPreviewCustomer,
}) {
  const [queueFilter, setQueueFilter] = useState('all')
  const [workflowExpanded, setWorkflowExpanded] = useState(true)

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
          <SidebarLink onClick={() => onNotify('Agent activity is illustrative in this prototype.')}>Agent activity</SidebarLink>
          <SidebarLink onClick={() => onNotify('Rules and limits are illustrative in this prototype.')}>Rules and limits</SidebarLink>
          <div className="sidebar-footer">Signed in as case worker<br /><span>Demo access only</span></div>
        </aside>
        <main className="staff-main">
          <button className="text-button back-link" type="button" onClick={onBack}>← Back to case queue</button>
          <BackendCaseDetail
            selectedCase={selectedCase}
            actionBusy={caseActionBusy}
            actionError={caseActionError}
            onRequestInformation={onRequestInformation}
            onIssueFormalPack={onIssueFormalPack}
            onPreviewCustomer={onPreviewCustomer}
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
        <SidebarLink onClick={() => onNotify('Agent activity is illustrative in this prototype.')}>Agent activity</SidebarLink>
        <SidebarLink onClick={() => onNotify('Rules and limits are illustrative in this prototype.')}>Rules and limits</SidebarLink>
        <div className="sidebar-footer">Signed in as case worker<br /><span>Demo access only</span></div>
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
                ? 'How every case sorts itself once we have an answer.'
                : showingEfficiency
                  ? 'What the journey model removes from the operational workload.'
                  : showingExceptions
                    ? 'Cases that need intervention, grouped by their current backend status.'
                    : showingAll
                      ? 'Cases returned by the case service.'
                      : 'Review the cases currently returned by the case service.'}
            </p>
          </div>
          <span className="demo-label live-label">LIVE API · DEMO FLOW</span>
        </header>
        {showingLanes ? (
          <LaneComparison cases={cases} onOpen={onSelectCase} />
        ) : showingEfficiency ? (
          <EfficiencyDashboard state={efficiencyState} onRetry={onRetryEfficiency} />
        ) : loading ? (
          <section className="panel connection-state" role="status">
            <div className="loading-indicator" aria-hidden="true" />
            <div><strong>Loading cases</strong><p>Connecting to the Java case service…</p></div>
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
            {!showingAll && !showingExceptions ? (
              <section className="panel live-workflow-panel">
                <header className="live-workflow-toggle">
                  <div>
                    <h2>Run a live maturity journey</h2>
                    <p>Create a policy, assess maturity, and classify its CLE/non-CLE owner.</p>
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
            <div className="metric-grid">
              <Metric label="Cases returned" value={cases.length} />
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
                <span><strong>Needs attention</strong><small>On hold or cancelled</small></span>
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
                <span><strong>Other stages</strong><small>Active operational workflow</small></span>
                <b>{activeCases.length}</b>
              </button>
            </section>
            <section className="panel">
              <PanelHeading
                title={showingExceptions ? 'Cases needing attention' : showingAll ? 'All cases' : 'Case queue'}
                detail={`${filteredCases.length} of ${cases.length} case${cases.length === 1 ? '' : 's'} · Red / amber / green reflects current case status`}
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
                    ? 'There are no on-hold or cancelled cases in the current API response.'
                    : 'Try another status filter or refresh the case list.'}
                />
              )}
            </section>
            <p className="prototype-note">
              <strong>Status colours:</strong> Red = on hold or cancelled; amber = awaiting customer/information or maturity package; green = completed. Other backend statuses are neutral. These signals are derived from the case status, not a separate risk assessment.
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
      setError('Maturity date must be after the risk commencement date.')
      return
    }
    const today = new Date()
    const latestMaturity = new Date(today)
    latestMaturity.setFullYear(latestMaturity.getFullYear() + 1)
    if (maturityDate <= localDateInput(today) || maturityDate > localDateInput(latestMaturity)) {
      setError('For this demo flow, choose a future maturity date within the next 12 months.')
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
          Partner ID
          <input name="partnerId" required placeholder="e.g. PARTNER-DEMO-10004" />
        </label>
        <label>
          Policy ID <span className="form-hint">(optional)</span>
          <input name="policyId" placeholder="Generated if left blank" />
        </label>
        <label>
          Owner
          <select name="owner" defaultValue="CLE-TEAM">
            <option value="CLE-TEAM">CLE team (CLE)</option>
            <option value="EXTERNAL-BROKER">External broker (non-CLE)</option>
          </select>
        </label>
        <label>
          Risk commencement date
          <input name="riskCommencementDate" type="date" required defaultValue={dateDefaults.today} />
        </label>
        <label>
          Maturity date
          <input name="maturityDate" type="date" required defaultValue={dateDefaults.maturity} />
        </label>
        {error ? <p className="workflow-message workflow-error" role="alert">{error}</p> : null}
        {result ? <p className={`workflow-message workflow-${result.kind}`} role="status">{result.message}</p> : null}
        <div className="live-workflow-footer">
          <span>Demo only: the backend uses an in-memory store.</span>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Running journey…' : 'Create policy & run journey'}
          </button>
        </div>
      </form>
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
          title="Every case sorts itself"
          detail="This happens whenever an answer arrives — it is not a date in the journey"
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
                        : 'Finished with no handling'}
                  </small>
                </button>
              )) : <p className="lane-column-empty">Nobody here yet.</p>}
            </div>
          ))}
        </div>
        {waiting.length ? (
          <p className="muted-copy">
            {waiting.length} case{waiting.length === 1 ? '' : 's'} not sorted yet — we are still waiting
            to hear back.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <PanelHeading title="Why this matters" detail="Where the people go" />
        <p className="muted-copy">
          Green finishes on its own. Amber gets one specific question, not a reminder letter.
          Only red needs somebody to pick up the phone. That is the whole point: we are not trying
          to automate everything, we are trying to make sure people only touch the cases that need them.
        </p>
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
            <th>Owner</th>
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
              <td>{item.owner}</td>
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
function AdviceWorkspace({
  selectedCase, busy, error, onAcceptLead, onBookAppointment, onRecordAdvice, onPreviewCustomer,
}) {
  const policyState = usePolicyDetails(selectedCase.policy)
  const pot = mockPotValue(selectedCase.policy)
  // Pre-filled so the presenter only has to click.
  const [recommended, setRecommended] = useState(selectedCase.maturityOption || 'ANNUITY')
  const [rationale, setRationale] = useState(DEFAULT_RATIONALE)
  const [channel, setChannel] = useState(adviceChannels[0])
  // Captured once so the countdown stays stable across re-renders.
  const [openedAt] = useState(() => Date.now())

  const advice = selectedCase.adviceRecord
  const leadAccepted = Boolean(selectedCase.leadAcceptedAt)
  const appointmentBooked = Boolean(selectedCase.appointmentAt)
  const adviceDone = Boolean(advice)
  const status = selectedCase.backendStatus
  const awaitingAdvice = [
    'CLE_OWNER_DETECTED', 'NON_CLE_OWNER_DETECTED',
    'MATURITY_PACKAGE_SENT', 'ADVICE_REQUESTED', 'APPOINTMENT_BOOKED',
  ].includes(status)
  const monthsToMaturity = policyState.data?.maturityDate
    ? Math.max(0, Math.round(
      (new Date(`${policyState.data.maturityDate}T12:00:00`).getTime() - openedAt) / (86400000 * 30.44),
    ))
    : null

  const advisor = selectedCase.ownerType === 'NON_CLE' ? 'Meridian Financial' : 'In-House Sales'

  const handleRecordAdvice = () => {
    if (!recommended) return
    onRecordAdvice({ recommendedOption: recommended, rationale, advisor, channel })
  }

  return (
    <section className="advice-workspace" aria-label="Advice workspace">
      <header className="advice-workspace-head">
        <div>
          <p className="eyebrow">{advisor.toUpperCase()}</p>
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
        <PanelHeading title="What you need to know" detail="Pulled together for you — nothing to chase" />
        <div className="snapshot-row">
          <div className="snapshot-pot">
            <span>Her pot</span>
            <strong>{formatEuro(pot)}</strong>
            <small>Illustrative demo value.</small>
          </div>
          <div className="lead-fields">
            <div>
              <span>She is leaning towards</span>
              <strong>
                {selectedCase.customerPreference
                  ? maturityOptionLabels[selectedCase.customerPreference]
                  : 'Not said yet'}
              </strong>
            </div>
            <div><span>Maturity date</span><strong>{policyState.data?.maturityDate || '—'}</strong></div>
            <div>
              <span>Still outstanding</span>
              <strong>
                {selectedCase.outstandingDocuments.length
                  ? selectedCase.outstandingDocuments.map((d) => documentLabels[d] || d).join(', ')
                  : 'Nothing'}
              </strong>
            </div>
          </div>
        </div>
        <div className="lead-actions">
          {leadAccepted ? (
            <span className="lead-accepted">✓ Lead accepted</span>
          ) : (
            <button className="button button-primary" type="button" disabled={busy} onClick={() => onAcceptLead(advisor)}>
              {busy ? 'Working…' : 'Accept lead'}
            </button>
          )}
          {appointmentBooked ? (
            <span className="lead-accepted">✓ Appointment {formatEventDate(selectedCase.appointmentAt)}</span>
          ) : (
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => onBookAppointment({
                appointmentAt: new Date(Date.now() + 3 * 86400000).toISOString(),
                advisor,
                channel,
              })}
            >
              {busy ? 'Working…' : 'Book appointment'}
            </button>
          )}
          <button className="text-button" type="button" onClick={() => onPreviewCustomer(selectedCase.id)}>
            See her screen
          </button>
        </div>
      </section>

      <section className="panel option-comparison">
        <PanelHeading title="Her options, side by side" detail="The same figures she sees" />
        <div className="comparison-grid">
          {['ANNUITY', 'LUMP_SUM', 'REINVEST'].map((option) => {
            const info = optionInformation[option]
            const headline = option === 'ANNUITY'
              ? `${formatEuro(pot * 0.04 / 12)} – ${formatEuro(pot * 0.06 / 12)} / month`
              : option === 'LUMP_SUM'
                ? formatEuro(pot)
                : `${formatEuro(projectedValue(pot, 0.04, 10))} after 10 years`
            const isPreference = selectedCase.customerPreference === option
            const isRecommended = recommended === option
            return (
              <button
                key={option}
                type="button"
                className={`comparison-card${isRecommended ? ' comparison-selected' : ''}`}
                aria-pressed={isRecommended}
                disabled={!awaitingAdvice || busy}
                onClick={() => setRecommended(option)}
              >
                <span className="comparison-head">
                  <strong>{maturityOptionLabels[option]}</strong>
                  {isPreference ? <em className="comparison-flag">Her steer</em> : null}
                </span>
                <span className="comparison-headline">{headline}</span>
                <span className="comparison-detail">{info.heading}</span>
              </button>
            )
          })}
        </div>
      </section>

      {adviceDone ? (
        <section className="panel advice-recorded">
          <PanelHeading title="Advice recorded" detail="Saved against her case as the reason for the option" />
          <div className="advice-recorded-head">
            <StatusPill tone="green">{maturityOptionLabels[advice.recommendedOption] || advice.recommendedOption}</StatusPill>
            <span>{advice.advisedBy} · {advice.channel}</span>
          </div>
          <p>{advice.rationale}</p>
        </section>
      ) : awaitingAdvice ? (
        <section className="panel advice-form">
          <PanelHeading
            title="Record your advice"
            detail="Sets her option and starts the paperwork"
          />
          <div className="advice-form-grid">
            <label>
              Option advised
              <select value={recommended} onChange={(event) => setRecommended(event.target.value)}>
                {['ANNUITY', 'LUMP_SUM', 'REINVEST'].map((option) => (
                  <option value={option} key={option}>{maturityOptionLabels[option]}</option>
                ))}
              </select>
            </label>
            <label>
              Advice given by
              <select value={channel} onChange={(event) => setChannel(event.target.value)}>
                {adviceChannels.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label className="advice-rationale-field">
            Why this option
            <textarea
              rows={3}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
            />
          </label>
          <div className="advice-form-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={busy || !recommended}
              onClick={handleRecordAdvice}
            >
              {busy ? 'Recording…' : 'Record advice'}
            </button>
          </div>
          <p className="backend-disclaimer">
            Demo only. Production would need a suitability assessment and her documented authority
            before anything binding is recorded.
          </p>
        </section>
      ) : null}
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
  onBookAppointment,
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
          <button className="top-nav-link" onClick={() => onNotify('You are up to date. Notifications are demo-only.')}>Notifications</button>
          <span className="user-name">Demo access</span>
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
              onBookAppointment={onBookAppointment}
              onRecordAdvice={onRecordAdvice}
              onPreviewCustomer={onPreviewCustomer}
              onNotify={onNotify}
            />
            <BackendCaseDetail
              selectedCase={selectedCase}
              actionBusy={actionBusy}
              actionError={actionError}
              onRequestInformation={onRequestInformation}
              onPreviewCustomer={onPreviewCustomer}
            />
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
                <p className="eyebrow">BROKER WORKSPACE · LIVE API</p>
                <h1>Your client queue</h1>
                <p className="muted-copy">A clear view of case status and the next available step.</p>
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
                  <span>{visibleCases.length} of {cases.length} live cases</span>
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
                  <button className="button button-primary" type="button" onClick={() => {
                    onSelectCase(item.id)
                    onSelectPage('case')
                  }}>{caseActionLabel(item.backendStatus)}</button>
                </article>
              )) : (
                <EmptyState title="No matching cases" detail="Try another status filter or search term." />
              )}
              <p className="prototype-note">
                The API does not filter cases by broker ownership. This demo queue may include cases that would not belong to a signed-in broker.
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
  onPreviewCustomer,
}) {
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)
  const policyState = usePolicyDetails(selectedCase.policy)
  const fields = [
    ['Case ID', selectedCase.id],
    ['Case status', selectedCase.backendStatus],
    ['Policy ID', selectedCase.policy],
    ['Owner', selectedCase.owner],
    ['Owner type', selectedCase.ownerType],
    ['Routing email', selectedCase.email],
    ['Maturity option', selectedCase.maturityOption
      ? maturityOptionLabels[selectedCase.maturityOption] || selectedCase.maturityOption
      : 'Not selected'],
    ['Documents recorded', selectedCase.uploadedDocuments.length
      ? selectedCase.uploadedDocuments.map((document) => documentLabels[document] || document).join(', ')
      : 'None'],
    ['SLA', selectedCase.sla],
    ['Created', selectedCase.createdAt],
    ['Last updated', selectedCase.updatedAt],
  ]

  return (
    <div className="case-detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">CASE RECORD · LIVE API</p>
          <h1>{selectedCase.customer}</h1>
          <p className="muted-copy">{selectedCase.policy} · Case ID {selectedCase.id}</p>
        </div>
        <StatusPill tone={statusTone(selectedCase.status)}>{selectedCase.status}</StatusPill>
      </header>
      <CaseStatusSummary status={selectedCase.backendStatus} />
      <ProcessingLaneBanner
        lane={selectedCase.processingLane}
        exceptionReason={selectedCase.exceptionReason}
        outstanding={selectedCase.outstandingDocuments}
      />
      <CaseProgressTrail status={selectedCase.backendStatus} />
      <div className="detail-grid backend-detail-grid">
        <section className="panel">
          <PanelHeading title="Case overview" detail="Backend case and linked policy information" />
          <div className="case-agent-summary">
            <strong>What the agent found</strong>
            <p>{selectedCase.detail}</p>
          </div>
          <div className="backend-case-fields">
            {fields.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
            {policyState.status === 'success' && policyState.data ? (
              <>
                <div><span>Partner ID</span><strong>{policyState.data.partnerId || 'Not provided'}</strong></div>
                <div><span>Risk commencement</span><strong>{policyState.data.riskCommencementDate || 'Not provided'}</strong></div>
                <div><span>Maturity date</span><strong>{policyState.data.maturityDate || 'Not provided'}</strong></div>
              </>
            ) : null}
          </div>
          {policyState.status === 'loading' ? <p className="inline-state">Loading linked policy details…</p> : null}
          {policyState.status === 'error' ? <p className="backend-exception-note" role="alert">Could not load linked policy details: {policyState.error}</p> : null}
        </section>
        <section className="panel backend-limit-panel">
          <PanelHeading title="Case workflow" />
          <p>{selectedCase.detail}</p>
          <p>
            Document entries from the backend identify document types only. No file contents are available in this case record.
          </p>
          {caseSignal(selectedCase.backendStatus) === 'red' ? (
            <p className="backend-exception-note">
              {selectedCase.backendStatus === 'ON_HOLD'
                ? 'This case is on hold. The demo API does not provide an exception-resolution action.'
                : 'This case is cancelled. The demo API does not provide a reopen action.'}
            </p>
          ) : selectedCase.backendStatus !== 'AWAITING_CUSTOMER'
            && selectedCase.backendStatus !== 'COMPLETED'
            && selectedCase.backendStatus !== 'CANCELLED' ? (
              <div className="backend-action">
                <button
                  className="button button-primary"
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onRequestInformation(selectedCase)}
                >
                  {actionBusy ? 'Updating case…' : 'Request information'}
                </button>
                <p>This updates the case to AWAITING_CUSTOMER; it does not send a message. The endpoint does not filter cases by staff ownership.</p>
                {actionError ? <p className="workflow-message workflow-error" role="alert">{actionError}</p> : null}
              </div>
            ) : null}
          {selectedCase.backendStatus === 'AWAITING_CUSTOMER' ? (
            <p className="backend-action-note">This case is already marked as awaiting the customer. Use the email preview to review suggested contact content.</p>
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
            <button
              className="button button-secondary"
              type="button"
              disabled={!policyState.data || policyState.status !== 'success'}
              onClick={() => setEmailPreviewOpen(true)}
            >
              Preview annual statement
            </button>
            <button className="text-button" type="button" onClick={() => onPreviewCustomer(selectedCase.id)}>
              Open customer journey
            </button>
          </div>
        </section>
      </div>
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
        detail="Demo-only notes for this browser session; nothing is sent or saved to the backend."
      />
      <form className="contact-note-form" onSubmit={handleSubmit}>
        <label htmlFor={`contact-note-${caseId}`}>Record a call or follow-up note</label>
        <textarea
          id={`contact-note-${caseId}`}
          value={value}
          maxLength={400}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add a short demo note..."
          required
        />
        <button className="button button-secondary" type="submit" disabled={!value.trim()}>Add session note</button>
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
      ) : <p className="empty-note">No contact notes recorded in this session.</p>}
    </section>
  )
}

/**
 * Shows which straight-through-processing lane the case landed in, and why.
 */
function ProcessingLaneBanner({ lane, exceptionReason, outstanding = [] }) {
  const meta = laneMeta[lane]

  return (
    <section className={`lane-banner lane-banner-${meta ? meta.tone : 'neutral'}`} aria-label="Processing lane">
      <LanePill lane={lane} />
      <div className="lane-banner-copy">
        <strong>
          {meta ? meta.detail : 'The lane is decided once the customer responds. Nothing to validate yet.'}
        </strong>
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

function CaseProgressTrail({ status }) {
  const currentStep = {
    NEW: 0,
    MATURITY_DETECTED: 0,
    CLE_OWNER_DETECTED: 1,
    NON_CLE_OWNER_DETECTED: 1,
    MATURITY_PACKAGE_SENT: 2,
    ADVICE_REQUESTED: 3,
    APPOINTMENT_BOOKED: 3,
    AWAITING_CUSTOMER: 3,
    AWAITING_INFORMATION: 3,
    IN_PROGRESS: 3,
    ON_HOLD: 3,
    CANCELLED: 3,
    // Past the final index so every stage renders as done for a completed case.
    COMPLETED: 5,
  }[status] ?? 0
  const stages = ['Case raised', 'Owner identified', 'Statement prepared', 'Customer journey', 'Documents complete']

  return (
    <section className="case-progress-panel" aria-label="Case journey stage">
      <p className="eyebrow">CASE JOURNEY</p>
      <ol>
        {stages.map((stage, index) => (
          <li className={index < currentStep ? 'stage-done' : index === currentStep ? 'stage-current' : ''} key={stage}>
            <span aria-hidden="true">{index < currentStep ? '✓' : index + 1}</span>
            <strong>{stage}</strong>
          </li>
        ))}
      </ol>
      <small>Stage is inferred from the current API status; historical transition timestamps are not available.</small>
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
        <div className="valuation-status"><span className="signal-dot" />Mock demonstration value</div>
        <strong className="pension-pot-value">{formatEuro(potValue)}</strong>
        <p className="muted-copy">
          Synthetic sample only; this amount is not returned by the backend or a real pension valuation.
        </p>
        <div className="pension-overview-details">
          <div><span>Policy</span><strong>{policy}</strong></div>
          <div><span>Case status</span><strong>{caseStatus}</strong></div>
          <div><span>Your next step</span><strong>{selectedOption ? `${outstandingCount} ${outstandingCount === 1 ? 'document' : 'documents'} outstanding` : 'Talk to your advisor'}</strong></div>
        </div>
      </div>
      <div className="pension-illustration-wrap">
        <PensionPotVisual />
        <span>Illustrative graphic · not to scale</span>
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

const mockPotValues = {
  'CLE-END2END-20261006': 248000,
  'MOCK-STATUS-NEW-20261006': 125000,
  'MOCK-STATUS-MATURITY_DETECTED-20261006': 187500,
  'MOCK-STATUS-CLE_OWNER_DETECTED-20261006': 221000,
  'MOCK-STATUS-NON_CLE_OWNER_DETECTED-20261006': 164000,
  'MOCK-STATUS-AWAITING_INFORMATION-20261006': 203500,
  'MOCK-STATUS-IN_PROGRESS-20261006': 145000,
  'MOCK-STATUS-AWAITING_CUSTOMER-20261006': 178250,
  'MOCK-STATUS-ON_HOLD-20261006': 196000,
  'MOCK-STATUS-COMPLETED-20261006': 232000,
  'MOCK-STATUS-CANCELLED-20261006': 112500,
}

const optionInformation = {
  ANNUITY: {
    heading: 'Turn some or all of your pot into regular income',
    detail: 'An annuity can provide a regular income for life. The amount and terms depend on provider rates and personal choices, which are not modelled in this demo.',
    tradeoff: 'A more predictable income may mean less access to the money used to buy it.',
    illustration: 'income',
  },
  LUMP_SUM: {
    heading: 'Take your pension pot as cash',
    detail: 'A lump sum gives you access to the full mock pot in one go. You decide how to use and manage it.',
    tradeoff: 'Tax, sustainability and future income are not calculated in this demo.',
    illustration: 'cash',
  },
  REINVEST: {
    heading: 'Keep your pot invested',
    detail: 'Your investments remain exposed to markets, so their value may rise or fall over time.',
    tradeoff: 'Illustrations are not guaranteed; no fees, tax, inflation or additional contributions are modelled.',
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
function OptionReview({ option, pot, preference, busy, onBack, onRequestAdvice }) {
  const information = optionInformation[option]
  const isPreferred = preference === option
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
      <button className="text-button option-back" type="button" onClick={onBack}>← Back to all options</button>
      <div className="option-review-heading">
        <div className={`option-art option-art-${information.illustration}`}><OptionIllustration kind={information.illustration} /></div>
        <div>
          <p className="eyebrow">OPTION INFORMATION · DEMO ILLUSTRATION</p>
          <h4 id="option-review-heading">{maturityOptionLabels[option]}</h4>
          <strong>{information.heading}</strong>
        </div>
      </div>
      <p className="option-explanation">{information.detail}</p>
      <div className="option-projection">
        <div className="projection-pot"><span>Your sample pot</span><strong>{formatEuro(pot)}</strong></div>
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
            ? 'Hypothetical conversion range of 4–6% of the mock pot per year, divided monthly. Not a quote or guaranteed income.'
            : option === 'LUMP_SUM'
              ? 'Illustrative gross amount before any tax or deductions; no tax calculation is included.'
              : 'Illustrative compound-growth scenarios after maturity, assuming no contributions, fees, tax or inflation.'}
        </small>
      </div>
      <p className="option-tradeoff"><strong>Things to consider:</strong> {information.tradeoff}</p>
      <p className="backend-disclaimer">
        This is information only, not a recommendation. Your advisor will talk the options through with you
        and record your option with you.
      </p>
      <div className="option-review-actions">
        <button className="button button-secondary" type="button" onClick={onBack}>Compare other options</button>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || isPreferred}
          onClick={() => onRequestAdvice(option)}
        >
          {isPreferred
            ? 'Shared with your advisor'
            : busy ? 'Sending…' : 'Discuss this with my advisor'}
        </button>
      </div>
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
              ? `Recorded with you by ${advice.advisedBy}${advice.channel && advice.channel !== 'Not recorded' ? ` by ${advice.channel}` : ''}.`
              : 'Recorded by your advisor.'}
          </small>
        </div>
      </div>
      {advice?.rationale ? (
        <div className="advice-rationale">
          <p className="eyebrow">WHY THIS OPTION</p>
          <p>{advice.rationale}</p>
          {preference && preference !== option ? (
            <small>
              You were leaning towards {maturityOptionLabels[preference]} before your advice conversation.
            </small>
          ) : null}
        </div>
      ) : null}
      <p className="backend-disclaimer">
        Demo only. A production journey would also capture a suitability assessment and your documented
        authority to proceed before anything binding is recorded.
      </p>
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

function AnnualStatementPreview({ selectedCase, policy, onClose, onOpenPortal }) {
  const { maturityDate, statementDate, monthsBeforeMaturity } = annualStatementTiming(policy)
  const dateFormat = new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
  const pot = mockPotValue(selectedCase.policy)
  const maturityProjection = [
    ['Lower illustration · 2%', projectedValue(pot, 0.02, 1)],
    ['Mid illustration · 4%', projectedValue(pot, 0.04, 1)],
    ['Higher illustration · 6%', projectedValue(pot, 0.06, 1)],
  ]

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card annual-statement-modal" role="dialog" aria-modal="true" aria-labelledby="annual-statement-title">
        <button className="modal-close" type="button" aria-label="Close email preview" onClick={onClose}>×</button>
        <p className="eyebrow">DEMO ONLY · NOT SENT</p>
        <h2 id="annual-statement-title">Annual pension statement</h2>
        <div className="email-headers">
          <p><span>To</span><strong>{policy.partnerId ? `Partner ${policy.partnerId}` : 'Demo recipient'} (demo recipient)</strong></p>
          <p><span>Subject</span><strong>Your annual pension statement — {selectedCase.policy}</strong></p>
          <p>
            <span>Statement date</span>
            <strong>{dateFormat.format(statementDate)} · T-{monthsBeforeMaturity} months</strong>
          </p>
        </div>
        <div className="email-body">
          <p>Dear Customer,</p>
          <p>Your policy is approaching its planned maturity date of {dateFormat.format(maturityDate)}. Here is a snapshot to help you start thinking about your next steps.</p>
          <p className="statement-timing-note">
            This statement falls on your policy anniversary, which is T-{monthsBeforeMaturity} months for this
            contract. Because maturity is {dateFormat.format(maturityDate)}, the platform enriched this
            statement with maturity information instead of sending a separate mailing.
          </p>
          <div className="statement-value">
            <span>Illustrative fund value at T-{monthsBeforeMaturity}</span>
            <strong>{formatEuro(pot)}</strong>
            <small>Synthetic demo amount only · not provided by your pension provider</small>
          </div>
          <strong>Illustrative value at planned maturity</strong>
          <div className="statement-projections">
            {maturityProjection.map(([label, value]) => <div key={label}><span>{label}</span><strong>{formatEuro(value)}</strong></div>)}
          </div>
          <p>These scenarios use hypothetical annual growth rates for one year and do not include contributions, fees, tax or inflation. They are not a forecast, guarantee or financial advice.</p>
          <p>When you are ready, visit the customer portal to review the available retirement options and follow your case.</p>
          {onOpenPortal ? (
            <button className="button button-primary" type="button" onClick={onOpenPortal}>Preview the customer portal</button>
          ) : (
            <button className="button button-primary" type="button" onClick={onClose}>Review my options</button>
          )}
        </div>
        <p className="email-preview-note">This is a UI preview only. The backend does not send this annual statement or provide the mock valuation.</p>
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
  onClearFocus,
  onSelectCase,
  onRetryCases,
  onRetryJourney,
  onRequestAdvice,
  onSubmitDocument,
}) {
  const [selectedFileNames, setSelectedFileNames] = useState({})
  const [optionReview, setOptionReview] = useState(null)
  const [statementRequested, setStatementRequested] = useState(false)
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
  // The guided demo opens the customer journey on the annual statement.
  const statementOpen = statementReady && (statementRequested || focus === 'annual-statement')

  const closeStatement = () => {
    setStatementRequested(false)
    onClearFocus?.()
  }

  return (
    <div className="customer-page">
      <header className="customer-header">
        <Brand subline="Retirement Hub" />
        <div className="customer-header-right">
          <span>Help and support</span>
          <span className="avatar">D</span>
        </div>
      </header>
      <main className="customer-main">
        <div className="customer-welcome">
          <p className="eyebrow">YOUR RETIREMENT JOURNEY · LIVE API</p>
          <h1>Your retirement case</h1>
          <p className="muted-copy">Journey information and choices are read from and submitted to the Java case service.</p>
        </div>
        {casesLoading ? (
          <section className="panel connection-state" role="status">
            <div className="loading-indicator" aria-hidden="true" />
            <strong>Loading cases from the backend…</strong>
          </section>
        ) : casesError ? (
          <section className="panel connection-state connection-error" role="alert">
            <div><strong>Could not load cases</strong><p>{casesError}</p></div>
            <button className="button button-primary" type="button" onClick={onRetryCases}>Retry</button>
          </section>
        ) : cases.length === 0 ? (
          <section className="panel connection-state">
            <EmptyState title="No cases available" detail="Create a case through the live maturity workflow before opening the customer view." />
          </section>
        ) : selectedCase ? (
          <>
            <section className="panel live-case-selector">
              <label htmlFor="customer-case">Demo case</label>
              <div className="customer-case-select-row">
                <select id="customer-case" value={selectedCase.id} onChange={(event) => {
                  setSelectedFileNames({})
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
                  Refresh journey
                </button>
              </div>
              <p>Authentication and customer-to-case access control are not implemented; choose a case for this demonstration.</p>
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
                    <p className="eyebrow">
                      {statementTiming
                        ? `T-${statementTiming.monthsBeforeMaturity} MONTHS · ANNUAL STATEMENT`
                        : 'ANNUAL STATEMENT'}
                    </p>
                    <h2>Your yearly pension statement</h2>
                    <p className="muted-copy">
                      Sent on your policy anniversary. Because maturity is coming up, it includes your
                      illustrative value and what it could be worth at your planned maturity date.
                    </p>
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!statementReady}
                    onClick={() => setStatementRequested(true)}
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
                      <p className="eyebrow">CASE {retirementCase.caseId}</p>
                      <h2>{retirementCase.caseName || selectedCase.customer}</h2>
                      <p className="muted-copy">Policy {retirementCase.policyId || selectedCase.policy} · Status: {caseStatus}</p>
                    </div>
                    <StatusPill tone={statusTone(caseStatus || '')}>{caseStatus}</StatusPill>
                  </header>
                  {journey.message ? <p className="journey-message">{journey.message}</p> : null}
                  {caseStatus === 'MATURITY_PACKAGE_SENT' ? (
                    <p className="backend-disclaimer">
                      Backend stage only: the service generates an email body and recipient but does not deliver an email.
                    </p>
                  ) : null}
                  {journeyState.actionError ? <p className="workflow-message workflow-error" role="alert">{journeyState.actionError}</p> : null}

                  <section className="live-journey-section">
                    <p className="eyebrow">YOUR MATURITY OPTION</p>
                    <h3>
                      {optionReview
                        ? 'Take a closer look'
                        : selectedOption ? 'Your advised option' : 'Explore your options'}
                    </h3>
                    {optionReview ? (
                      <OptionReview
                        option={optionReview}
                        pot={potValue}
                        preference={customerPreference}
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
                          Compare the options and their sample figures. Your advisor talks these through with
                          you and records your option with you — nothing is selected from this screen.
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
                                <small>See sample figures and trade-offs →</small>
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

                  {selectedOption && !optionReview ? <section className="live-journey-section">
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
                                  <label>
                                    Choose file name
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={(event) => setSelectedFileNames((current) => ({
                                        ...current,
                                        [document]: event.target.files?.[0]?.name || '',
                                      }))}
                                    />
                                  </label>
                                  <button
                                    className="button button-secondary"
                                    type="button"
                                    disabled={journeyState.actionBusy || !selectedFileNames[document]}
                                    onClick={() => onSubmitDocument(document, selectedFileNames[document])}
                                  >
                                    {journeyState.actionBusy ? 'Recording…' : 'Record document'}
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
                      <p className="muted-copy">The backend has not returned document requirements yet. Choose a maturity option first if available.</p>
                    )}
                    <p className="backend-disclaimer">
                      Important: this demo sends the document type and selected filename only. The backend records the type and ignores the filename; file contents are never uploaded, transferred, stored, or reviewed.
                    </p>
                  </section> : null}
                  {caseStatus === 'COMPLETED' ? (
                    <div className="customer-complete-message" role="status">
                      <strong>Backend journey marked complete</strong>
                      <p>All required document types have been recorded by the service.</p>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}
          </>
        ) : null}
        <p className="customer-privacy">
          <strong>Demo notice:</strong> This screen is connected to the demo backend and is not an authenticated customer portal. The backend uses in-memory data and does not process actual uploaded files or deliver email.
        </p>
      </main>
      {statementOpen && selectedCase && policyState.data ? (
        <AnnualStatementPreview
          selectedCase={selectedCase}
          policy={policyState.data}
          onClose={closeStatement}
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
    NEW: 'Start the case assessment.',
    MATURITY_DETECTED: 'Confirm ownership and begin the maturity review.',
    CLE_OWNER_DETECTED: 'Review the maturity package status. The demo does not send email.',
    NON_CLE_OWNER_DETECTED: 'Review the non-CLE routing details.',
    MATURITY_PACKAGE_SENT: 'Customer is reviewing their options before advice.',
    ADVICE_REQUESTED: 'Accept the lead and book the advice conversation.',
    APPOINTMENT_BOOKED: 'Give the advice and record the option with the client.',
    AWAITING_INFORMATION: 'Review the information still needed from the customer.',
    AWAITING_CUSTOMER: 'Follow up on the customer’s next step.',
    IN_PROGRESS: 'Continue the case workflow.',
    ON_HOLD: 'Review the hold reason and decide the next action.',
    CANCELLED: 'Review the cancellation details.',
    COMPLETED: 'No action required — the journey is complete.',
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
      ? 'Waiting on a next step'
      : signal === 'green'
        ? 'Journey completed'
        : 'Active operational stage'
  return (
    <section className={`case-status-summary summary-${signal}`}>
      <span className="signal-dot" aria-hidden="true" />
      <div><strong>{heading}</strong><p>{caseNextAction(status)}</p></div>
      <StatusPill tone={signal}>{status}</StatusPill>
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

export default App
