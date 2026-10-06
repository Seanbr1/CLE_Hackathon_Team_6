package com.example.demo.retirement.service;

import com.example.demo.retirement.api.dto.EfficiencyMetricsResponse;
import com.example.demo.retirement.models.Case;
import com.example.demo.retirement.models.CaseStatus;
import com.example.demo.retirement.models.JourneyEvent;
import com.example.demo.retirement.models.ProcessingLane;
import com.example.demo.retirement.repo.CaseRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

/**
 * Derives the operational efficiency measures for the maturity portfolio.
 *
 * <p>Everything here is counted from the live case store. The only assumption is
 * the legacy baseline, which is configurable and reported back to the caller so
 * it is never presented as a measured figure.</p>
 */
@Service
public class EfficiencyMetricsService {

    private static final Set<String> ADVICE_ACTIONS = Set.of(
            "ADVICE_REQUESTED", "LEAD_ACCEPTED", "APPOINTMENT_BOOKED", "ADVICE_COMPLETED");

    private final CaseRepository caseRepository;
    private final int baselineManualTouchpointsPerCase;

    public EfficiencyMetricsService(
            CaseRepository caseRepository,
            @Value("${retirement.efficiency.baseline-manual-touchpoints-per-case:9}")
            int baselineManualTouchpointsPerCase) {
        this.caseRepository = caseRepository;
        this.baselineManualTouchpointsPerCase = baselineManualTouchpointsPerCase;
    }

    public EfficiencyMetricsResponse calculate() {
        List<Case> cases = caseRepository.findAll();

        int total = cases.size();
        int green = countLane(cases, ProcessingLane.GREEN);
        int amber = countLane(cases, ProcessingLane.AMBER);
        int red = countLane(cases, ProcessingLane.RED);
        int classified = green + amber + red;
        int unclassified = total - classified;
        int completed = (int) cases.stream()
                .filter(item -> item.getCaseStatus() == CaseStatus.COMPLETED)
                .count();

        int automated = (int) cases.stream()
                .flatMap(item -> item.getJourneyEvents().stream())
                .filter(JourneyEvent::isAutomated)
                .count();
        List<JourneyEvent> manualEvents = cases.stream()
                .flatMap(item -> item.getJourneyEvents().stream())
                .filter(event -> !event.isAutomated())
                .toList();
        int manual = manualEvents.size();

        // Not all human effort is waste. Advice conversations are the value the
        // broker adds, and customer self-service replaces a call or a letter.
        // Only operational handling is what the journey model sets out to remove.
        int advice = (int) manualEvents.stream()
                .filter(EfficiencyMetricsService::isAdviceAction)
                .count();
        int selfService = (int) manualEvents.stream()
                .filter(event -> !isAdviceAction(event) && "Customer".equals(event.getActor()))
                .count();
        int operational = manual - advice - selfService;

        int baselineTotal = total * baselineManualTouchpointsPerCase;
        int avoided = Math.max(0, baselineTotal - operational);

        // Distribution measures: lead acceptance, appointment and advice rates.
        int leadsCreated = (int) cases.stream()
                .filter(item -> item.getJourneyEvents().stream()
                        .anyMatch(event -> "ACTION_MATURITY_05".equals(event.getAction())))
                .count();
        int leadsAccepted = (int) cases.stream()
                .filter(item -> item.getLeadAcceptedAt() != null)
                .count();
        int appointmentsBooked = (int) cases.stream()
                .filter(item -> item.getAppointmentAt() != null)
                .count();
        int adviceCompleted = (int) cases.stream()
                .filter(item -> item.getAdviceRecord() != null)
                .count();

        return new EfficiencyMetricsResponse(
                total,
                classified,
                unclassified,
                green,
                amber,
                red,
                completed,
                percentage(green, classified),
                percentage(red, classified),
                automated,
                manual,
                operational,
                advice,
                selfService,
                percentage(automated, automated + manual),
                baselineManualTouchpointsPerCase,
                baselineTotal,
                avoided,
                percentage(avoided, baselineTotal),
                leadsCreated,
                leadsAccepted,
                percentage(leadsAccepted, leadsCreated),
                appointmentsBooked,
                percentage(appointmentsBooked, leadsAccepted),
                adviceCompleted,
                percentage(adviceCompleted, leadsCreated),
                "Baseline is a configured assumption of "
                        + baselineManualTouchpointsPerCase
                        + " manual operational touchpoints per maturity in the current mailshot-driven "
                        + "process, not a measured figure. Advice conversations and customer self-service "
                        + "are counted separately because they are not operational handling."
        );
    }

    /** Advice and lead-handling actions performed by an intermediary or In-House Sales. */
    private static boolean isAdviceAction(JourneyEvent event) {
        return ADVICE_ACTIONS.contains(event.getAction());
    }

    private static int countLane(List<Case> cases, ProcessingLane lane) {
        return (int) cases.stream()
                .filter(item -> item.getProcessingLane() == lane)
                .count();
    }

    private static double percentage(int part, int whole) {
        if (whole <= 0) return 0d;
        return Math.round((part * 1000d) / whole) / 10d;
    }
}
