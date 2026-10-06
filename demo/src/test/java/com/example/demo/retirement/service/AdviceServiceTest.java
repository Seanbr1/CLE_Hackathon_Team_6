package com.example.demo.retirement.service;

import com.example.demo.retirement.api.dto.CaseJourneyResponse;
import com.example.demo.retirement.api.dto.CaseRequest;
import com.example.demo.retirement.exception.InvalidCaseRequestException;
import com.example.demo.retirement.models.Case;
import com.example.demo.retirement.models.CaseStatus;
import com.example.demo.retirement.models.MaturityOption;
import com.example.demo.retirement.models.RequiredDocument;
import com.example.demo.retirement.repo.CaseRepository;
import com.example.demo.retirement.repo.InMemoryCaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdviceServiceTest {

    private CaseService caseService;
    private CaseJourneyService journeyService;
    private AdviceService adviceService;

    @BeforeEach
    void setUp() {
        CaseRepository caseRepository = new InMemoryCaseRepository();
        caseService = new CaseService(caseRepository);
        journeyService = new CaseJourneyService(caseRepository, caseService);
        adviceService = new AdviceService(caseRepository, caseService, journeyService);
    }

    private Case givenSentCase(String policyId) {
        return caseService.createCase(new CaseRequest(
                "Maturity detected for policy " + policyId,
                CaseStatus.MATURITY_PACKAGE_SENT, "30d", "BROKER-MERIDIAN", "desc", policyId));
    }

    @Test
    void requestingAdviceMovesToAdviceRequestedAndSelectsNothing() {
        Case created = givenSentCase("POL-A1");

        CaseJourneyResponse journey =
                adviceService.requestAdvice(created.getCaseId(), MaturityOption.LUMP_SUM);

        assertThat(journey.retirementCase().getCaseStatus()).isEqualTo(CaseStatus.ADVICE_REQUESTED);
        assertThat(journey.retirementCase().getCustomerPreference()).isEqualTo(MaturityOption.LUMP_SUM);
        assertThat(journey.retirementCase().getMaturityOption()).isNull();
    }

    @Test
    void adviceCanBeRequestedWithoutAPreference() {
        Case created = givenSentCase("POL-A2");

        CaseJourneyResponse journey = adviceService.requestAdvice(created.getCaseId(), null);

        assertThat(journey.retirementCase().getCaseStatus()).isEqualTo(CaseStatus.ADVICE_REQUESTED);
        assertThat(journey.retirementCase().getCustomerPreference()).isNull();
    }

    @Test
    void acceptingALeadIsRecordedOnce() {
        Case created = givenSentCase("POL-A3");
        adviceService.requestAdvice(created.getCaseId(), null);

        adviceService.acceptLead(created.getCaseId(), "Broker A");
        Instant firstAccepted = caseService.getCase(created.getCaseId()).getLeadAcceptedAt();
        adviceService.acceptLead(created.getCaseId(), "Broker A");

        assertThat(firstAccepted).isNotNull();
        assertThat(caseService.getCase(created.getCaseId()).getLeadAcceptedAt()).isEqualTo(firstAccepted);
    }

    @Test
    void bookingAnAppointmentMovesToAppointmentBooked() {
        Case created = givenSentCase("POL-A4");
        adviceService.requestAdvice(created.getCaseId(), null);
        Instant when = Instant.now().plus(3, ChronoUnit.DAYS);

        CaseJourneyResponse journey =
                adviceService.bookAppointment(created.getCaseId(), when, "Broker A", "Telephone");

        assertThat(journey.retirementCase().getCaseStatus()).isEqualTo(CaseStatus.APPOINTMENT_BOOKED);
        assertThat(journey.retirementCase().getAppointmentAt()).isEqualTo(when);
        assertThat(journey.retirementCase().getLeadAcceptedAt()).isNotNull();
    }

    @Test
    void recordingAdviceSetsTheBindingOptionAndWaitsForFormalisation() {
        Case created = givenSentCase("POL-A5");
        adviceService.requestAdvice(created.getCaseId(), MaturityOption.LUMP_SUM);
        adviceService.bookAppointment(created.getCaseId(), Instant.now(), "Broker A", "Video");

        CaseJourneyResponse journey = adviceService.recordRecommendation(
                created.getCaseId(), MaturityOption.ANNUITY,
                "Income certainty mattered more than access.", "Broker A", "Video");

        Case advised = journey.retirementCase();
        // Advice comes before formalisation, so the case waits here for the pack.
        assertThat(advised.getCaseStatus()).isEqualTo(CaseStatus.IN_PROGRESS);
        assertThat(advised.getMaturityOption()).isEqualTo(MaturityOption.ANNUITY);
        assertThat(advised.getCustomerPreference()).isEqualTo(MaturityOption.LUMP_SUM);
        assertThat(advised.getAdviceRecord()).isNotNull();
        assertThat(advised.getAdviceRecord().getRecommendedOption()).isEqualTo(MaturityOption.ANNUITY);
        assertThat(advised.getAdviceRecord().getAdvisedBy()).isEqualTo("Broker A");
        assertThat(advised.getAdviceRecord().getRationale()).contains("Income certainty");
        assertThat(journey.outstandingDocuments()).hasSize(2);
    }

    @Test
    void rejectsAdviceWithoutARecommendedOption() {
        Case created = givenSentCase("POL-A6");

        assertThatThrownBy(() ->
                adviceService.recordRecommendation(created.getCaseId(), null, "why", "Broker A", "Telephone"))
                .isInstanceOf(InvalidCaseRequestException.class)
                .hasMessageContaining("recommendedOption is required");
    }

    @Test
    void completedCaseCannotBeReAdvised() {
        Case created = givenSentCase("POL-A7");
        adviceService.recordRecommendation(created.getCaseId(), MaturityOption.REINVEST,
                "why", "Broker A", "Telephone");
        journeyService.uploadDocument(created.getCaseId(), RequiredDocument.PASSPORT);
        journeyService.uploadDocument(created.getCaseId(), RequiredDocument.BANK_DETAILS);

        assertThatThrownBy(() ->
                adviceService.recordRecommendation(created.getCaseId(), MaturityOption.ANNUITY,
                        "why", "Broker A", "Telephone"))
                .isInstanceOf(InvalidCaseRequestException.class)
                .hasMessageContaining("already complete");
    }

    @Test
    void advisorCannotActOnACaseThatIsNotAtAnAdviceStage() {
        Case created = caseService.createCase(new CaseRequest(
                "Early case", CaseStatus.MATURITY_DETECTED, "30d", "BROKER", "desc", "POL-A8"));

        assertThatThrownBy(() -> adviceService.requestAdvice(created.getCaseId(), null))
                .isInstanceOf(InvalidCaseRequestException.class)
                .hasMessageContaining("not at an advice stage");
    }
}
