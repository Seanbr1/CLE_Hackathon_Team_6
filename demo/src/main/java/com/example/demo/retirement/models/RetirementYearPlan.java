package com.example.demo.retirement.models;

import java.math.BigDecimal;

/**
 * Represents a year's worth of retirement plan data.
 * Contains annual pension withdrawals, investment performance, and AI-generated recommendations.
 */
public class RetirementYearPlan {

    private Integer year;
    private BigDecimal beginningBalance;
    private BigDecimal annualPensionWithdrawal;
    private BigDecimal investmentGain;
    private BigDecimal endingBalance;
    private BigDecimal adjustedAnnualWithdrawal;
    private String aiRecommendation;
    private String mixMatchOption;
    /**
     * Defaults to {@code true} so callers that use the no-arg constructor never
     * expose a {@code null} here - unboxing it during sustainability scoring
     * would throw a NullPointerException.
     */
    private Boolean isSustainable = Boolean.TRUE;

    public RetirementYearPlan() {
    }

    public RetirementYearPlan(Integer year, BigDecimal beginningBalance, BigDecimal annualPensionWithdrawal,
                              BigDecimal investmentGain, BigDecimal endingBalance) {
        this.year = year;
        this.beginningBalance = beginningBalance;
        this.annualPensionWithdrawal = annualPensionWithdrawal;
        this.investmentGain = investmentGain;
        this.endingBalance = endingBalance;
        this.isSustainable = true;
    }

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public BigDecimal getBeginningBalance() {
        return beginningBalance;
    }

    public void setBeginningBalance(BigDecimal beginningBalance) {
        this.beginningBalance = beginningBalance;
    }

    public BigDecimal getAnnualPensionWithdrawal() {
        return annualPensionWithdrawal;
    }

    public void setAnnualPensionWithdrawal(BigDecimal annualPensionWithdrawal) {
        this.annualPensionWithdrawal = annualPensionWithdrawal;
    }

    public BigDecimal getInvestmentGain() {
        return investmentGain;
    }

    public void setInvestmentGain(BigDecimal investmentGain) {
        this.investmentGain = investmentGain;
    }

    public BigDecimal getEndingBalance() {
        return endingBalance;
    }

    public void setEndingBalance(BigDecimal endingBalance) {
        this.endingBalance = endingBalance;
    }

    public BigDecimal getAdjustedAnnualWithdrawal() {
        return adjustedAnnualWithdrawal;
    }

    public void setAdjustedAnnualWithdrawal(BigDecimal adjustedAnnualWithdrawal) {
        this.adjustedAnnualWithdrawal = adjustedAnnualWithdrawal;
    }

    public String getAiRecommendation() {
        return aiRecommendation;
    }

    public void setAiRecommendation(String aiRecommendation) {
        this.aiRecommendation = aiRecommendation;
    }

    public String getMixMatchOption() {
        return mixMatchOption;
    }

    public void setMixMatchOption(String mixMatchOption) {
        this.mixMatchOption = mixMatchOption;
    }

    public Boolean getIsSustainable() {
        return isSustainable;
    }

    public void setIsSustainable(Boolean sustainable) {
        // Never store null: downstream scoring unboxes this value.
        isSustainable = (sustainable == null) ? Boolean.TRUE : sustainable;
    }
}