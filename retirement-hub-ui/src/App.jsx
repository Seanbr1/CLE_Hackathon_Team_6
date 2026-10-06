import { useEffect, useState } from 'react'
import {
  assessPolicyMaturity,
  createPolicy,
  detectCaseOwners,
  fetchCases,
  fetchCaseJourney,
  fetchPolicy,
  chooseMaturityOption,
  recordJourneyDocument,
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

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>
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
    uploadedDocuments: Array.isArray(record.uploadedDocuments) ? record.uploadedDocuments : [],
    sla: record.caseSla == null ? 'Not provided' : String(record.caseSla),
    createdAt: record.createdAt || 'Not provided',
    updatedAt: record.updatedAt || 'Not provided',
    isBackend: true,
  }
}

function App() {
  const [role, setRole] = useState('caseworker')
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [caseworkerPage, setCaseworkerPage] = useState('queue')
  const [caseLoadState, setCaseLoadState] = useState({
    status: 'loading',
    cases: [],
    error: '',
  })
  const [caseReload, setCaseReload] = useState(0)
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

  const submitMaturityOption = (option) => mutateJourney(
    (caseId) => chooseMaturityOption(caseId, option),
  )

  const submitJourneyDocument = (document, fileName) => mutateJourney(
    (caseId) => recordJourneyDocument(caseId, document, fileName),
  )

  const selectRole = (nextRole) => {
    if (nextRole !== role) {
      setCaseLoadState({ status: 'loading', cases: [], error: '' })
    }
    setRole(nextRole)
  }

  return (
    <div className={`app-shell role-${role}`}>
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
          actionBusy={caseActionBusy}
          actionError={caseActionError}
          onRequestInformation={persistCaseAction}
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
          onSelectCase={(id) => setSelectedCaseId(id)}
          onRetryCases={reloadCases}
          onRetryJourney={() => setJourneyReload((count) => count + 1)}
          onSubmitOption={submitMaturityOption}
          onSubmitDocument={submitJourneyDocument}
          onNotify={notify}
        />
      ) : null}

      <RoleSwitcher role={role} onChange={selectRole} />
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}

