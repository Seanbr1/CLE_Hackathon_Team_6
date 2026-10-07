package com.example.demo.retirement.service;

import com.example.demo.retirement.models.MaturityOption;
import com.example.demo.retirement.models.RetirementPlan;
import com.example.demo.retirement.models.RetirementPlanRequest;
import com.example.demo.retirement.models.RetirementYearPlan;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for RetirementPlanService.
 * Validates retirement plan generation, AI recommendations, and sustainability analysis.
 */
@SpringBootTest
class RetirementPlanServiceTest {

    @Autowired
    private RetirementPlanService retirementPlanService;

    @Test
    void testGenerateBasicRetirementPlan() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "Test retirement query"
        );
        request.setRetirementYears(30);
        request.setAssumedInvestmentReturn(new BigDecimal("4.0"));
        request.setAssumedAnnualInflation(new BigDecimal("2.5"));

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertNotNull(plan);
        assertNotNull(plan.getPlanId());
        assertNotNull(plan.getCustomerId());
        assertEquals(new BigDecimal("3000"), plan.getDesiredMonthlyPension());
        assertEquals(new BigDecimal("500000"), plan.getPensionPot());
        assertEquals("EUR", plan.getCurrency());
        assertEquals(30, plan.getTotalRetirementYears());
    }

    @Test
    void testYearlyPlansGenerated() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "Test"
        );
        request.setRetirementYears(10);

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertNotNull(plan.getYearlyPlans());
        assertTrue(plan.getYearlyPlans().size() > 0);
        assertTrue(plan.getYearlyPlans().size() <= 10);

        // Verify first year
        RetirementYearPlan firstYear = plan.getYearlyPlans().get(0);
        assertEquals(1, firstYear.getYear());
        assertEquals(new BigDecimal("500000"), firstYear.getBeginningBalance());
    }

    @Test
    void testAiRecommendationsGenerated() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "Test"
        );
        request.setRetirementYears(15);

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertNotNull(plan.getYearlyPlans());
        for (RetirementYearPlan yearPlan : plan.getYearlyPlans()) {
            assertNotNull(yearPlan.getAiRecommendation());
            assertFalse(yearPlan.getAiRecommendation().isEmpty());
            assertTrue(yearPlan.getAiRecommendation().contains("Year"));
        }
    }

    @Test
    void testMixMatchOptionsAssigned() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("2000"),
            new BigDecimal("500000"),
            1,
            "Test"
        );
        request.setRetirementYears(30);

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        for (RetirementYearPlan yearPlan : plan.getYearlyPlans()) {
            assertNotNull(yearPlan.getMixMatchOption());
            assertTrue(yearPlan.getMixMatchOption().contains("REINVEST") ||
                      yearPlan.getMixMatchOption().contains("HYBRID") ||
                      yearPlan.getMixMatchOption().contains("INCOME_FOCUS") ||
                      yearPlan.getMixMatchOption().contains("ANNUITY"));
        }
    }

    @Test
    void testSustainabilityAnalysis() {
        // Arrange - Case 1: Sustainable plan
        RetirementPlanRequest sustainableRequest = new RetirementPlanRequest(
            new BigDecimal("2000"),
            new BigDecimal("500000"),
            1,
            "Test"
        );
        sustainableRequest.setRetirementYears(20);

        // Act
        RetirementPlan sustainablePlan = retirementPlanService.generateRetirementPlan(sustainableRequest);

        // Assert
        assertNotNull(sustainablePlan.getSustainabilityStatus());
        assertTrue(sustainablePlan.getSustainabilityStatus().equals("SUSTAINABLE") ||
                  sustainablePlan.getSustainabilityStatus().equals("MOSTLY_SUSTAINABLE"));
    }

    @Test
    void testUnsustainablePlan() {
        // Arrange - Very high pension from small pot
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("10000"),  // Very high monthly pension
            new BigDecimal("100000"),  // Small pot
            1,
            "Test"
        );
        request.setRetirementYears(30);

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertEquals("AT_RISK", plan.getSustainabilityStatus());
    }

    @Test
    void testRecommendedMaturityOption() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "Test"
        );

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertNotNull(plan.getRecommendedMaturityOption());
        assertTrue(plan.getRecommendedMaturityOption() == MaturityOption.ANNUITY ||
                  plan.getRecommendedMaturityOption() == MaturityOption.LUMP_SUM ||
                  plan.getRecommendedMaturityOption() == MaturityOption.REINVEST);
    }

    @Test
    void testExecutiveSummaryGenerated() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "Test"
        );

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertNotNull(plan.getExecutiveSummary());
        assertFalse(plan.getExecutiveSummary().isEmpty());
    }

    @Test
    void testAiInsightsGenerated() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "I want to retire with 3000 per month"
        );
        request.setRetirementYears(20);

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertNotNull(plan.getAiGeneratedInsights());
        assertFalse(plan.getAiGeneratedInsights().isEmpty());
        assertTrue(plan.getAiGeneratedInsights().contains("RETIREMENT PLAN ANALYSIS"));
        assertTrue(plan.getAiGeneratedInsights().contains("CUSTOMER PROFILE"));
        assertTrue(plan.getAiGeneratedInsights().contains("KEY RECOMMENDATIONS"));
    }

    @Test
    void testInflationAdjustment() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("1000"),
            new BigDecimal("100000"),
            1,
            "Test inflation adjustment"
        );
        request.setRetirementYears(5);
        request.setAssumedAnnualInflation(new BigDecimal("2.0"));

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        List<RetirementYearPlan> years = plan.getYearlyPlans();
        if (years.size() >= 2) {
            // Year 2 withdrawal should be higher than Year 1 due to inflation
            BigDecimal year1Withdrawal = years.get(0).getAdjustedAnnualWithdrawal();
            BigDecimal year2Withdrawal = years.get(1).getAdjustedAnnualWithdrawal();
            assertTrue(year2Withdrawal.compareTo(year1Withdrawal) > 0);
        }
    }

    @Test
    void testMissingParametersThrowException() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest();
        // Missing all required parameters

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> {
            retirementPlanService.generateRetirementPlan(request);
        });
    }

    @Test
    void testBalanceDecreasesCorrectly() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("2000"),
            new BigDecimal("500000"),
            1,
            "Test balance decrease"
        );
        request.setRetirementYears(30);

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        List<RetirementYearPlan> years = plan.getYearlyPlans();
        assertTrue(years.size() > 1);

        BigDecimal previousBalance = years.get(0).getBeginningBalance();
        for (int i = 1; i < Math.min(5, years.size()); i++) {
            BigDecimal currentBalance = years.get(i).getBeginningBalance();
            // Balance should generally decrease (or stay similar) due to withdrawals
            assertTrue(currentBalance.compareTo(previousBalance) <= 0 ||
                      currentBalance.compareTo(previousBalance.multiply(new BigDecimal("1.05"))) < 0);
        }
    }

    @Test
    void testTotalProjectionsCalculated() {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("2000"),
            new BigDecimal("500000"),
            1,
            "Test"
        );
        request.setRetirementYears(10);

        // Act
        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        // Assert
        assertNotNull(plan.getTotalProjectedIncome());
        assertNotNull(plan.getTotalProjectedWithdrawals());
        assertTrue(plan.getTotalProjectedIncome().compareTo(BigDecimal.ZERO) >= 0);
        assertTrue(plan.getTotalProjectedWithdrawals().compareTo(BigDecimal.ZERO) > 0);
    }
}