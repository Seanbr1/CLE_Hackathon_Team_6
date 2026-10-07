package com.example.demo.retirement.ai;

import com.example.demo.retirement.models.RetirementPlan;
import com.example.demo.retirement.models.RetirementPlanRequest;
import com.example.demo.retirement.service.RetirementPlanService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Verifies the Spring AI integration degrades safely.
 *
 * <p>The test profile sets {@code spring.ai.model.chat=none} and
 * {@code retirement.ai.enabled=false}, so no live LLM call is made. The plan
 * must still be fully populated through the deterministic fallback.</p>
 */
@SpringBootTest
class RetirementAiAdvisorFallbackTest {

    @Autowired
    private RetirementAiAdvisor advisor;

    @Autowired
    private RetirementPlanService retirementPlanService;

    @Test
    void advisorIsUnavailableWhenNoChatModelConfigured() {
        assertFalse(advisor.isAvailable(), "No ChatModel is configured in the test profile");
    }

    @Test
    void parseQueryReturnsEmptyWhenAiDisabled() {
        assertTrue(advisor.parseQuery("I want EUR 3000 per month from EUR 500,000").isEmpty());
    }

    @Test
    void generateNarrativeReturnsEmptyWhenAiDisabled() {
        RetirementPlan plan = new RetirementPlan("p1", "c1",
                new BigDecimal("3000"), new BigDecimal("500000"), 1);
        assertTrue(advisor.generateNarrative(plan, "any query").isEmpty());
    }

    @Test
    void planStillFullyPopulatedViaFallback() {
        RetirementPlanRequest request = new RetirementPlanRequest(
                new BigDecimal("3000"),
                new BigDecimal("500000"),
                1,
                "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000");
        request.setRetirementYears(10);

        RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);

        assertEquals("RULE_BASED", plan.getInsightSource());
        assertNotNull(plan.getExecutiveSummary());
        assertNotNull(plan.getAiGeneratedInsights());
        assertNotNull(plan.getRecommendedMaturityOption());
        assertFalse(plan.getYearlyPlans().isEmpty());

        plan.getYearlyPlans().forEach(year -> {
            assertNotNull(year.getAiRecommendation(), "every year needs guidance");
            assertFalse(year.getAiRecommendation().isBlank());
            assertNotNull(year.getMixMatchOption(), "every year needs a mix-match label");
            assertFalse(year.getMixMatchOption().isBlank());
        });
    }
}