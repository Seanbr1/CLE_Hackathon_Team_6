package com.example.demo.retirement.ai;

import java.math.BigDecimal;

/**
 * Structured output returned by the LLM when it reads a partner's free-text
 * retirement query.
 *
 * <p>Spring AI maps the model's JSON response straight onto this record, which
 * replaces the hand-rolled string scanning previously used by the controller.
 * The LLM natively understands thousand separators, so {@code "EUR 500,000"}
 * arrives here as {@code 500000}.</p>
 *
 * @param desiredMonthlyPension  monthly income the customer asked for
 * @param pensionPot             current value of the pension pot
 * @param yearsToMaturity        years until the existing fund matures
 * @param currency               ISO-4217 code detected in the query (e.g. EUR)
 * @param retirementYears        how many years of retirement to project
 * @param wantsMixMatch          true when the customer asked for mix-match options
 * @param interpretationNote     short note on how the model read the request
 */
public record ParsedRetirementQuery(
        BigDecimal desiredMonthlyPension,
        BigDecimal pensionPot,
        Integer yearsToMaturity,
        String currency,
        Integer retirementYears,
        Boolean wantsMixMatch,
        String interpretationNote) {

    /** @return {@code true} when the model found the two mandatory money values. */
    public boolean isUsable() {
        return desiredMonthlyPension != null
                && desiredMonthlyPension.signum() > 0
                && pensionPot != null
                && pensionPot.signum() > 0;
    }
}