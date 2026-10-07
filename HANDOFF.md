# Retirement Hub handoff

Start with `README.md`, then `retirement-hub-ui/README.md` and `demo/README.md`.
The business context is the CLE Proactive Maturity & Retirement Journey
specification supplied at the start of the hackathon.

## Story

We reduce manual effort in the policy maturity and retirement journey. Three
people use it:

- **CLE case worker**: operations and admin. Sees every maturity case, the
  Green/Amber/Red lanes and the efficiency dashboard. Only steps in on red
  cases.
- **Broker consultant**: receives the lead automatically
  and advises the customer in one workspace, then records the agreed option.
- **Customer** (Maria Schneider): gets maturity information in the annual statement
  she already receives, explores her options, asks for advice, then records
  her documents.

## Current state (2026-10-07)

- Broker-led advice journey and the 9-chapter guided demo are
  implemented (`eb95dc1`). Customers no longer pick an option; the advisor
  records it, and the formal pack follows.
- Demo-readiness pass on the UI: plain-language statuses, owners and audit
  actions in place of backend codes; the stage tracker follows the new order
  (advice before the formal pack); the broker queue shows only broker-managed
  clients; disclaimers are reduced to one short note per screen; fixed pot
  values for the seeded policies; a final "What we took off the desk" step on
  the efficiency dashboard.
- Backend additions: bank-details uploads accept an `accountHolder`; a name that
  does not match the policyholder holds the case (RED) for CLE Operations, and
  `POST /cases/{id}/journey/exception/resolve` records the case worker's review
  and completes the case. Seed names are German. Everything else is unchanged. It is in-memory, and `POST /api/v1/demo/reset` restores
  the three seeded scenarios.

## Presenting

One window, mirrored to the projector. Click **▶ Start demo**: three presentation slides, the live
demo, then a closing Next steps slide. The
run sheet is in `retirement-hub-ui/README.md`. Chapters prepare Maria's case
automatically, so any chapter can be shown in any order.

## Known demo behaviour

The scheduled job runs every 10 seconds and issues the formal pack on its own
once advice is recorded. The demo leans on this: chapter 5 ("The paperwork does
itself") issues the pack immediately if the job has not run yet.

## Running locally

- Backend: from `demo/`, `.\mvnw.cmd spring-boot:run` (Java 17). API base
  `http://localhost:8080/demo/api/v1`.
- UI: from `retirement-hub-ui/`, `npm install` then `npm run dev`, at
  `http://localhost:5173`. Validate with `npm run lint` and `npm run build`.

## Out of scope for the demo

Authentication and ownership filtering in the API, durable storage, real
document upload, email delivery, and approved valuations or advice/signature
processes.
