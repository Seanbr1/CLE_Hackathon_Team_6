package com.example.demo.retirement.service;

import com.example.demo.retirement.models.AdviceRecord;
import com.example.demo.retirement.models.Case;
import com.example.demo.retirement.models.CaseStatus;
import com.example.demo.retirement.models.JourneyEvent;
import com.example.demo.retirement.models.MaturityOption;
import com.example.demo.retirement.models.OwnerType;
import com.example.demo.retirement.models.Policy;
import com.example.demo.retirement.models.RequiredDocument;
import com.example.demo.retirement.repo.CaseRepository;
import com.example.demo.retirement.repo.PolicyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Builds the three prototype scenarios so every view has something to show on a
 * cold start and all three processing lanes are represented.
 *
 * <ul>
 *   <li><b>A</b> - broker happy path, awaiting the customer response. Driving this
 *       case through the portal lands it in the GREEN straight-through lane.</li>
 *   <li><b>C</b> - direct customer who responded but is missing one document,
 *       sitting in the AMBER targeted-follow-up lane.</li>
 *   <li><b>E</b> - advisor ownership conflict held in the RED human-review lane.</li>
 * </ul>
 *
 * <p>Dates are relative to the seed time so the demo always reads as current.</p>
 */
@Service
public class DemoDataService {

    public static final String SCENARIO_A_CASE_ID = "CASE-2027-10021";
    public static final String SCENARIO_C_CASE_ID = "CASE-2027-10044";
    public static final String SCENARIO_E_CASE_ID = "CASE-2027-10078";

    private static final Logger log = LoggerFactory.getLogger(DemoDataService.class);

    private final PolicyRepository policyRepository;
    private final CaseRepository caseRepository;

    public DemoDataService(PolicyRepository policyRepository, CaseRepository caseRepository) {
        this.policyRepository = policyRepository;
        this.caseRepository = caseRepository;
    }

    /** Seeds the scenarios only when the policy store is empty. */
    public boolean seedIfEmpty() {
        if (!policyRepository.findAll().isEmpty()) {
            log.info("Demo seed skipped: the policy store already holds data.");
            return false;
        }
        seed();
        return true;
    }

    /** Clears every policy and case, then re-seeds the three scenarios. */
    public void reset() {
        caseRepository.findAll().forEach(item -> caseRepository.deleteById(item.getCaseId()));
        policyRepository.findAll().forEach(item -> policyRepository.deleteById(item.getPolicyId()));
        seed();
        log.info("Demo data reset to the three prototype scenarios.");
    }

    /** Current cases, used by the reset endpoint to return the restored state. */
    public List<Case> listCases() {
        return caseRepository.findAll();
    }

    private void seed() {
        LocalDate today = LocalDate.now();
        Instant now = Instant.now();

        seedBrokerHappyPath(today, now);
        seedMissingInformation(today, now);
        seedOwnershipException(today, now);

        log.info("Demo seed complete: {} policies and {} cases across the Green/Amber/Red lanes.",
                policyRepository.findAll().size(), caseRepository.findAll().size());
    }

    /** Scenario A: broker-managed. Statement fell at T-7; now at T-6 awaiting advice. */
    private void seedBrokerHappyPath(LocalDate today, Instant now) {
        LocalDate maturity = today.plusMonths(6);
        String policyId = "POL-2027-10021";

        policyRepository.save(new Policy(
                policyId,
                // Anniversary falls 7 months before maturity, so the annual
                // statement for this contract lands at T-7.
                maturity.minusMonths(7).minusYears(27),
                maturity,
                "PARTNER-10021",
                "BROKER-1027",
                OwnerType.NON_CLE,
                now.minus(180, ChronoUnit.DAYS),
                now
        ));

        Case brokerCase = new Case(
                SCENARIO_A_CASE_ID,
                "Maria Schneider",
                CaseStatus.NON_CLE_OWNER_DETECTED,
                "30d",
                "BROKER-1027",
                "Maria's policy matures on " + maturity
                        + ". Broker-managed, so her broker advises her. Her annual statement already "
                        + "carried her maturity information.",
                policyId,
                now.minus(180, ChronoUnit.DAYS),
                now
        );
        brokerCase.setOwnerType(OwnerType.NON_CLE);
        brokerCase.setEmail(OwnerType.NON_CLE.getEmail());
        brokerCase.setJourneyEvents(List.of(
                event("ACTION_MATURITY_01", "Maturity case opened automatically a year before maturity.",
                        CaseStatus.MATURITY_DETECTED, 180),
                event("ACTION_MATURITY_05", "Relationship is broker-managed. Qualified lead prepared for her broker.",
                        CaseStatus.NON_CLE_OWNER_DETECTED, 178),
                event("ACTION_MATURITY_02", "Annual statement fell seven months before maturity. "
                                + "Maturity information was added to it and the separate mailshot was suppressed.",
                        CaseStatus.NON_CLE_OWNER_DETECTED, 30)
        ));
        caseRepository.claimPolicyLink(policyId, SCENARIO_A_CASE_ID);
        caseRepository.save(brokerCase);
    }

