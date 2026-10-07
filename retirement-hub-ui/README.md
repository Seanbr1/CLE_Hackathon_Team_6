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
- The customer view reads a case journey, lets the customer explore options and ask for advice (sharing a non-binding preference), shows the option their advisor recorded, and records required document types.
- Pension pot amounts and option scenarios are deterministic synthetic demo data in the UI; they are not API valuations, personalised projections, quotes, guarantees or financial advice. Scenarios exclude relevant factors such as fees, tax, inflation and future contributions as described in the interface.
- The broker advice workspace accepts the lead, books the appointment and records the agreed option with a rationale. The binding selection is made by the advisor, not the customer.
- A policy's T-12 annual statement email can be previewed from broker and case-worker case details. The preview uses the linked policy's maturity date and synthetic UI values; it is not sent. The backend does not provide or send an annual statement.
- The case-worker queue includes an "Add a maturing policy" panel (collapsed by default), a Lanes view and an Efficiency dashboard. The guided **Demo flow** walks through the journey on the real screens.

### Presenting

The demo runs in one window, built for a mirrored laptop screen. Click **▶ Start demo** (bottom right). A slim caption at the bottom names each chapter in one sentence; **Next →** / **←** (or the arrow keys) move between chapters, and the dots jump to any chapter. Each chapter puts Maria's case into the state it needs automatically, so moving backwards or forwards never hits an out-of-order error. In live chapters, the one button to click pulses.

| # | Chapter | Driver clicks |
|---|---|---|
| — | Slide 1: Our solution (Retirement Hub, description, Team 6) | Next |
| — | Slide 2: The opportunity (the maturity wave) | Next (into the live platform) |
| 1 | Case opened automatically | Next |
| 2 | Maturity information in the annual statement | **See my options** (moves on to chapter 3) |
| 3 | Customer requests advice | **Ask my advisor for advice** |
| 4 | Broker-led advice | **Pick up lead**, **Accept lead**, **Schedule conversation**, **Record advice** |
| 5 | Formal pack and documents | **Upload passport**, **Upload bank details** (the bank details carry Maria's married name, so validation holds the payment) |
| 6 | Exception handled by CLE Operations | **Review exception**, **Approve and release** |
| 7 | Activity by participant | Next. Say the impact: around nine manual touches today, one here |
| — | Closing slide: Next steps | — |

The ⚙ menu restarts from the beginning or exits the demo.
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

In the case-worker queue, **Add a maturing policy** calls the backend in sequence:

1. `POST /policies` to create a policy (the demo form requires a future maturity date within one year).
2. `POST /policies/{policyId}/maturity-assessment` to run the backend maturity rule and create a case.
3. `POST /cases/owner-detection` to classify eligible cases as CLE/non-CLE and assign the configured routing email. This assigns an address; it does not send email.
4. `GET /cases` to refresh the queue.

The backend's scheduled batch job may create a maturity-package email body and transition eligible cases to `MATURITY_PACKAGE_SENT`; it does not send the email.

### Customer and advice journey

The customer view lets the demo operator select a backend case, then calls:

- `GET /cases/{caseId}/journey` to load the available options, document requirements and status message.
- `POST /cases/{caseId}/advice/request` when the customer asks for advice, with an optional non-binding preference.
- `POST /cases/{caseId}/journey/documents` with `PASSPORT` or `BANK_DETAILS` once the advisor has recorded an option. No file content is sent; the case completes once all required types are recorded.

The broker advice workspace calls `POST /cases/{caseId}/advice/accept`, `/advice/appointment` and `/advice/recommendation`. The case worker can issue the formal pack with `POST /cases/maturity-package-email`, although the scheduled job also does this automatically. **Request information** calls `PUT /cases/{caseId}` to set `AWAITING_CUSTOMER`; it does not send a message.

This integration still lacks authentication/authorization, customer or broker ownership filtering, durable persistence, real document upload/storage/review, actual email delivery, secure customer portal access and a production-ready advice/signature flow.

## Design notes

The UI uses the official [Canada Life colour tokens](https://design.canadalife.de/foundation/colour) for brand red, secondary teal, text, neutrals and functional status colours. The official Canada Life white logo is included locally as `public/canada-life-logo-white.svg` and displayed on the brand-red background for contrast. Elevation uses the documented [Canada Life shadow tokens](https://design.canadalife.de/foundation/shadows): small for cards, medium for floating UI, and wide for hover/modal layers.

The supplied design-system package archives were not present, so this prototype uses the documented assets and tokens locally rather than importing `@canadalife/design-system`.
