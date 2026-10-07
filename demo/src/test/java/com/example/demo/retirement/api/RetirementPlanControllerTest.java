package com.example.demo.retirement.api;

import com.example.demo.retirement.models.RetirementPlan;
import com.example.demo.retirement.models.RetirementPlanRequest;
import com.example.demo.retirement.service.RetirementPlanService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for RetirementPlanController.
 * Validates API endpoints and request/response handling.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RetirementPlanControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RetirementPlanService retirementPlanService;

    @Test
    void testHealthEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/retirement-plans/health"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Retirement Plan Service is running")))
                // AI is disabled in tests, so the deterministic path must be reported
                .andExpect(content().string(org.hamcrest.Matchers.containsString("RULE_BASED")));
    }

    @Test
    void testGenerateRetirementPlanFromStructuredRequest() throws Exception {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000"
        );
        request.setRetirementYears(30);

        String requestJson = objectMapper.writeValueAsString(request);

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.planId", notNullValue()))
                .andExpect(jsonPath("$.customerId", notNullValue()))
                .andExpect(jsonPath("$.desiredMonthlyPension").value(3000))
                .andExpect(jsonPath("$.pensionPot").value(500000))
                .andExpect(jsonPath("$.currency").value("EUR"))
                .andExpect(jsonPath("$.sustainabilityStatus", notNullValue()))
                .andExpect(jsonPath("$.yearlyPlans").isArray());
    }

    @Test
    void testGenerateRetirementPlanFromNaturalLanguageQuery() throws Exception {
        // Arrange
        String query = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature";

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.planId", notNullValue()))
                .andExpect(jsonPath("$.desiredMonthlyPension").value(3000))
                .andExpect(jsonPath("$.pensionPot").value(500000))
                .andExpect(jsonPath("$.yearsToMaturity").value(1))
                .andExpect(jsonPath("$.currency").value("EUR"));
    }

    @Test
    void testGeneratePlanWithUSDCurrency() throws Exception {
        // Arrange
        String query = "I want a pension of USD 4000 per month from USD 600,000 pot with 2 years to maturity";

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.desiredMonthlyPension").value(4000))
                .andExpect(jsonPath("$.pensionPot").value(600000))
                .andExpect(jsonPath("$.yearsToMaturity").value(2))
                .andExpect(jsonPath("$.currency").value("USD"));
    }

    @Test
    void testGeneratePlanWithGBPCurrency() throws Exception {
        // Arrange
        String query = "Help me with £2500 monthly pension from £400,000 savings, 3 years until maturity";

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.desiredMonthlyPension").value(2500))
                .andExpect(jsonPath("$.pensionPot").value(400000))
                .andExpect(jsonPath("$.currency").value("GBP"));
    }

    @Test
    void testQueryWithCommas() throws Exception {
        // Arrange
        String query = "I want 3,000 EUR monthly from 500,000 EUR pot, 1 year to maturity";

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.desiredMonthlyPension").value(3000))
                .andExpect(jsonPath("$.pensionPot").value(500000));
    }

    @Test
    void testEmptyQueryReturnsError() throws Exception {
        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", ""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMissingPensionAmountReturnsError() throws Exception {
        // Arrange
        String query = "I have a pension pot of 500,000 with 1 year to maturity";

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMissingPensionPotReturnsError() throws Exception {
        // Arrange
        String query = "I want 3000 EUR monthly pension with 1 year to maturity";

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testRetirementPlanContainsYearlyBreakdown() throws Exception {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("2000"),
            new BigDecimal("400000"),
            1,
            "Test"
        );
        request.setRetirementYears(10);

        String requestJson = objectMapper.writeValueAsString(request);

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.yearlyPlans[0].year").value(1))
                .andExpect(jsonPath("$.yearlyPlans[0].beginningBalance", notNullValue()))
                .andExpect(jsonPath("$.yearlyPlans[0].annualPensionWithdrawal", notNullValue()))
                .andExpect(jsonPath("$.yearlyPlans[0].investmentGain", notNullValue()))
                .andExpect(jsonPath("$.yearlyPlans[0].endingBalance", notNullValue()))
                .andExpect(jsonPath("$.yearlyPlans[0].aiRecommendation", notNullValue()))
                .andExpect(jsonPath("$.yearlyPlans[0].mixMatchOption", notNullValue()));
    }

    @Test
    void testRetirementPlanContainsAiInsights() throws Exception {
        // Arrange
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "Full test query"
        );

        String requestJson = objectMapper.writeValueAsString(request);

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.aiGeneratedInsights", notNullValue()))
                .andExpect(jsonPath("$.executiveSummary", notNullValue()))
                .andExpect(jsonPath("$.recommendedMaturityOption", notNullValue()));
    }

    @Test
    void testSustainablePlanStatus() throws Exception {
        // Arrange - Moderate pension from large pot
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("2000"),
            new BigDecimal("500000"),
            1,
            "Sustainable test"
        );
        request.setRetirementYears(20);

        String requestJson = objectMapper.writeValueAsString(request);

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sustainabilityStatus").value("SUSTAINABLE"));
    }

    @Test
    void testAtRiskPlanStatus() throws Exception {
        // Arrange - Very high pension from small pot
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("8000"),
            new BigDecimal("100000"),
            1,
            "At risk test"
        );
        request.setRetirementYears(25);

        String requestJson = objectMapper.writeValueAsString(request);

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sustainabilityStatus").value("AT_RISK"));
    }

    @Test
    void testVariousYearsToMaturity() throws Exception {
        // Test with 2 years to maturity
        String query1 = "I want EUR 3000 monthly from EUR 500000 pot with 2 years to maturity";
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.yearsToMaturity").value(2));

        // Test with 5 years to maturity
        String query5 = "EUR 3000 monthly pension, EUR 500000 pot, 5 years left until maturity";
        mockMvc.perform(post("/api/v1/retirement-plans/from-query")
                .param("query", query5))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.yearsToMaturity").value(5));
    }

    @Test
    void testMissingRequiredFieldsInStructuredRequest() throws Exception {
        // Arrange - Missing pension pot
        RetirementPlanRequest request = new RetirementPlanRequest();
        request.setDesiredMonthlyPension(new BigDecimal("3000"));
        request.setYearsToMaturity(1);

        String requestJson = objectMapper.writeValueAsString(request);

        // Act & Assert
        mockMvc.perform(post("/api/v1/retirement-plans")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isBadRequest());
    }
}