    /** Scenario C: In-House Sales advised, one document still outstanding. */
    private void seedMissingInformation(LocalDate today, Instant now) {
        LocalDate maturity = today.plusMonths(4);
        String policyId = "POL-2027-10044";

        policyRepository.save(new Policy(
                policyId,
                // Anniversary falls 10 months before maturity for this contract.
                maturity.minusMonths(10).minusYears(30),
                maturity,
                "PARTNER-10044",
                "CLE-TEAM",
                OwnerType.CLE,
                now.minus(240, ChronoUnit.DAYS),
                now
        ));

        Case directCase = new Case(
                SCENARIO_C_CASE_ID,
                "Thomas Weber",
                CaseStatus.AWAITING_INFORMATION,
                "14d",
                "CLE-TEAM",
                "Thomas is serviced directly. In-House Sales advised a guaranteed income and it has been "
                        + "formalised. His bank details are still outstanding.",
                policyId,
                now.minus(240, ChronoUnit.DAYS),
                now
        );
        directCase.setOwnerType(OwnerType.CLE);
        directCase.setEmail(OwnerType.CLE.getEmail());
        directCase.setCustomerPreference(MaturityOption.LUMP_SUM);
        directCase.setMaturityOption(MaturityOption.ANNUITY);
        directCase.setLeadAcceptedAt(now.minus(55, ChronoUnit.DAYS));
        directCase.setAppointmentAt(now.minus(48, ChronoUnit.DAYS));
        directCase.setAdviceRecord(new AdviceRecord(
                MaturityOption.ANNUITY,
                "Customer initially leaned towards a lump sum. After discussing the need for a "
                        + "predictable income to cover fixed outgoings, a guaranteed income was agreed "
                        + "as the better fit and recorded with the customer on the call.",
                "In-House Sales · A. Becker",
                "Telephone",
                now.minus(48, ChronoUnit.DAYS)));
        directCase.setUploadedDocuments(List.of(RequiredDocument.PASSPORT));
        directCase.setJourneyEvents(List.of(
                event("ACTION_MATURITY_01", "Maturity case opened at T-12 from the policy maturity event.",
                        CaseStatus.MATURITY_DETECTED, 240),
                event("ACTION_MATURITY_05", "No intermediary assigned. Relationship is directly serviced; "
                                + "qualified lead routed to In-House Sales.",
                        CaseStatus.CLE_OWNER_DETECTED, 238),
                event("ACTION_MATURITY_03", "Formal maturity package issued at T-6 with the digital response journey.",
                        CaseStatus.MATURITY_PACKAGE_SENT, 60),
                manualEvent("ADVICE_REQUESTED", "Customer", "Advice requested through the portal. "
                                + "Customer is leaning towards Lump sum (non-binding).",
                        CaseStatus.ADVICE_REQUESTED, 56),
                manualEvent("LEAD_ACCEPTED", "In-House Sales · A. Becker",
                        "Qualified lead accepted. Advisor has taken ownership of the conversation.",
                        CaseStatus.ADVICE_REQUESTED, 55),
                manualEvent("APPOINTMENT_BOOKED", "In-House Sales · A. Becker",
                        "Advice appointment booked by Telephone.",
                        CaseStatus.APPOINTMENT_BOOKED, 52),
                manualEvent("ADVICE_COMPLETED", "In-House Sales · A. Becker",
                        "Advice given and Annuity recorded on the customer's behalf. "
                                + "Rationale captured against the case.",
                        CaseStatus.AWAITING_INFORMATION, 48),
                manualEvent("RESPONSE_RECEIVED", "Customer", "Passport recorded through the portal.",
                        CaseStatus.AWAITING_INFORMATION, 40),
                event("ACTION_MATURITY_04", "Validation placed the case in the AMBER lane. Targeted reminder "
                                + "issued for bank details only; no duplicate mailshot.",
                        CaseStatus.AWAITING_INFORMATION, 12)
        ));
        caseRepository.claimPolicyLink(policyId, SCENARIO_C_CASE_ID);
        caseRepository.save(directCase);
    }