function RoleSwitcher({ role, onChange }) {
  return (
    <div className="role-switcher" aria-label="Demo role selector">
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
            onPreviewCustomer={onPreviewCustomer}
          />
        </main>
      </div>
    )
  }

  const showingAll = selectedPage === 'all'
  const showingExceptions = selectedPage === 'exceptions'
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
        <SidebarLink onClick={() => onNotify('Agent activity is illustrative in this prototype.')}>Agent activity</SidebarLink>
        <SidebarLink onClick={() => onNotify('Rules and limits are illustrative in this prototype.')}>Rules and limits</SidebarLink>
        <div className="sidebar-footer">Signed in as case worker<br /><span>Demo access only</span></div>
      </aside>
      <main className="staff-main">
        <header className="page-heading">
          <div>
            <p className="eyebrow">MATURITY OPERATIONS</p>
            <h1>{showingExceptions ? 'Exceptions' : showingAll ? 'All cases' : 'Case queue'}</h1>
            <p className="muted-copy">
              {showingExceptions
                ? 'Cases that need intervention, grouped by their current backend status.'
                : showingAll
                ? 'Cases returned by the case service.'
                : 'Review the cases currently returned by the case service.'}
            </p>
          </div>
          <span className="demo-label live-label">LIVE API · DEMO FLOW</span>
        </header>
        {loading ? (
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
                <BackendCasesTable cases={filteredCases} onOpen={onSelectCase} />
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

function BackendCasesTable({ cases, onOpen }) {
  return (
    <div className="case-table-wrap">
      <table className="case-table backend-case-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Policy</th>
            <th>Owner</th>
            <th>SLA</th>
            <th>Case status</th>
            <th><span className="visually-hidden">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr className={`case-row-${caseSignal(item.backendStatus)}`} key={item.id}>
              <td><strong>{item.customer}</strong><small>{item.id}</small><small>{caseNextAction(item.backendStatus)}</small></td>
              <td>{item.policy}</td>
              <td>{item.owner}</td>
              <td>{item.sla}</td>
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

function BrokerCasesView({
  cases,
  selectedCase,
  loading,
  error,
  onRetry,
  onSelectCase,
  onNotify,
  actionBusy,
  actionError,
  onRequestInformation,
  onPreviewCustomer,
}) {
  const [showDetail, setShowDetail] = useState(false)
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
          <button className={!showDetail ? 'top-nav-link active' : 'top-nav-link'} onClick={() => setShowDetail(false)}>Cases</button>
          <button className="top-nav-link" onClick={() => onNotify('You are up to date. Notifications are demo-only.')}>Notifications</button>
          <span className="user-name">Demo access</span>
        </nav>
      </header>
      <main className="broker-main">
        {showDetail && selectedCase ? (
          <>
            <button className="text-button back-link" type="button" onClick={() => setShowDetail(false)}>← Back to cases</button>
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
                  { caseId: selectedCase.id, message, createdAt: new Date().toLocaleString() },
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
                    setShowDetail(true)
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
  onPreviewCustomer,
}) {
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)
  const [policyRequest, setPolicyRequest] = useState({ policyId: '', status: 'idle', data: null, error: '' })
  const hasPolicy = selectedCase.policy && selectedCase.policy !== 'Not provided'
  const policyState = !hasPolicy
    ? { status: 'success', data: null, error: '' }
    : policyRequest.policyId === selectedCase.policy
      ? policyRequest
      : { status: 'loading', data: null, error: '' }
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

  useEffect(() => {
    if (!hasPolicy) return undefined

    const controller = new AbortController()
    fetchPolicy(selectedCase.policy, { signal: controller.signal })
      .then((policy) => setPolicyRequest({
        policyId: selectedCase.policy,
        status: 'success',
        data: policy,
        error: '',
      }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setPolicyRequest({
          policyId: selectedCase.policy,
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Could not load policy details.',
        })
      })
    return () => controller.abort()
  }, [hasPolicy, selectedCase.policy])

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

function CaseProgressTrail({ status }) {
  const currentStep = {
    NEW: 0,
    MATURITY_DETECTED: 0,
    CLE_OWNER_DETECTED: 1,
    NON_CLE_OWNER_DETECTED: 1,
    MATURITY_PACKAGE_SENT: 2,
    AWAITING_CUSTOMER: 3,
    AWAITING_INFORMATION: 3,
    IN_PROGRESS: 3,
    ON_HOLD: 3,
    CANCELLED: 3,
    COMPLETED: 4,
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
          <div><span>Your next step</span><strong>{selectedOption ? `${outstandingCount} documents outstanding` : 'Choose a maturity option'}</strong></div>
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
  const steps = ['Choose an option', 'Share information', 'We complete your case']
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

function OptionReview({ option, pot, busy, onBack, onConfirm }) {
  const [acknowledged, setAcknowledged] = useState(false)
  const information = optionInformation[option]
  const range = option === 'ANNUITY'
    ? [['Lower example', pot * 0.04 / 12], ['Higher example', pot * 0.06 / 12]]
    : option === 'LUMP_SUM'
      ? [['Illustrative one-off amount', pot]]
      : [
          ['2% per year · 10 years', projectedValue(pot, 0.02, 10)],
          ['4% per year · 10 years', projectedValue(pot, 0.04, 10)],
          ['6% per year · 10 years', projectedValue(pot, 0.06, 10)],
        ]

  const handleConfirm = async () => {
    const result = await onConfirm(option)
    if (result) onBack(true)
  }

  return (
    <div className="option-review" aria-labelledby="option-review-heading">
      <button className="text-button option-back" type="button" onClick={() => onBack(false)}>← Back to all options</button>
      <div className="option-review-heading">
        <div className={`option-art option-art-${information.illustration}`}><OptionIllustration kind={information.illustration} /></div>
        <div>
          <p className="eyebrow">OPTION REVIEW · DEMO ILLUSTRATION</p>
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
      <label className="option-acknowledgement">
        <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
        <span>I understand these sample figures are synthetic, not a personalised projection or financial advice, and that confirming records my demo choice with the service.</span>
      </label>
      <div className="option-review-actions">
        <button className="button button-secondary" type="button" onClick={() => onBack(false)}>Choose a different option</button>
        <button className="button button-primary" type="button" disabled={!acknowledged || busy} onClick={handleConfirm}>
          {busy ? 'Saving choice…' : 'Confirm this demo choice'}
        </button>
      </div>
    </div>
  )
}

function AnnualStatementPreview({ selectedCase, policy, onClose, onOpenPortal }) {
  const maturityDate = new Date(`${policy.maturityDate}T12:00:00`)
  const statementDate = new Date(maturityDate)
  statementDate.setFullYear(statementDate.getFullYear() - 1)
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
          <p><span>To</span><strong>{selectedCase.customer} (demo recipient)</strong></p>
          <p><span>Subject</span><strong>Your annual pension statement — {selectedCase.policy}</strong></p>
          <p><span>Statement date</span><strong>{dateFormat.format(statementDate)} · T-12 months</strong></p>
        </div>
        <div className="email-body">
          <p>Dear {selectedCase.customer},</p>
          <p>Your policy is approaching its planned maturity date of {dateFormat.format(maturityDate)}. Here is a snapshot to help you start thinking about your next steps.</p>
          <div className="statement-value">
            <span>Illustrative fund value at T-12</span>
            <strong>{formatEuro(pot)}</strong>
            <small>Synthetic demo amount only · not provided by your pension provider</small>
          </div>
          <strong>Illustrative value at planned maturity</strong>
          <div className="statement-projections">
            {maturityProjection.map(([label, value]) => <div key={label}><span>{label}</span><strong>{formatEuro(value)}</strong></div>)}
          </div>
          <p>These scenarios use hypothetical annual growth rates for one year and do not include contributions, fees, tax or inflation. They are not a forecast, guarantee or financial advice.</p>
          <p>When you are ready, visit the customer portal to review the available retirement options and follow your case.</p>
          <button className="button button-primary" type="button" onClick={onOpenPortal}>Preview the customer portal</button>
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
  onSelectCase,
  onRetryCases,
  onRetryJourney,
  onSubmitOption,
  onSubmitDocument,
}) {
  const [selectedFileNames, setSelectedFileNames] = useState({})
  const [optionReview, setOptionReview] = useState(null)
  const journey = journeyState.data
  const retirementCase = journey?.retirementCase
  const selectedOption = retirementCase?.maturityOption
  const uploadedDocuments = new Set(journey?.uploadedDocuments ?? [])
  const caseStatus = retirementCase?.caseStatus ?? selectedCase?.backendStatus
  const requiredDocuments = journey?.requiredDocuments ?? []
  const outstandingDocuments = new Set(journey?.outstandingDocuments ?? [])
  const potValue = mockPotValue(retirementCase?.policyId || selectedCase?.policy)

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
                    <h3>{optionReview ? 'Review your choice' : selectedOption ? 'Your saved choice' : 'Explore your options'}</h3>
                    {optionReview ? (
                      <OptionReview
                        option={optionReview}
                        pot={potValue}
                        busy={journeyState.actionBusy}
                        onBack={(saved) => {
                          setOptionReview(null)
                          if (saved) setSelectedFileNames({})
                        }}
                        onConfirm={onSubmitOption}
                      />
                    ) : selectedOption ? (
                      <div className="selected-option-summary">
                        <span className="confirmation-check" aria-hidden="true">✓</span>
                        <div>
                          <strong>{maturityOptionLabels[selectedOption] || selectedOption}</strong>
                          <small>Saved by the backend for this case. Only one option is recorded.</small>
                        </div>
                        {caseStatus !== 'COMPLETED' ? (
                          <button className="text-button" type="button" onClick={() => setOptionReview(selectedOption)}>
                            Review or change
                          </button>
                        ) : null}
                      </div>
                    ) : journey.availableOptions.length ? (
                      <>
                        <p className="muted-copy">Compare the options and their synthetic examples before saving a choice. You can go back before confirming.</p>
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
                                <small>Review sample figures and trade-offs →</small>
                              </span>
                            </button>
                          ))}
                        </div>
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
                                <small className="document-prerequisite">Choose a maturity option before recording documents.</small>
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
  ].includes(normalized)) return 'amber'
  return 'neutral'
}

function caseNextAction(status) {
  const nextActions = {
    NEW: 'Start the case assessment.',
    MATURITY_DETECTED: 'Confirm ownership and begin the maturity review.',
    CLE_OWNER_DETECTED: 'Review the maturity package status. The demo does not send email.',
    NON_CLE_OWNER_DETECTED: 'Review the non-CLE routing details.',
    MATURITY_PACKAGE_SENT: 'Customer can review the maturity package.',
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
