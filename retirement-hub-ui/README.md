# Retirement Hub UI prototype

A standalone React prototype for the Germany-focused Canada Life maturity and retirement journey. It has customer, broker and case-worker views based on the supplied mock UI and 2027 journey specification.

## Run locally

```powershell
$env:Path = "$env:LOCALAPPDATA\Programs\nodejs-lts-v24.19.0;$env:Path"
npm.cmd install
npm.cmd run dev
```

The commands above use the portable Node.js 24 LTS installed for this workspace. `npm.cmd` avoids PowerShell's script-execution restriction on the `npm.ps1` shim. With another Node installation, ensure a Vite-supported Node release is on `PATH` and run the matching npm commands for your shell.

## Prototype boundaries

- Case-worker, broker and customer views read cases from the live Java API. No synthetic case fallback is shown when the service fails.
- The customer view can read a case journey, review/change a maturity option before completion, confirm an acknowledgement, and record required document types.
- Pension pot amounts and option scenarios are deterministic synthetic demo data in the UI; they are not API valuations, personalised projections, quotes, guarantees or financial advice. Scenarios exclude relevant factors such as fees, tax, inflation and future contributions as described in the interface.
- The customer option review requires an explicit acknowledgement before the choice is recorded by the API. The connected service allows a saved choice to be changed until the case is complete; a completed case cannot be changed.
- A policy's T-12 annual statement email can be previewed from broker and case-worker case details. The preview uses the linked policy's maturity date and synthetic UI values; it is not sent. The backend does not provide or send an annual statement.
- The live maturity workflow panel in the case-worker queue can be collapsed for demonstrations.
- Broker details include a session-only call/follow-up note log. Notes are not sent to or persisted by the backend. Broker and case-worker follow-up can update a case to `AWAITING_CUSTOMER`; that status change does not send a customer message.
- Broker and case-worker queues surface next actions and group cases by returned status: red for on-hold/cancelled, amber for awaiting customer/information or maturity package, green for completed, and neutral for other active stages. These colours are workflow indicators, not a separate risk assessment.
- The role selector and customer case selector are demonstration controls, not authentication or authorization. The backend has no customer or broker ownership filtering, so every role can see all cases returned by the API.
- The document picker sends the selected enum type and filename, but no file bytes. The backend records the enum and currently ignores the filename; it does not store, inspect, or review a file.
- The backend maturity-package step generates an email body/recipient and updates case status. It does not deliver email. The scheduled job may advance eligible cases automatically.
- The Java backend uses in-memory policy and case repositories; records disappear when the backend restarts.
- This is a technical integration demo, not a production portal, an authenticated experience, financial advice, or a binding customer instruction.

## Case API connection

Start the Java 17 backend and ensure its case API is available at `http://localhost:8080/demo/api/v1/cases`. Then start the UI from `http://localhost:5173` (the backend CORS configuration allows this origin).

The UI uses `VITE_CASE_API_BASE_URL` to configure the collection URL. Its default is `http://localhost:8080/demo/api/v1/cases`. To override it, create `.env.local` in this project with:

```dotenv
VITE_CASE_API_BASE_URL=http://localhost:8080/demo/api/v1/cases
```

The case list expects `GET` to return a JSON array of records containing `caseId`, `caseName` and `caseStatus`. Optional fields displayed when provided are `policyId`, `owner`, `ownerType`, `email`, `caseSla`, `description`, `createdAt`, `updatedAt`, `maturityOption` and `uploadedDocuments`.

### Live demo workflow

In the case-worker queue, **Run a live maturity journey** calls the backend in sequence:

1. `POST /policies` to create a policy (the demo form requires a future maturity date within one year).
2. `POST /policies/{policyId}/maturity-assessment` to run the backend maturity rule and create a case.
3. `POST /cases/owner-detection` to classify eligible cases as CLE/non-CLE and assign the configured routing email. This assigns an address; it does not send email.
4. `GET /cases` to refresh the queue.

The backend's scheduled batch job may create a maturity-package email body and transition eligible cases to `MATURITY_PACKAGE_SENT`; it does not send the email.

### Customer journey

The customer view lets the demo operator select a backend case, then calls:

- `GET /cases/{caseId}/journey` to load the available maturity options and document requirements.
- `POST /cases/{caseId}/journey/maturity-option` with one `ANNUITY`, `LUMP_SUM` or `REINVEST` option. The UI exposes one saved choice per case.
- `POST /cases/{caseId}/journey/documents` with `PASSPORT` or `BANK_DETAILS` and the selected filename. The backend ignores `fileName`, records the enum immediately, and marks the case `COMPLETED` once all required document types have been recorded. No file content is sent.

The broker and case-worker views also use live cases. The case-worker **Request information** action calls `PUT /cases/{caseId}` to set status to `AWAITING_CUSTOMER`; this records status only and does not send a message. The UI does not trigger the collection-wide manual maturity-package endpoint.

This integration still lacks authentication/authorization, customer or broker ownership filtering, durable persistence, real document upload/storage/review, actual email delivery, secure customer portal access and a production-ready advice/signature flow.

## Design notes

The UI uses the official [Canada Life colour tokens](https://design.canadalife.de/foundation/colour) for brand red, secondary teal, text, neutrals and functional status colours. The official Canada Life white logo is included locally as `public/canada-life-logo-white.svg` and displayed on the brand-red background for contrast. Elevation uses the documented [Canada Life shadow tokens](https://design.canadalife.de/foundation/shadows): small for cards, medium for floating UI, and wide for hover/modal layers.

The supplied design-system package archives were not present, so this prototype uses the documented assets and tokens locally rather than importing `@canadalife/design-system`.
