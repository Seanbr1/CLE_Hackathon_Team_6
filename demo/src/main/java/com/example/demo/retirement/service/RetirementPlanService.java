package com.example.demo.retirement.service;

import com.example.demo.retirement.ai.AiRetirementNarrative;
import com.example.demo.retirement.ai.RetirementAiAdvisor;
import com.example.demo.retirement.models.RetirementPlan;
import com.example.demo.retirement.models.RetirementPlanRequest;
import com.example.demo.retirement.models.RetirementYearPlan;
import com.example.demo.retirement.models.MaturityOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import java.util.UUID;

/**
 * Service responsible for generating retirement plans.
 *
 * <p>Cash-flow projection stays deterministic in Java (money must be
 * reproducible and auditable), while all narrative content - the executive
 * summary, overall insights, per-year guidance and mix-match labels - is
 * produced by Spring AI via {@link RetirementAiAdvisor}. If no chat model is
 * configured the service falls back to the original rule-based wording so the
 * API contract never changes.</p>
 */
@Service
@Slf4j
public class RetirementPlanService {

    private final RetirementAiAdvisor aiAdvisor;

    public RetirementPlanService(RetirementAiAdvisor aiAdvisor) {
        this.aiAdvisor = aiAdvisor;
    }

    public RetirementPlan generateRetirementPlan(RetirementPlanRequest request) {
        // Validate input
        if (request.getDesiredMonthlyPension() == null ||
            request.getPensionPot() == null ||
            request.getYearsToMaturity() == null) {
            throw new IllegalArgumentException("Missing required retirement plan parameters");
        }

        // Create the retirement plan
        String planId = UUID.randomUUID().toString();
        String customerId = UUID.randomUUID().toString();

        RetirementPlan plan = new RetirementPlan(
            planId,
            customerId,
            request.getDesiredMonthlyPension(),
            request.getPensionPot(),
            request.getYearsToMaturity()
        );

        // Set additional parameters
        plan.setCurrency(request.getCurrency() != null ? request.getCurrency() : "EUR");
        plan.setTotalRetirementYears(request.getRetirementYears() != null ? request.getRetirementYears() : 30);

        // Deterministic maths: year-by-year cash-flow projection
        generateYearlyPlans(plan, request);

        // Sustainability rating is derived from the projection, not from the model
        calculateSustainability(plan);

        // Narrative: Spring AI first, deterministic templates as fallback
        enrichWithNarrative(plan, request);

        return plan;
    }

    /**
     * Generates the narrative part of the plan using Spring AI, falling back to
     * the deterministic rule-based wording when no chat model is available or
     * the call fails.
     */
    private void enrichWithNarrative(RetirementPlan plan, RetirementPlanRequest request) {
        Optional<AiRetirementNarrative> narrative =
                aiAdvisor.generateNarrative(plan, request.getCustomerQuery());

        if (narrative.isPresent()) {
            applyAiNarrative(plan, narrative.get());
            plan.setInsightSource("AI");
            log.debug("Retirement plan {} enriched with Spring AI narrative", plan.getPlanId());
            return;
        }

        applyFallbackNarrative(plan, request);
        plan.setInsightSource("RULE_BASED");
    }

    /** Copies LLM-generated wording onto the plan and its yearly rows. */
    private void applyAiNarrative(RetirementPlan plan, AiRetirementNarrative narrative) {
        if (hasText(narrative.executiveSummary())) {
            plan.setExecutiveSummary(narrative.executiveSummary());
        }
        if (hasText(narrative.overallInsights())) {
            plan.setAiGeneratedInsights(narrative.overallInsights());
        }
        plan.setRecommendedMaturityOption(resolveMaturityOption(narrative.recommendedMaturityOption()));

        for (RetirementYearPlan yearPlan : plan.getYearlyPlans()) {
            AiRetirementNarrative.AiYearNarrative yearNarrative = narrative.narrativeForYear(yearPlan.getYear());
            if (yearNarrative == null) {
                continue;
            }
            if (hasText(yearNarrative.recommendation())) {
                yearPlan.setAiRecommendation(yearNarrative.recommendation());
            }
            if (hasText(yearNarrative.mixMatchOption())) {
                yearPlan.setMixMatchOption(yearNarrative.mixMatchOption());
            }
        }

        // Guarantee every row has wording even if the model skipped a year.
        backfillMissingYearNarratives(plan);
    }

    /** Fills any gaps the model left so the response is always complete. */
    private void backfillMissingYearNarratives(RetirementPlan plan) {
        for (RetirementYearPlan yearPlan : plan.getYearlyPlans()) {
            if (!hasText(yearPlan.getAiRecommendation())) {
                yearPlan.setAiRecommendation(generateAiRecommendationForYear(
                        yearPlan, yearPlan.getYear(), plan.getTotalRetirementYears()));
            }
            if (!hasText(yearPlan.getMixMatchOption())) {
                yearPlan.setMixMatchOption(assignMixMatchOption(
                        yearPlan.getEndingBalance(), plan.getPensionPot()));
            }
        }
    }

