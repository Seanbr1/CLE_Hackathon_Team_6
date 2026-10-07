package com.example.demo.retirement.api;

import com.example.demo.retirement.api.dto.CaseJourneyResponse;
import com.example.demo.retirement.api.dto.DocumentUploadRequest;
import com.example.demo.retirement.api.dto.ExceptionResolutionRequest;
import com.example.demo.retirement.service.CaseJourneyService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Customer-facing journey endpoints used by the customer portal.
 *
 * <p>Selecting a maturity option is deliberately not here: an advisor records
 * the binding selection through {@link AdviceController}.</p>
 */
@RestController
@RequestMapping("/api/v1/cases/{caseId}/journey")
public class CaseJourneyController {

    private final CaseJourneyService caseJourneyService;

    public CaseJourneyController(CaseJourneyService caseJourneyService) {
        this.caseJourneyService = caseJourneyService;
    }

    /** Current stage, available options and outstanding documents. */
    @GetMapping
    public CaseJourneyResponse getJourney(@PathVariable String caseId) {
        return caseJourneyService.getJourney(caseId);
    }

    /**
     * Upload a document. A complete, consistent response completes the case; a
     * conflicting one is held for CLE Operations.
     */
    @PostMapping("/documents")
    public CaseJourneyResponse uploadDocument(@PathVariable String caseId,
                                              @RequestBody DocumentUploadRequest request) {
        return caseJourneyService.uploadDocument(
                caseId,
                request == null ? null : request.document(),
                request == null ? null : request.accountHolder());
    }

    /** A case worker clears a validation exception after reviewing it. */
    @PostMapping("/exception/resolve")
    public CaseJourneyResponse resolveException(@PathVariable String caseId,
                                                @RequestBody(required = false) ExceptionResolutionRequest request) {
        return caseJourneyService.resolveException(
                caseId,
                request == null ? null : request.note(),
                request == null ? null : request.actor());
    }
}