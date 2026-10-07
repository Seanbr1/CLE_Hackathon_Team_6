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
        return uploadDocument(caseId, document, null);
    }

    /**
     * Accepts a customer document, checking the account holder on bank details against the
     * policyholder. A mismatch is a conflict the platform must not resolve on its own, so the
     * case is held in the RED lane for CLE Operations instead of completing.
     */
    public CaseJourneyResponse uploadDocument(String caseId, RequiredDocument document, String accountHolder) {
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

        String conflict = accountHolderConflict(retirementCase, document, accountHolder);
        boolean alreadyHeld = hasOpenException(retirementCase);
        if (conflict != null || alreadyHeld) {
            if (conflict != null) retirementCase.setExceptionReason(conflict);
            retirementCase.setCaseStatus(CaseStatus.ON_HOLD);
            retirementCase.setUpdatedAt(Instant.now());
            retirementCase.recordEvent(JourneyEvent.manual(
                    "RESPONSE_RECEIVED",
                    "Customer",
                    document.getLabel() + " recorded through the portal.",
                    CaseStatus.ON_HOLD));
            if (conflict != null) {
                retirementCase.recordEvent(JourneyEvent.automated(
                        "VALIDATION_CONFLICT",
                        "Validation found a conflict: " + conflict + " Automatic payment withheld; "
                                + "case routed to CLE Operations with the evidence attached.",
                        CaseStatus.ON_HOLD));
            }
            return describe(caseRepository.save(retirementCase));
        }

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

    /**
     * A case worker clears a validation exception. The review is recorded as manual
     * operational work; once every document is in, the case completes.
     */
    public CaseJourneyResponse resolveException(String caseId, String note, String actor) {
        Case retirementCase = caseService.getCase(caseId);

        if (!hasOpenException(retirementCase)) {
            throw new InvalidCaseRequestException("Case " + caseId + " has no open exception to resolve");
        }
        if (retirementCase.getMaturityOption() == null) {
            throw new InvalidCaseRequestException(
                    "Case " + caseId + " is held before advice; only document conflicts can be resolved here");
        }

        retirementCase.setExceptionReason(null);
        boolean allDocumentsReceived =
                retirementCase.getUploadedDocuments().containsAll(REQUIRED_DOCUMENTS);
        retirementCase.setCaseStatus(
                allDocumentsReceived ? CaseStatus.COMPLETED : CaseStatus.AWAITING_INFORMATION);
        retirementCase.setUpdatedAt(Instant.now());
        retirementCase.recordEvent(JourneyEvent.manual(
                "EXCEPTION_RESOLVED",
                actor == null || actor.isBlank() ? "Case worker" : actor.trim(),
                note == null || note.isBlank() ? "Exception reviewed and approved." : note.trim(),
                retirementCase.getCaseStatus()));
        if (allDocumentsReceived) {
            retirementCase.recordEvent(JourneyEvent.automated(
                    "CASE_COMPLETED",
                    "Exception cleared. Case completed and released for payment at maturity.",
                    CaseStatus.COMPLETED));
        }

        return describe(caseRepository.save(retirementCase));
    }

    private static boolean hasOpenException(Case retirementCase) {
        return retirementCase.getExceptionReason() != null && !retirementCase.getExceptionReason().isBlank();
    }

    /** A bank account in another name than the policyholder's, or {@code null} when consistent. */
    private static String accountHolderConflict(Case retirementCase, RequiredDocument document, String accountHolder) {
        if (document != RequiredDocument.BANK_DETAILS || accountHolder == null || accountHolder.isBlank()) {
            return null;
        }
        String policyholder = retirementCase.getCaseName() == null ? "" : retirementCase.getCaseName().trim();
        if (accountHolder.trim().equalsIgnoreCase(policyholder)) {
            return null;
        }
        return "the bank account holder (" + accountHolder.trim() + ") does not match the policyholder ("
                + policyholder + ").";
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
            case ON_HOLD -> "We are checking one of your documents. We will contact you if we need anything further.";
            default -> "Review your options, then ask your advisor to talk them through with you.";
        };
    }
}