    /** Original deterministic wording, used when the LLM is unavailable. */
    private void applyFallbackNarrative(RetirementPlan plan, RetirementPlanRequest request) {
        for (RetirementYearPlan yearPlan : plan.getYearlyPlans()) {
            yearPlan.setAiRecommendation(generateAiRecommendationForYear(
                    yearPlan, yearPlan.getYear(), plan.getTotalRetirementYears()));
            yearPlan.setMixMatchOption(assignMixMatchOption(
                    yearPlan.getEndingBalance(), plan.getPensionPot()));
        }
        generateAiInsights(plan, request);
        determineRecommendedMaturityOption(plan, request);
        plan.setExecutiveSummary("Your retirement plan has been analyzed and rated as: "
                + plan.getSustainabilityStatus()
                + ". Review the detailed year-by-year breakdown for specific recommendations.");
    }

    /** Maps the model's free-text option onto the {@link MaturityOption} enum. */
    private MaturityOption resolveMaturityOption(String value) {
        if (!hasText(value)) {
            return null;
        }
        String normalised = value.trim().toUpperCase().replace(' ', '_');
        for (MaturityOption option : MaturityOption.values()) {
            if (normalised.startsWith(option.name())) {
                return option;
            }
        }
        return null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * Generates year-by-year retirement plan projections.
     */
    private void generateYearlyPlans(RetirementPlan plan, RetirementPlanRequest request) {
        // Every monetary figure is rounded to 2 decimal places before it leaves
        // this method. Without it, repeated multiplication compounds the scale
        // and the API emits values with hundreds of decimal digits.
        BigDecimal balance = money(request.getPensionPot());
        BigDecimal annualWithdrawal = money(request.getDesiredMonthlyPension().multiply(new BigDecimal("12")));
        BigDecimal investmentReturn = request.getAssumedInvestmentReturn() != null ?
            request.getAssumedInvestmentReturn() : new BigDecimal("4.0");
        BigDecimal inflation = request.getAssumedAnnualInflation() != null ?
            request.getAssumedAnnualInflation() : new BigDecimal("2.5");

        BigDecimal totalWithdrawals = BigDecimal.ZERO;
        BigDecimal totalInvestmentGain = BigDecimal.ZERO;

        for (int year = 1; year <= plan.getTotalRetirementYears(); year++) {
            RetirementYearPlan yearPlan = new RetirementYearPlan();
            yearPlan.setYear(year);
            yearPlan.setBeginningBalance(balance);

            // Calculate investment gain
            BigDecimal gain = money(
                balance.multiply(investmentReturn.divide(new BigDecimal("100"), 10, RoundingMode.HALF_UP)));
            yearPlan.setInvestmentGain(gain);
            totalInvestmentGain = totalInvestmentGain.add(gain);

            // Calculate adjusted withdrawal (for inflation after first year)
            BigDecimal adjustedWithdrawal = annualWithdrawal;
            if (year > 1) {
                BigDecimal inflationMultiplier = new BigDecimal("1").add(
                    inflation.divide(new BigDecimal("100"), 10, RoundingMode.HALF_UP)
                ).pow(year - 1);
                adjustedWithdrawal = money(annualWithdrawal.multiply(inflationMultiplier));
            }

            yearPlan.setAdjustedAnnualWithdrawal(adjustedWithdrawal);
            yearPlan.setAnnualPensionWithdrawal(adjustedWithdrawal);
            totalWithdrawals = totalWithdrawals.add(adjustedWithdrawal);

            // Calculate ending balance
            BigDecimal endingBalance = money(balance.add(gain).subtract(adjustedWithdrawal));

            if (endingBalance.compareTo(BigDecimal.ZERO) < 0) {
                endingBalance = BigDecimal.ZERO.setScale(2);
                yearPlan.setIsSustainable(false);
            }

            yearPlan.setEndingBalance(endingBalance);

            // Narrative (recommendation + mix-match label) is attached later by
            // enrichWithNarrative(), so this loop stays purely numeric.

            plan.addYearlyPlan(yearPlan);
            balance = endingBalance;

            // Stop if balance is depleted
            if (endingBalance.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }
        }

        plan.setTotalProjectedWithdrawals(money(totalWithdrawals));
        plan.setTotalProjectedIncome(money(totalInvestmentGain));
    }

    /** Rounds a monetary amount to 2 decimal places, half-up. */
    private BigDecimal money(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Generates AI-powered recommendation for a specific year in the retirement plan.
     */
    private String generateAiRecommendationForYear(RetirementYearPlan yearPlan, int year, int totalYears) {
        StringBuilder recommendation = new StringBuilder();

        if (year < totalYears / 3) {
            // Early retirement years - focus on growth
            recommendation.append("Year ").append(year).append(": Early retirement phase. ");
            recommendation.append("Current balance is strong at ").append(yearPlan.getBeginningBalance()).append(". ");
            recommendation.append("Maintain aggressive investment allocation (60-70% equities) to maximize growth. ");
            recommendation.append("Consider reinvesting part of gains to counter inflation. ");
            recommendation.append("Your pension withdrawal is sustainable.");
        } else if (year < (2 * totalYears / 3)) {
            // Mid retirement years - balance growth and income
            recommendation.append("Year ").append(year).append(": Mid-retirement phase. ");
            recommendation.append("Current balance: ").append(yearPlan.getBeginningBalance()).append(". ");
            recommendation.append("Shift to moderate allocation (40-50% equities, 50-60% bonds). ");
            recommendation.append("This balanced approach provides income stability while maintaining some growth potential. ");
            recommendation.append("Monitor market conditions and adjust as needed.");
        } else {
            // Late retirement years - focus on preservation
            recommendation.append("Year ").append(year).append(": Late retirement phase. ");
            recommendation.append("Current balance: ").append(yearPlan.getBeginningBalance()).append(". ");
            recommendation.append("Consider conservative allocation (20-30% equities, 70-80% fixed income). ");
            recommendation.append("Focus on capital preservation while ensuring sufficient income. ");

            if (Boolean.TRUE.equals(yearPlan.getIsSustainable())) {
                recommendation.append("Your plan remains sustainable at current withdrawal rates.");
            } else {
                recommendation.append("WARNING: Consider reducing withdrawal amounts in future years.");
            }
        }

        return recommendation.toString();
    }

    /**
     * Assigns a mix-match option based on current financial status.
     */
    private String assignMixMatchOption(BigDecimal currentBalance, BigDecimal initialPot) {
        if (currentBalance.compareTo(BigDecimal.ZERO) <= 0) {
            return "ANNUITY - Recommend switching to annuity for guaranteed income";
        }

        BigDecimal percentageRemaining = currentBalance.divide(initialPot, 4, RoundingMode.HALF_UP)
            .multiply(new BigDecimal("100"));

        if (percentageRemaining.compareTo(new BigDecimal("75")) > 0) {
            return "REINVEST - Strong balance. Continue reinvestment strategy with growth allocation";
        } else if (percentageRemaining.compareTo(new BigDecimal("50")) > 0) {
            return "HYBRID - Mixed approach: 60% reinvest with 40% drawdown for income";
        } else if (percentageRemaining.compareTo(new BigDecimal("25")) > 0) {
            return "INCOME_FOCUS - Shift to income generation with moderate growth (40/60)";
        } else {
            return "ANNUITY - Low balance remaining. Consider annuity or drawdown reduction";
        }
    }

    /**
     * Generates AI-powered insights for the entire retirement plan.
     */
    private void generateAiInsights(RetirementPlan plan, RetirementPlanRequest request) {
        StringBuilder insights = new StringBuilder();

        insights.append("RETIREMENT PLAN ANALYSIS FOR: ").append(request.getCustomerQuery()).append("\n\n");

        insights.append("CUSTOMER PROFILE:\n");
        insights.append("- Desired Monthly Pension: ").append(plan.getCurrency()).append(" ")
            .append(plan.getDesiredMonthlyPension()).append("\n");
        insights.append("- Current Pension Pot: ").append(plan.getCurrency()).append(" ")
            .append(plan.getPensionPot()).append("\n");
        insights.append("- Years to Maturity: ").append(plan.getYearsToMaturity()).append("\n");
        insights.append("- Projected Retirement Duration: ").append(plan.getTotalRetirementYears()).append(" years\n\n");

        insights.append("ANALYSIS:\n");

        // Calculate sustainability
        BigDecimal requiredInitialBalance = calculateRequiredBalance(plan.getDesiredMonthlyPension(),
            plan.getTotalRetirementYears());

        if (plan.getPensionPot().compareTo(requiredInitialBalance) > 0) {
            insights.append("✓ Your pension pot appears sufficient for your desired pension amount.\n");
            BigDecimal surplus = plan.getPensionPot().subtract(requiredInitialBalance);
            insights.append("  Surplus available for additional strategies: ").append(plan.getCurrency())
                .append(" ").append(surplus).append("\n\n");
        } else {
            insights.append("⚠ Your current pension pot may not sustain your desired monthly pension over ")
                .append(plan.getTotalRetirementYears()).append(" years.\n");
            insights.append("  Consider: reducing pension amount, working longer, or extending drawdown period.\n\n");
        }

        insights.append("RECOMMENDED MIX-MATCH STRATEGY:\n");
        insights.append("1. Years 1-10: REINVEST + HYBRID\n");
        insights.append("   - Maintain growth through equity exposure (60-70%)\n");
        insights.append("   - Systematically withdraw for living expenses\n");
        insights.append("   - Allows continued capital appreciation\n\n");

        insights.append("2. Years 11-20: HYBRID + INCOME_FOCUS\n");
        insights.append("   - Gradually reduce equity allocation (40-50%)\n");
        insights.append("   - Increase fixed income exposure for stability\n");
        insights.append("   - Rebalance annually to manage risk\n\n");

        insights.append("3. Years 21+: INCOME_FOCUS + ANNUITY\n");
        insights.append("   - Conservative allocation (20-30% equities)\n");
        insights.append("   - Consider partial annuity purchase for guaranteed income\n");
        insights.append("   - Ensures capital preservation for final years\n\n");

        insights.append("KEY RECOMMENDATIONS:\n");
        insights.append("• Review this plan annually and adjust for market performance\n");
        insights.append("• Consider working 1-2 additional years if markets perform poorly\n");
        insights.append("• Maintain emergency fund equivalent to 2-3 years of withdrawals\n");
        insights.append("• Review insurance needs and update beneficiaries\n");
        insights.append("• Consider tax-efficient withdrawal strategies\n");

        plan.setAiGeneratedInsights(insights.toString());
    }

    /**
     * Determines the recommended maturity option based on financial analysis.
     */
    private void determineRecommendedMaturityOption(RetirementPlan plan, RetirementPlanRequest request) {
        if (request.getPreferredMaturityOption() != null) {
            plan.setRecommendedMaturityOption(request.getPreferredMaturityOption());
        } else {
            // AI logic to determine best option
            BigDecimal potSize = plan.getPensionPot();
            BigDecimal desiredIncome = plan.getDesiredMonthlyPension().multiply(new BigDecimal("12"));
            BigDecimal incomeReplacementRatio = desiredIncome.divide(potSize, 4, RoundingMode.HALF_UP);

            if (incomeReplacementRatio.compareTo(new BigDecimal("0.05")) > 0) {
                // High income need relative to pot size
                plan.setRecommendedMaturityOption(MaturityOption.ANNUITY);
            } else if (incomeReplacementRatio.compareTo(new BigDecimal("0.03")) > 0) {
                // Moderate income need
                plan.setRecommendedMaturityOption(MaturityOption.LUMP_SUM);
            } else {
                // Low income need, focus on growth
                plan.setRecommendedMaturityOption(MaturityOption.REINVEST);
            }
        }
    }

    /**
     * Calculates sustainability of the retirement plan.
     */
    private void calculateSustainability(RetirementPlan plan) {
        // Boolean.TRUE.equals(...) avoids unboxing a null flag.
        boolean allYearsSustainable = plan.getYearlyPlans().stream()
            .allMatch(year -> Boolean.TRUE.equals(year.getIsSustainable()));

        if (allYearsSustainable && !plan.getYearlyPlans().isEmpty()) {
            plan.setSustainabilityStatus("SUSTAINABLE");
        } else if (plan.getYearlyPlans().isEmpty()) {
            plan.setSustainabilityStatus("UNKNOWN");
        } else {
            // Check if at least 80% of years are sustainable
            long sustainableYears = plan.getYearlyPlans().stream()
                .filter(year -> Boolean.TRUE.equals(year.getIsSustainable()))
                .count();

            double percentage = (double) sustainableYears / plan.getYearlyPlans().size() * 100;
            if (percentage >= 80) {
                plan.setSustainabilityStatus("MOSTLY_SUSTAINABLE");
            } else {
                plan.setSustainabilityStatus("AT_RISK");
            }
        }
    }

    /**
     * Calculates the required initial balance to sustain desired pension over retirement years.
     * Uses present value calculation with assumed investment return.
     */
    private BigDecimal calculateRequiredBalance(BigDecimal monthlyPension, Integer retirementYears) {
        BigDecimal annualPension = monthlyPension.multiply(new BigDecimal("12"));
        BigDecimal discountRate = new BigDecimal("0.04"); // 4% assumed return
        BigDecimal presentValue = BigDecimal.ZERO;

        for (int i = 1; i <= retirementYears; i++) {
            BigDecimal discountFactor = new BigDecimal("1").add(discountRate).pow(i);
            presentValue = presentValue.add(annualPension.divide(discountFactor, 2, RoundingMode.HALF_UP));
        }

        return presentValue.setScale(2, RoundingMode.HALF_UP);
    }
}