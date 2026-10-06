package com.example.demo.retirement.api.dto;

/**
 * Operational efficiency measures for the maturity portfolio.
 *
 * <p>Lane counts and touchpoints are measured from the live case store. The
 * baseline is a configured assumption about the legacy mailshot-driven process
 * and is returned alongside the figures so it can be shown as an assumption
 * rather than a measured result.</p>
 */
public record EfficiencyMetricsResponse(
        int totalCases,
        int classifiedCases,
        int unclassifiedCases,
        int greenCases,
        int amberCases,
        int redCases,
        int completedCases,
        double stpRatePercent,
        double exceptionRatePercent,
        int automatedTouchpoints,
        int manualTouchpoints,
        int operationalTouchpoints,
        int adviceTouchpoints,
        int selfServiceTouchpoints,
        double automationRatePercent,
        int baselineManualTouchpointsPerCase,
        int baselineManualTouchpoints,
        int manualTouchpointsAvoided,
        double manualEffortReductionPercent,
        int leadsCreated,
        int leadsAccepted,
        double leadAcceptanceRatePercent,
        int appointmentsBooked,
        double appointmentRatePercent,
        int adviceCompleted,
        double adviceCompletionRatePercent,
        String baselineNote
) {
}
