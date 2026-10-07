package com.example.demo.retirement.models;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Complete retirement plan response containing year-by-year breakdown.
 * Includes AI-generated recommendations and sustainability analysis.
 */
public class RetirementPlan {

    private String planId;
    private String customerId;
    private BigDecimal desiredMonthlyPension;
    private BigDecimal pensionPot;
    private Integer yearsToMaturity;
    private String currency;
    private Integer totalRetirementYears;
    private MaturityOption recommendedMaturityOption;
    private String executiveSummary;
    private BigDecimal totalProjectedIncome;
    private BigDecimal totalProjectedWithdrawals;
    private String sustainabilityStatus;
    private final List<RetirementYearPlan> yearlyPlans = new ArrayList<>();
    private String aiGeneratedInsights;
    /** Where the narrative came from: {@code AI} (Spring AI / OpenAI) or {@code RULE_BASED}. */
    private String insightSource;
    /** How the model read the request; only populated when AI parsing was used. */
    private String queryInterpretation;

    public RetirementPlan() {
    }

    public RetirementPlan(String planId, String customerId, BigDecimal desiredMonthlyPension,
                          BigDecimal pensionPot, Integer yearsToMaturity) {
        this.planId = planId;
        this.customerId = customerId;
        this.desiredMonthlyPension = desiredMonthlyPension;
        this.pensionPot = pensionPot;
        this.yearsToMaturity = yearsToMaturity;
        this.currency = "EUR";
        this.totalRetirementYears = 30;
    }

    public String getPlanId() {
        return planId;
    }

    public void setPlanId(String planId) {
        this.planId = planId;
    }

    public String getCustomerId() {
        return customerId;
    }

    public void setCustomerId(String customerId) {
        this.customerId = customerId;
    }

    public BigDecimal getDesiredMonthlyPension() {
        return desiredMonthlyPension;
    }

    public void setDesiredMonthlyPension(BigDecimal desiredMonthlyPension) {
        this.desiredMonthlyPension = desiredMonthlyPension;
    }

    public BigDecimal getPensionPot() {
        return pensionPot;
    }

    public void setPensionPot(BigDecimal pensionPot) {
        this.pensionPot = pensionPot;
    }

    public Integer getYearsToMaturity() {
        return yearsToMaturity;
    }

    public void setYearsToMaturity(Integer yearsToMaturity) {
        this.yearsToMaturity = yearsToMaturity;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Integer getTotalRetirementYears() {
        return totalRetirementYears;
    }

    public void setTotalRetirementYears(Integer totalRetirementYears) {
        this.totalRetirementYears = totalRetirementYears;
    }

    public MaturityOption getRecommendedMaturityOption() {
        return recommendedMaturityOption;
    }

    public void setRecommendedMaturityOption(MaturityOption recommendedMaturityOption) {
        this.recommendedMaturityOption = recommendedMaturityOption;
    }

    public String getExecutiveSummary() {
        return executiveSummary;
    }

    public void setExecutiveSummary(String executiveSummary) {
        this.executiveSummary = executiveSummary;
    }

    public BigDecimal getTotalProjectedIncome() {
        return totalProjectedIncome;
    }

    public void setTotalProjectedIncome(BigDecimal totalProjectedIncome) {
        this.totalProjectedIncome = totalProjectedIncome;
    }

    public BigDecimal getTotalProjectedWithdrawals() {
        return totalProjectedWithdrawals;
    }

    public void setTotalProjectedWithdrawals(BigDecimal totalProjectedWithdrawals) {
        this.totalProjectedWithdrawals = totalProjectedWithdrawals;
    }

    public String getSustainabilityStatus() {
        return sustainabilityStatus;
    }

    public void setSustainabilityStatus(String sustainabilityStatus) {
        this.sustainabilityStatus = sustainabilityStatus;
    }

    public List<RetirementYearPlan> getYearlyPlans() {
        return yearlyPlans;
    }

    public void addYearlyPlan(RetirementYearPlan yearlyPlan) {
        if (yearlyPlan != null) {
            this.yearlyPlans.add(yearlyPlan);
        }
    }

    public String getAiGeneratedInsights() {
        return aiGeneratedInsights;
    }

    public void setAiGeneratedInsights(String aiGeneratedInsights) {
        this.aiGeneratedInsights = aiGeneratedInsights;
    }

    public String getInsightSource() {
        return insightSource;
    }

    public void setInsightSource(String insightSource) {
        this.insightSource = insightSource;
    }

    public String getQueryInterpretation() {
        return queryInterpretation;
    }

    public void setQueryInterpretation(String queryInterpretation) {
        this.queryInterpretation = queryInterpretation;
    }
}