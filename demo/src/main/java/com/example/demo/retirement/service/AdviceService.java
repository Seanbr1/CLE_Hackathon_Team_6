package com.example.demo.retirement.service;

import com.example.demo.retirement.api.dto.CaseJourneyResponse;
import com.example.demo.retirement.exception.InvalidCaseRequestException;
import com.example.demo.retirement.models.AdviceRecord;
import com.example.demo.retirement.models.Case;
import com.example.demo.retirement.models.CaseStatus;
import com.example.demo.retirement.models.JourneyEvent;
import com.example.demo.retirement.models.MaturityOption;
import com.example.demo.retirement.models.OwnerType;
import com.example.demo.retirement.repo.CaseRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Advisor-led part of the retirement journey.
 *
 * <pre>
 * MATURITY_PACKAGE_SENT --customer requests advice--&gt; ADVICE_REQUESTED
 *                       --advisor accepts lead + books--&gt; APPOINTMENT_BOOKED
 *                       --advisor records advice + option--&gt; AWAITING_INFORMATION
 * </pre>
 *
 * <p>The binding option selection lives here rather than in the customer
 * journey: the customer explores and may share a preference, but an advisor
 * makes the selection and the reason is recorded against the case.</p>
 */
@Service
public class AdviceService {

    private static final List<CaseStatus> ADVICE_STAGES = List.of(
            CaseStatus.CLE_OWNER_DETECTED,
            CaseStatus.NON_CLE_OWNER_DETECTED,
            CaseStatus.MATURITY_PACKAGE_SENT,
            CaseStatus.ADVICE_REQUESTED,
            CaseStatus.APPOINTMENT_BOOKED,
            CaseStatus.AWAITING_CUSTOMER
    );

    private final CaseRepository caseRepository;
    private final CaseService caseService;
    private final CaseJourneyService caseJourneyService;

    public AdviceService(CaseRepository caseRepository,
                         CaseService caseService,
                         CaseJourneyService caseJourneyService) {
        this.caseRepository = caseRepository;
        this.caseService = caseService;
        this.caseJourneyService = caseJourneyService;
    }

    /**
     * Customer asks their advisor to advise, optionally sharing a non-binding
     * preference. This creates the advice request; it selects nothing.
     */
    public CaseJourneyResponse requestAdvice(String caseId, MaturityOption preference) {
        Case retirementCase = requireOpenCase(caseId);

        if (retirementCase.getCaseStatus() != CaseStatus.ADVICE_REQUESTED
                && retirementCase.getCaseStatus() != CaseStatus.APPOINTMENT_BOOKED) {
            retirementCase.setCaseStatus(CaseStatus.ADVICE_REQUESTED);
        }
        retirementCase.setCustomerPreference(preference);
        retirementCase.setUpdatedAt(Instant.now());

        String preferenceNote = preference == null
                ? "No preference shared."
                : "Customer is leaning towards " + preference.getLabel() + " (non-binding).";
        retirementCase.recordEvent(JourneyEvent.manual(
                "ADVICE_REQUESTED",
                "Customer",
                "Advice requested through the portal. " + preferenceNote,
                retirementCase.getCaseStatus()));
        retirementCase.recordEvent(JourneyEvent.automated(
                "ACTION_MATURITY_05",
                "Qualified lead routed to " + advisorFor(retirementCase)
                        + " with maturity date, contract context, journey status and next action.",
                retirementCase.getCaseStatus()));

        return caseJourneyService.describe(caseRepository.save(retirementCase));
    }

    /** Advisor accepts the qualified lead. Tracked for lead acceptance rate. */
    public CaseJourneyResponse acceptLead(String caseId, String advisor) {
        Case retirementCase = requireOpenCase(caseId);

        if (retirementCase.getLeadAcceptedAt() == null) {
            retirementCase.setLeadAcceptedAt(Instant.now());
            retirementCase.recordEvent(JourneyEvent.manual(
                    "LEAD_ACCEPTED",
                    advisorName(advisor, retirementCase),
                    "Qualified lead accepted. Advisor has taken ownership of the conversation.",
                    retirementCase.getCaseStatus()));
        }
        retirementCase.setUpdatedAt(Instant.now());

        return caseJourneyService.describe(caseRepository.save(retirementCase));
    }

