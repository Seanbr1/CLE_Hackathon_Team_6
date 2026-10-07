# Canada Life Europe Retirement Journey Demo

This repository contains a React demonstration UI and a Java 17 Spring Boot demo
backend for a Canada Life Europe retirement journey.

## Projects

- [`retirement-hub-ui/`](./retirement-hub-ui/) — React and Vite UI for customer,
  broker and case-worker demonstration views.
- [`demo/`](./demo/) — Spring Boot API and scheduled maturity workflow.

The demo follows one maturity case from twelve months before maturity to
payout across three roles: the CLE case worker (operations), the broker 
consultant who advises the customer, and the customer. The platform opens the
case, routes it to the right advisor and issues the paperwork on its own, so
people only spend time on advice and on the exceptions that need them.

The customer explores options and asks for advice; the advisor records the
agreed option, after which the formal pack is issued and the customer records
the required documents. Each case then sorts into a Green, Amber or Red
processing lane, and an efficiency dashboard shows the manual work avoided.

The backend stores data in memory. Document recording does not upload file
contents, and the formal pack email is generated but not delivered. Pension
values and projections are illustrative and are not financial advice. Broker
call notes are session-only.

Click **Demo flow** in the UI for a guided walkthrough of the journey.

## Run locally

Run the backend in one terminal (needs a Java 17 JDK on `PATH` or in
`JAVA_HOME`):

```powershell
Set-Location .\demo
.\mvnw.cmd spring-boot:run
```

Run the UI in a second terminal:

```powershell
Set-Location .\retirement-hub-ui
npm install
npm run dev
```

The default UI API URL is `http://localhost:8080/demo/api/v1/cases`. Override it
with `VITE_CASE_API_BASE_URL` in `retirement-hub-ui/.env.local` if needed; do not
put secrets in frontend environment variables.

The backend API is available under `http://localhost:8080/demo/api/v1`. Its
scheduled job advances cases automatically, including issuing the formal pack
once an advisor has recorded advice.

## Demo limitations

- The role and case selectors are demonstration controls, not authentication.
- The backend does not enforce customer or broker case ownership.
- Cases and policies are held in memory and are lost when the backend restarts.
- The document API records document types only; it does not transfer or store
  file contents.
- The backend creates email content but does not send email.
- The demo is not financial advice and does not submit a binding instruction.

## New: AI-Powered Retirement Planning API

A comprehensive REST API for generating personalized retirement plans with year-by-year projections and AI recommendations.

### Quick Example

```bash
# Natural language query
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20EUR%203000%20per%20month%20from%20500000%20pot%20with%201%20year%20to%20maturity"
```

Response includes:
- 30-year projection with yearly breakdown
- Sustainability status (SUSTAINABLE/AT_RISK)
- AI recommendations for each year
- Mix-match investment strategies (REINVEST, HYBRID, INCOME_FOCUS, ANNUITY)
- Phase-based planning suggestions

### API Endpoints

- `POST /api/v1/retirement-plans` - Generate from structured JSON request
- `POST /api/v1/retirement-plans/from-query` - Generate from natural language query
- `GET /api/v1/retirement-plans/health` - Health check

### Key Features

✅ Natural language query parsing (EUR, USD, GBP, CHF, etc.)
✅ Year-by-year financial projections with inflation adjustment
✅ AI-generated recommendations for each retirement year
✅ Investment strategy recommendations (phase-based: growth → balanced → preservation)
✅ Sustainability analysis and plan viability assessment
✅ Executive summary and comprehensive insights
✅ 26 comprehensive tests (11 service + 15 controller)

### Documentation

- [`RETIREMENT_PLAN_API.md`](./RETIREMENT_PLAN_API.md) - Complete technical documentation, architecture, integration guide
- [`RETIREMENT_PLAN_QUICK_START.md`](./RETIREMENT_PLAN_QUICK_START.md) - Quick start guide with examples in curl, PowerShell, Python, JavaScript

### Example Query Formats

- "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left"
- "Help me plan retirement: USD 4000 monthly from USD 600,000 pot, 2 years to maturity"
- "I need £2500 monthly pension from £400,000 savings, 3 years until fund matures"

### Implementation Details

**New Classes:**
- Models: `RetirementPlanRequest`, `RetirementPlan`, `RetirementYearPlan`
- Service: `RetirementPlanService` (AI logic, calculations, recommendations)
- Controller: `RetirementPlanController` (REST API)
- Tests: `RetirementPlanServiceTest`, `RetirementPlanControllerTest`

**Updated:**
- `WebCorsConfig.java` - Enhanced CORS configuration

See documentation files for detailed API specifications, usage examples, and integration guides.

---