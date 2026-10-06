package com.example.demo.retirement.service;

import com.example.demo.retirement.api.dto.CaseJourneyResponse;
import com.example.demo.retirement.exception.InvalidCaseRequestException;
import com.example.demo.retirement.models.Case;
import com.example.demo.retirement.models.CaseStatus;
import com.example.demo.retirement.models.JourneyEvent;
import com.example.demo.retirement.models.MaturityOption;
import com.example.demo.retirement.models.RequiredDocument;
import com.example.demo.retirement.repo.CaseRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * Drives the customer-facing part of the retirement journey:
 *
 * <pre>
 * MATURITY_PACKAGE_SENT --customer requests advice--&gt; ADVICE_REQUESTED
 *   ... advisor records the selection (see AdviceService) ...
 * AWAITING_INFORMATION --upload document--&gt; COMPLETED
 * </pre>
 *
 * <p>The customer explores options here but never selects one. The binding
 * selection is made by an advisor in {@link AdviceService}.</p>
 */
@Service
public class CaseJourneyService {

    public static final List<MaturityOption> AVAILABLE_OPTIONS = List.of(MaturityOption.values());
    public static final List<RequiredDocument> REQUIRED_DOCUMENTS = List.of(RequiredDocument.values());

    private final CaseRepository caseRepository;
    private final CaseService caseService;

    public CaseJourneyService(CaseRepository caseRepository, CaseService caseService) {
        this.caseRepository = caseRepository;
        this.caseService = caseService;
    }

    /** Current journey state for a case. */
    public CaseJourneyResponse getJourney(String caseId) {
        return describe(caseService.getCase(caseId));
    }

    /**
     * Accepts a customer document. The case completes only once <em>every</em> required
     * document has been supplied.
     */
    public CaseJourneyResponse uploadDocument(String caseId, RequiredDocument document) {
        if (document == null) {
            throw new InvalidCaseRequestException(
                    "document is required and must be one of " + REQUIRED_DOCUMENTS);
        }

        Case retirementCase = caseService.getCase(caseId);

        if (retirementCase.getMaturityOption() == null) {
            throw new InvalidCaseRequestException(
                    "An advisor must record a maturity option for case " + caseId
                            + " before documents can be uploaded");
        }

        // Documents are auto-accepted in this demo.
        retirementCase.addUploadedDocument(document);

        boolean allDocumentsReceived =
                retirementCase.getUploadedDocuments().containsAll(REQUIRED_DOCUMENTS);

        retirementCase.setCaseStatus(
                allDocumentsReceived ? CaseStatus.COMPLETED : CaseStatus.AWAITING_INFORMATION);
        retirementCase.setUpdatedAt(Instant.now());
        retirementCase.recordEvent(JourneyEvent.manual(
                "RESPONSE_RECEIVED",
                "Customer",
                document.getLabel() + " recorded through the portal.",
                retirementCase.getCaseStatus()));

        if (allDocumentsReceived) {
            retirementCase.recordEvent(JourneyEvent.automated(
                    "STP_COMPLETED",
                    "Validation passed with a complete and consistent response. "
                            + "Case classified GREEN and executed straight through with no manual handling.",
                    CaseStatus.COMPLETED));
        } else {
            retirementCase.recordEvent(JourneyEvent.automated(
                    "ACTION_MATURITY_04",
                    "Validation placed the case in the AMBER lane. Targeted request issued for: "
                            + retirementCase.getOutstandingDocuments().stream()
                            .map(RequiredDocument::getLabel).toList()
                            + ". No duplicate generic communication sent.",
                    CaseStatus.AWAITING_INFORMATION));
        }

        return describe(caseRepository.save(retirementCase));
    }

    /** Shared with {@link AdviceService} so advisor actions return the same shape. */
    CaseJourneyResponse describe(Case retirementCase) {
        List<RequiredDocument> uploaded = List.copyOf(retirementCase.getUploadedDocuments());
        List<RequiredDocument> outstanding = Arrays.stream(RequiredDocument.values())
                .filter(document -> !uploaded.contains(document))
                .toList();

        return new CaseJourneyResponse(
                retirementCase,
                AVAILABLE_OPTIONS,
                REQUIRED_DOCUMENTS,
                uploaded,
                outstanding,
                buildMessage(retirementCase, outstanding)
        );
    }

    private String buildMessage(Case retirementCase, List<RequiredDocument> outstanding) {
        return switch (retirementCase.getCaseStatus()) {
            case COMPLETED -> "Your retirement option is confirmed and your documents are accepted. "
                    + "You are ready for retirement.";
            case MATURITY_PACKAGE_SENT, AWAITING_INFORMATION -> outstanding.isEmpty()
                    ? "All documents received."
                    : "We still need: " + outstanding.stream().map(RequiredDocument::getLabel).toList();
            case ADVICE_REQUESTED -> "Your advice request is with your advisor. "
                    + "They will talk you through the options and record your choice with you.";
            case APPOINTMENT_BOOKED -> "Your advice appointment is booked. "
                    + "Your advisor will confirm your option with you.";
            case IN_PROGRESS -> "Your advisor has recorded your option. "
                    + "We are preparing your formal maturity pack now.";
            default -> "Review your options, then ask your advisor to talk them through with you.";
        };
    }
}