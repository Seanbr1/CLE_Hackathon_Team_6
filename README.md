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
