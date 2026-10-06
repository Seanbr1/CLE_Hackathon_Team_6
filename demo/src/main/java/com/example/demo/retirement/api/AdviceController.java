package com.example.demo.retirement.api;

import com.example.demo.retirement.api.dto.AdviceRequest;
import com.example.demo.retirement.api.dto.AdviceRequestFromCustomer;
import com.example.demo.retirement.api.dto.CaseJourneyResponse;
import com.example.demo.retirement.service.AdviceService;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Advisor-led endpoints. The binding maturity selection lives here, not on the
 * customer journey.
 */
@RestController
@RequestMapping("/api/v1/cases/{caseId}/advice")
public class AdviceController {

    private final AdviceService adviceService;

    public AdviceController(AdviceService adviceService) {
        this.adviceService = adviceService;
    }

    /** Customer asks for advice, optionally sharing a non-binding preference. */
    @PostMapping("/request")
    public CaseJourneyResponse requestAdvice(@PathVariable String caseId,
                                             @RequestBody(required = false) AdviceRequestFromCustomer request) {
        return adviceService.requestAdvice(caseId, request == null ? null : request.preference());
    }

    /** Advisor accepts the qualified lead. */
    @PostMapping("/accept")
    public CaseJourneyResponse acceptLead(@PathVariable String caseId,
                                          @RequestBody(required = false) AdviceRequest request) {
        return adviceService.acceptLead(caseId, request == null ? null : request.advisor());
    }

    /** Advisor books the advice appointment. */
    @PostMapping("/appointment")
    public CaseJourneyResponse bookAppointment(@PathVariable String caseId,
                                               @RequestBody(required = false) AdviceRequest request) {
        return adviceService.bookAppointment(
                caseId,
                request == null ? null : request.appointmentAt(),
                request == null ? null : request.advisor(),
                request == null ? null : request.channel());
    }

    /** Advisor records the advice given and the resulting binding selection. */
    @PostMapping("/recommendation")
    public CaseJourneyResponse recordRecommendation(@PathVariable String caseId,
                                                    @RequestBody AdviceRequest request) {
        return adviceService.recordRecommendation(
                caseId,
                request == null ? null : request.recommendedOption(),
                request == null ? null : request.rationale(),
                request == null ? null : request.advisor(),
                request == null ? null : request.channel());
    }
}
