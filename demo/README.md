# Retirement journey API

Spring Boot (Java 17) backend for the CLE proactive maturity and retirement
journey demo. It holds policies and maturity cases in memory, moves cases
through the journey with a scheduled batch job, and records an audit trail of
every automated and manual action.

All URLs are prefixed with the `/demo` context path, for example
`http://localhost:8080/demo/api/v1/cases`.

## Run and test

```powershell
.\mvnw.cmd spring-boot:run
.\mvnw.cmd test
```

Requires a Java 17 JDK on `PATH` or in `JAVA_HOME`.

On start-up the three prototype scenarios are seeded (see
`DemoDataService`):

| Case | Customer | Scenario | Lane |
|------|----------|----------|------|
| `CASE-2027-10021` | Maria Schneider | Broker happy path | Not yet classified, then GREEN |
| `CASE-2027-10044` | Thomas Weber | Direct client, one document missing | AMBER |
| `CASE-2027-10078` | Sabine Hoffmann | Advisor ownership conflict | RED |

`POST /api/v1/demo/reset` restores them at any time.

## Journey

1. **Detect.** A policy maturing within 12 months gets a case.
2. **Route.** Owner detection marks the case broker-managed or direct
   (In-House Sales).
3. **Advise.** The customer asks for advice; the advisor accepts the lead,
   books an appointment and records the agreed option with a rationale.
4. **Formalise.** Once advice is recorded, the formal maturity pack is issued.
5. **Complete.** The customer records the required documents. Complete
   responses go GREEN (straight through); missing documents go AMBER (one
   targeted request); conflicts go RED (human review).

The scheduled job (`RetirementJobScheduler`) runs maturity assessment, owner
detection and formal pack issue automatically. Its interval is set by
`retirement.batch.scheduler.fixed-delay-ms`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET/POST` | `/api/v1/policies` | List or create policies |
| `GET/PUT/DELETE` | `/api/v1/policies/{policyId}` | Read, update or delete a policy |
| `POST` | `/api/v1/policies/{policyId}/maturity-assessment` | Open a case if the policy matures within 12 months |
| `POST` | `/api/v1/policies/maturity-assessment` | Assess every policy |
| `GET/POST` | `/api/v1/cases` | List or create cases |
| `GET/PUT/DELETE` | `/api/v1/cases/{caseId}` | Read, update or delete a case |
| `GET` | `/api/v1/cases/by-policy/{policyId}` | Find the case for a policy |
| `POST` | `/api/v1/cases/owner-detection` | Route cases to broker or In-House Sales |
| `POST` | `/api/v1/cases/maturity-package-email` | Issue the formal pack for advised cases |
| `POST` | `/api/v1/cases/{caseId}/advice/request` | Customer asks for advice (optional non-binding preference) |
| `POST` | `/api/v1/cases/{caseId}/advice/accept` | Advisor accepts the lead |
| `POST` | `/api/v1/cases/{caseId}/advice/appointment` | Advisor books the appointment |
| `POST` | `/api/v1/cases/{caseId}/advice/recommendation` | Advisor records the agreed option and rationale |
| `GET` | `/api/v1/cases/{caseId}/journey` | Customer journey: options, documents, message |
| `POST` | `/api/v1/cases/{caseId}/journey/documents` | Record a required document type; an `accountHolder` that does not match the policyholder holds the case for review |
| `POST` | `/api/v1/cases/{caseId}/journey/exception/resolve` | Case worker resolves a document conflict and completes the case |
| `GET` | `/api/v1/metrics/efficiency` | Lanes, touchpoints and distribution measures |
| `POST` | `/api/v1/demo/reset` | Restore the seeded scenarios |

## Limitations

Data is in memory and lost on restart. The formal pack email is generated but
not delivered. Document recording stores the document type only, not file
contents. There is no authentication or ownership filtering.
