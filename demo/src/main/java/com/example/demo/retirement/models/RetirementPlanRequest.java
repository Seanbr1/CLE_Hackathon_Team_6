package com.example.demo.retirement.models;

import java.math.BigDecimal;

/**
 * Request model for retirement plan generation.
 * Contains pension details and customer preferences to generate a personalized retirement plan.
 */
public class RetirementPlanRequest {

    private BigDecimal desiredMonthlyPension;
    private BigDecimal pensionPot;
    private Integer yearsToMaturity;
    private String customerQuery;
    private MaturityOption preferredMaturityOption;
    private String currency;
    private Integer retirementYears;
    private BigDecimal assumedAnnualInflation;
    private BigDecimal assumedInvestmentReturn;

    public RetirementPlanRequest() {
    }

    public RetirementPlanRequest(BigDecimal desiredMonthlyPension, BigDecimal pensionPot,
                                 Integer yearsToMaturity, String customerQuery) {
        this.desiredMonthlyPension = desiredMonthlyPension;
        this.pensionPot = pensionPot;
        this.yearsToMaturity = yearsToMaturity;
        this.customerQuery = customerQuery;
        this.currency = "EUR";
        this.retirementYears = 30;
        this.assumedAnnualInflation = new BigDecimal("2.5");
        this.assumedInvestmentReturn = new BigDecimal("4.0");
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

    public String getCustomerQuery() {
        return customerQuery;
    }

    public void setCustomerQuery(String customerQuery) {
        this.customerQuery = customerQuery;
    }

    public MaturityOption getPreferredMaturityOption() {
        return preferredMaturityOption;
    }

    public void setPreferredMaturityOption(MaturityOption preferredMaturityOption) {
        this.preferredMaturityOption = preferredMaturityOption;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Integer getRetirementYears() {
        return retirementYears;
    }

    public void setRetirementYears(Integer retirementYears) {
        this.retirementYears = retirementYears;
    }

    public BigDecimal getAssumedAnnualInflation() {
        return assumedAnnualInflation;
    }

    public void setAssumedAnnualInflation(BigDecimal assumedAnnualInflation) {
        this.assumedAnnualInflation = assumedAnnualInflation;
    }

    public BigDecimal getAssumedInvestmentReturn() {
        return assumedInvestmentReturn;
    }

    public void setAssumedInvestmentReturn(BigDecimal assumedInvestmentReturn) {
        this.assumedInvestmentReturn = assumedInvestmentReturn;
    }
}