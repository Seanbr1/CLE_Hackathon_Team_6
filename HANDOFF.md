# Retirement Hub UI handoff

Use this file to continue the React UI work with an agent. Start by reading this
handoff and `retirement-hub-ui/README.md`, then inspect the current code and API
before changing behavior. Keep changes scoped to the UI unless the backend team
explicitly takes on a backend dependency. Share progress after each meaningful
step, and validate the exact user-facing flow affected.

## Current state

- The customer, broker and case-worker views are implemented in
  `retirement-hub-ui/` and connected to the Java demo API.
- Recent demo enhancements include a collapsible case-worker maturity workflow,
  richer case details and status actions, broker session-only contact notes,
  synthetic pension illustrations, a customer choice review and
  acknowledgement, and an annual-statement email preview.
- The annual-statement preview is available from broker and case-worker case
  details. It is a UI preview only; it does not send an email.
- The customer must acknowledge the option review before the UI saves the
  selected option. The saved choice can be changed until the backend marks the
  case complete.
- Synthetic amounts and projections are explicitly labelled as demo
  illustrations, not API valuations, quotes, guarantees, personalised forecasts
  or financial advice.
- The backend is in-memory. Its scheduled job can change eligible case statuses
  approximately every two minutes; a restart loses its seeded records.
- Latest implementation commit: `e9c6e85` (`Improve retirement journey demo
  interactions`). The changes were pushed to `origin/main`.
- On 2026-10-06, UI lint and production build passed. Browser checks covered
  choice review/back navigation/acknowledgement, a saved option against a
  disposable case, the broker status action, the case-worker Exceptions filter,
  and customer layout at 390px without horizontal overflow. The disposable
  case and policy were deleted afterward.

## Remaining work, in priority order

1. **Get product/team approval for demo content.** Review the synthetic pot
   values, option illustrations and assumptions, annual-statement wording, and
   customer-facing maturity-option descriptions. Confirm that the team is
   comfortable presenting these as illustrative demo content. Do not turn them
   into real valuations, financial advice, quotes or guaranteed outcomes.
2. **Finish responsive visual QA.** Check the broker case-detail/contact-log and
   annual-statement preview, plus the case-worker queue and collapsible workflow,
   at desktop, tablet and narrow mobile widths. The recent mobile check covered
   the customer view only; do not assume all layouts are verified. Fix only
   issues found, then rerun lint and build.
3. **Run a disposable full customer journey.** With the backend running, create
   a temporary policy/case and walk through choice review and acknowledgement,
   then record the required document *types* until the journey completes. Verify
   the API status and UI state at each step. The current document API does not
   upload or store file bytes; do not use real customer documents or alter the
   team's seeded demo cases. Remove only the temporary records and verify the
   cleanup. Account for the scheduler when checking statuses.
4. **Confirm the intended broker follow-up behavior.** The current contact log
   is browser-session-only. “Request information” updates status to
   `AWAITING_CUSTOMER`, but sends no message. Ask the team whether persistence
   or actual customer communication is needed; those require backend/API
   support, not a UI-only success simulation.
5. **Capture demo sign-off and any agreed follow-up.** The original asks for
   customer, broker and case-worker usability, Canada Life Europe styling, and
   backend compatibility are implemented at demo level. Gather any specific
   role feedback that has not yet been supplied, record decisions, then make
   only agreed refinements.

## Dependencies outside the current UI

Do not present these as implemented or solve them with mock UI behavior.
Coordinate with the backend/product team if the demo is to move toward a real
service:

- Authentication, authorization and customer/broker case ownership filtering.
- Durable storage and appropriate audit/history for case changes and contact
  notes.
- Secure upload, storage and review of actual document contents.
- Delivery and tracking of real customer email/notifications.
- Approved, accurate pension values and projections; production suitability,
  advice, consent and signature processes.

## Useful project details

- UI: `retirement-hub-ui/` (React/Vite); primary journey and persona views are
  in `retirement-hub-ui/src/App.jsx`.
- Shared UI styling: `retirement-hub-ui/src/App.css`.
- Case API client: `retirement-hub-ui/src/api/caseApi.js`.
- UI setup, API contract and prototype boundaries:
  `retirement-hub-ui/README.md`.
- Backend API base:
  `http://localhost:8080/demo/api/v1`; UI default case collection:
  `http://localhost:8080/demo/api/v1/cases`.
- Use `http://localhost:5173` for the UI; the backend CORS setup allows this
  origin.
- Run the backend from `demo/` with `.\mvnw.cmd spring-boot:run`. Run the UI
  from `retirement-hub-ui/` with `npm run dev`; run `npm run lint` and
  `npm run build` to validate UI changes. The existing workspace has a Node.js
  24 LTS install described in the UI README.
- The supplied wireframe is `Retirement_Hub_Mock_UI.pdf` in the workspace's
  parent folder. Styling uses Canada Life's documented colour and shadow
  foundations; no design-system package is installed.