    /** Advisor books the advice appointment. Tracked for appointment rate. */
    public CaseJourneyResponse bookAppointment(String caseId, Instant appointmentAt,
                                               String advisor, String channel) {
        Case retirementCase = requireOpenCase(caseId);
        Instant scheduledFor = appointmentAt == null ? Instant.now() : appointmentAt;

        if (retirementCase.getLeadAcceptedAt() == null) {
            retirementCase.setLeadAcceptedAt(Instant.now());
        }
        retirementCase.setAppointmentAt(scheduledFor);
        retirementCase.setCaseStatus(CaseStatus.APPOINTMENT_BOOKED);
        retirementCase.setUpdatedAt(Instant.now());
        retirementCase.recordEvent(JourneyEvent.manual(
                "APPOINTMENT_BOOKED",
                advisorName(advisor, retirementCase),
                "Advice appointment booked"
                        + (channel == null || channel.isBlank() ? "" : " by " + channel) + ".",
                CaseStatus.APPOINTMENT_BOOKED));

        return caseJourneyService.describe(caseRepository.save(retirementCase));
    }

    /**
     * Advisor records the advice given and the resulting binding selection.
     * This is what prompts the customer for documents.
     */
    public CaseJourneyResponse recordRecommendation(String caseId, MaturityOption option,
                                                    String rationale, String advisor, String channel) {
        if (option == null) {
            throw new InvalidCaseRequestException(
                    "recommendedOption is required and must be one of "
                            + List.of(MaturityOption.values()));
        }

        Case retirementCase = requireOpenCase(caseId);
        String advisedBy = advisorName(advisor, retirementCase);

        retirementCase.setAdviceRecord(new AdviceRecord(
                option,
                rationale == null || rationale.isBlank() ? "No rationale recorded." : rationale.trim(),
                advisedBy,
                channel == null || channel.isBlank() ? "Not recorded" : channel,
                Instant.now()));
        retirementCase.setMaturityOption(option);
        // Advice happens before formalisation, so the case waits here until the
        // formal maturity package is issued.
        retirementCase.setCaseStatus(CaseStatus.IN_PROGRESS);
        retirementCase.setUpdatedAt(Instant.now());

        retirementCase.recordEvent(JourneyEvent.manual(
                "ADVICE_COMPLETED",
                advisedBy,
                "Advice given and " + option.getLabel()
                        + " recorded on the customer's behalf. Rationale captured against the case.",
                CaseStatus.IN_PROGRESS));

        return caseJourneyService.describe(caseRepository.save(retirementCase));
    }

    private Case requireOpenCase(String caseId) {
        Case retirementCase = caseService.getCase(caseId);

        if (retirementCase.getCaseStatus() == CaseStatus.COMPLETED) {
            throw new InvalidCaseRequestException(
                    "Case " + caseId + " is already complete and cannot be changed");
        }
        if (!ADVICE_STAGES.contains(retirementCase.getCaseStatus())
                && retirementCase.getCaseStatus() != CaseStatus.AWAITING_INFORMATION) {
            throw new InvalidCaseRequestException(
                    "Case " + caseId + " is at " + retirementCase.getCaseStatus()
                            + " and is not at an advice stage");
        }
        return retirementCase;
    }

    /** Broker-managed contracts go to the intermediary; direct ones to In-House Sales. */
    private static String advisorFor(Case retirementCase) {
        if (retirementCase.getOwnerType() == OwnerType.NON_CLE) {
            return "broker " + retirementCase.getOwner();
        }
        return "In-House Sales";
    }

    private static String advisorName(String advisor, Case retirementCase) {
        if (advisor != null && !advisor.isBlank()) return advisor.trim();
        return retirementCase.getOwnerType() == OwnerType.NON_CLE ? "Broker" : "In-House Sales";
    }
}