    /** Scenario E: ownership conflict that must stop straight-through processing. */
    private void seedOwnershipException(LocalDate today, Instant now) {
        LocalDate maturity = today.plusMonths(3);
        String policyId = "POL-2027-10078";

        policyRepository.save(new Policy(
                policyId,
                // Anniversary falls just 2 months before maturity, which is the
                // case where redundancy with the formal package has to be checked.
                maturity.minusMonths(2).minusYears(22),
                maturity,
                "PARTNER-10078",
                "UNASSIGNED",
                null,
                now.minus(270, ChronoUnit.DAYS),
                now
        ));

        Case exceptionCase = new Case(
                SCENARIO_E_CASE_ID,
                "Sabine Hoffmann",
                CaseStatus.ON_HOLD,
                "5d",
                "UNASSIGNED",
                "Sabine's policy matures soon, but we cannot work out who advises her. "
                        + "The journey is stopped until a person resolves it.",
                policyId,
                now.minus(270, ChronoUnit.DAYS),
                now
        );
        exceptionCase.setExceptionReason(
                "We cannot tell who advises this client. The contract is marked broker-managed but no "
                        + "active broker is attached, so no lead can be sent and nothing can be automated.");
        exceptionCase.setJourneyEvents(List.of(
                event("ACTION_MATURITY_01", "Maturity case opened at T-12 from the policy maturity event.",
                        CaseStatus.MATURITY_DETECTED, 270),
                event("ACTION_MATURITY_05", "Advisor ownership check failed: broker flag set with no active intermediary.",
                        CaseStatus.MATURITY_DETECTED, 268),
                event("MANUAL_REVIEW", "Case withheld from automation and placed in the human-review queue with full context.",
                        CaseStatus.ON_HOLD, 268),
                // The exception is where the operational effort actually goes.
                manualEvent("MANUAL_REVIEW", "Case worker",
                        "Opened the case and checked the contract against the intermediary register.",
                        CaseStatus.ON_HOLD, 240),
                manualEvent("MANUAL_REVIEW", "Case worker",
                        "Contacted distribution to confirm whether the agency was transferred or lapsed. No reply yet.",
                        CaseStatus.ON_HOLD, 120),
                manualEvent("MANUAL_REVIEW", "Case worker",
                        "Chased distribution a second time. Case still cannot be routed to an advisor.",
                        CaseStatus.ON_HOLD, 30)
        ));
        caseRepository.claimPolicyLink(policyId, SCENARIO_E_CASE_ID);
        caseRepository.save(exceptionCase);
    }

    private static JourneyEvent event(String action, String detail, CaseStatus status, long daysAgo) {
        JourneyEvent journeyEvent = JourneyEvent.automated(action, detail, status);
        journeyEvent.setAt(Instant.now().minus(daysAgo, ChronoUnit.DAYS));
        return journeyEvent;
    }

    private static JourneyEvent manualEvent(String action, String actor, String detail,
                                            CaseStatus status, long daysAgo) {
        JourneyEvent journeyEvent = JourneyEvent.manual(action, actor, detail, status);
        journeyEvent.setAt(Instant.now().minus(daysAgo, ChronoUnit.DAYS));
        return journeyEvent;
    }
}
