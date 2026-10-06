import { useEffect, useState } from 'react'
import {
  assessPolicyMaturity,
  createPolicy,
  detectCaseOwners,
  fetchCases,
  fetchCaseJourney,
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
    } catch (error) {
      setJourneyState((current) => ({
        ...current,
        requestKey: `${selectedCase.id}:${journeyReload}`,
        actionBusy: false,
        actionError: error instanceof Error ? error.message : 'The journey update failed.',
      }))
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
}) {
  if (selectedPage === 'case' && selectedCase) {
    return (
      <div className="staff-layout">
        <aside className="sidebar">
          <Brand subline="Retirement Hub" />
          <SidebarLink active onClick={onBack}>Case queue</SidebarLink>
          <SidebarLink onClick={onBack}>All cases</SidebarLink>
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
          />
        </main>
      </div>
    )
  }

  const showingAll = selectedPage === 'all'
  const awaitingCustomer = cases.filter((item) => item.backendStatus === 'AWAITING_CUSTOMER').length
  const onHold = cases.filter((item) => item.backendStatus === 'ON_HOLD').length
  return (
    <div className="staff-layout">
      <aside className="sidebar">
        <Brand subline="Retirement Hub" />
        <SidebarLink active={selectedPage === 'queue'} onClick={() => onSelectPage('queue')}>Case queue</SidebarLink>
        <SidebarLink active={showingAll} onClick={() => onSelectPage('all')}>All cases</SidebarLink>
        <SidebarLink onClick={() => onNotify('Agent activity is illustrative in this prototype.')}>Agent activity</SidebarLink>
        <SidebarLink onClick={() => onNotify('Rules and limits are illustrative in this prototype.')}>Rules and limits</SidebarLink>
        <div className="sidebar-footer">Signed in as case worker<br /><span>Demo access only</span></div>
      </aside>
      <main className="staff-main">
        <header className="page-heading">
          <div>
            <p className="eyebrow">MATURITY OPERATIONS</p>
            <h1>{showingAll ? 'All cases' : 'Case queue'}</h1>
            <p className="muted-copy">
              {showingAll
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
            {!showingAll ? (
              <LivePolicyWorkflow
                busy={workflowBusy}
                result={workflowResult}
                onSubmit={onRunJourney}
              />
            ) : null}
            <div className="metric-grid">
              <Metric label="Cases returned" value={cases.length} />
              <Metric label="Awaiting customer" value={awaitingCustomer} />
              <Metric label="On hold" value={onHold} />
            </div>
            <section className="panel">
              <PanelHeading
                title={showingAll ? 'All cases' : 'Case queue'}
                detail={`${cases.length} case${cases.length === 1 ? '' : 's'} returned by API`}
                action={<button className="text-button" type="button" onClick={onRetry}>Refresh</button>}
              />
              {cases.length ? (
                <BackendCasesTable cases={cases} onOpen={onSelectCase} />
              ) : (
                <EmptyState title="No cases returned" detail="The case service returned an empty list." />
              )}
            </section>
            <p className="prototype-note">
              <strong>Integration scope:</strong> policy creation, maturity assessment, owner detection, case status, customer option choice and document-type recording use live APIs. The backend does not provide access control, file transfer or email delivery.
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
    <section className="panel live-workflow-panel">
      <PanelHeading
        title="Run a live maturity journey"
        detail="Create a policy, assess maturity, and classify its CLE/non-CLE owner."
      />
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
    </section>
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
            <th>Status</th>
            <th><span className="visually-hidden">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.customer}</strong><small>{item.id}</small></td>
              <td>{item.policy}</td>
              <td>{item.owner}</td>
              <td>{item.sla}</td>
              <td><StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill></td>
              <td>
                <button className="text-button table-action" type="button" onClick={() => onOpen(item)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SidebarLink({ active = false, children, onClick }) {
  return (
    <button className={active ? 'sidebar-link selected' : 'sidebar-link'} type="button" onClick={onClick}>
      {children}
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

function BrokerCasesView({ cases, selectedCase, loading, error, onRetry, onSelectCase, onNotify }) {
  const [showDetail, setShowDetail] = useState(false)
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
              readOnly
            />
          </>
        ) : (
          <>
            <header className="page-heading broker-heading">
              <div>
                <p className="eyebrow">BROKER WORKSPACE · LIVE API</p>
                <h1>Retirement cases</h1>
                <p className="muted-copy">Cases currently returned by the Java service.</p>
              </div>
              <button className="button button-secondary" type="button" onClick={onRetry}>Refresh</button>
            </header>
            <section className="panel client-list-panel">
              <div className="client-list-heading">
                <h2>Cases</h2>
                <span>{cases.length} live records</span>
              </div>
              {loading ? (
                <div className="connection-state" role="status"><div className="loading-indicator" aria-hidden="true" /><strong>Loading cases…</strong></div>
              ) : error ? (
                <div className="connection-state connection-error" role="alert">
                  <p>{error}</p><button className="button button-primary" type="button" onClick={onRetry}>Retry</button>
                </div>
              ) : cases.length ? cases.map((item) => (
                <article className="client-row" key={item.id}>
                  <div className="client-main">
                    <div className="client-name-line">
                      <strong>{item.customer}</strong>
                      <span className="subtle">{item.policy} · Case {item.id}</span>
                    </div>
                    <p>{item.detail}</p>
                  </div>
                  <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
                  <button className="button button-primary" type="button" onClick={() => {
                    onSelectCase(item.id)
                    setShowDetail(true)
                  }}>Open</button>
                </article>
              )) : (
                <EmptyState title="No cases returned" detail="The case service returned an empty list." />
              )}
              <p className="prototype-note">
                The backend does not provide authentication or broker ownership filtering. This demo list may include cases that would not belong to a signed-in broker.
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
  readOnly = false,
}) {
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
      <div className="detail-grid backend-detail-grid">
        <section className="panel">
          <PanelHeading title="Case information" detail="Values shown exactly as returned by the case service" />
          <div className="backend-case-fields">
            {fields.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        </section>
        <section className="panel backend-limit-panel">
          <PanelHeading title={readOnly ? 'Read-only record' : 'Case workflow'} />
          <p>{selectedCase.detail}</p>
          <p>
            Document entries from the backend identify document types only. No file contents are available in this case record.
          </p>
          {!readOnly && selectedCase.backendStatus !== 'AWAITING_CUSTOMER'
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
        </section>
      </div>
    </div>
  )
}

function JourneyProgress({ status }) {
  const progressByStatus = {
    MATURITY_DETECTED: 0,
    CLE_OWNER_DETECTED: 1,
    NON_CLE_OWNER_DETECTED: 1,
    MATURITY_PACKAGE_SENT: 2,
    AWAITING_INFORMATION: 3,
    AWAITING_CUSTOMER: 3,
    COMPLETED: 4,
  }
  const activeStep = progressByStatus[status] ?? 0
  const steps = ['Case detected', 'Owner checked', 'Package prepared', 'Customer response', 'Complete']
  return (
    <div className="journey-progress" aria-label="Retirement journey progress">
      {steps.map((step, index) => (
        <div className={`journey-step ${index <= activeStep ? 'step-active' : ''}`} key={step}>
          <span>{index < activeStep ? '✓' : index + 1}</span>
          <div><strong>{step}</strong><small>{index === activeStep ? 'Current stage' : ''}</small></div>
        </div>
      ))}
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
  const journey = journeyState.data
  const retirementCase = journey?.retirementCase
  const selectedOption = retirementCase?.maturityOption
  const uploadedDocuments = new Set(journey?.uploadedDocuments ?? [])
  const caseStatus = retirementCase?.caseStatus ?? selectedCase?.backendStatus
  const requiredDocuments = journey?.requiredDocuments ?? []
  const outstandingDocuments = new Set(journey?.outstandingDocuments ?? [])

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
                <JourneyProgress status={caseStatus} />
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
                    <h3>Choose one option</h3>
                    {selectedOption ? (
                      <div className="selected-option-summary">
                        <span className="confirmation-check" aria-hidden="true">✓</span>
                        <div>
                          <strong>{maturityOptionLabels[selectedOption] || selectedOption}</strong>
                          <small>Saved by the backend for this case. Only one option is recorded.</small>
                        </div>
                      </div>
                    ) : journey.availableOptions.length ? (
                      <>
                        <p className="muted-copy">Select one option to save it to this case. This demo does not provide financial advice.</p>
                        <div className="option-list">
                          {journey.availableOptions.map((option) => (
                            <button
                              className="option-card"
                              type="button"
                              key={option}
                              disabled={journeyState.actionBusy}
                              onClick={() => onSubmitOption(option)}
                            >
                              <span className="selection-control" aria-hidden="true" />
                              <span className="option-copy">
                                <strong>{maturityOptionLabels[option] || option}</strong>
                                <span>Save this single maturity option for the selected case.</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : <p className="muted-copy">No further maturity options are available for this case.</p>}
                  </section>

                  <section className="live-journey-section">
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
                  </section>
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

function statusTone(status) {
  const normalized = status.toLowerCase()
  if (normalized.includes('decision') || normalized.includes('review') || normalized.includes('cancel')) return 'red'
  if (normalized.includes('ready') || normalized.includes('received') || normalized.includes('completed')) return 'green'
  if (normalized.includes('customer') || normalized.includes('signature') || normalized.includes('hold')) return 'amber'
  return 'neutral'
}

export default App
