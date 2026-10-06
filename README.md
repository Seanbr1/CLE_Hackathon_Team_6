# Canada Life Europe Retirement Journey Demo

This repository contains a React demonstration UI and a Java 17 Spring Boot demo
backend for a Canada Life Europe retirement journey.

## Projects

- [`retirement-hub-ui/`](./retirement-hub-ui/) — React and Vite UI for customer,
  broker and case-worker demonstration views.
- [`demo/`](./demo/) — Spring Boot API and scheduled maturity workflow.

The customer journey reads a case from the backend, saves one maturity option,
and records the required document types. The backend currently stores data in
memory. Document recording does not upload file contents, and the maturity
package workflow generates email content but does not deliver email.

The UI also includes a review-and-acknowledgement step before saving a maturity
choice, case email previews, and synthetic pension values for demonstration
only. These sample values are not API valuations, personalised forecasts,
quotes, guarantees or financial advice. Broker call notes are session-only and
are not saved by the backend.

## Run locally

Run the backend in one terminal:

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
scheduled workflow may advance new cases to `MATURITY_PACKAGE_SENT`, after
which the customer can choose an option and record required document types.

## Demo limitations

- The role and case selectors are demonstration controls, not authentication.
- The backend does not enforce customer or broker case ownership.
- Cases and policies are held in memory and are lost when the backend restarts.
- The document API records document types only; it does not transfer or store
  file contents.
- The backend creates email content but does not send email.
- The demo is not financial advice and does not submit a binding instruction.
