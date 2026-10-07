package com.example.demo.retirement.models;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regression tests for the sustainability flag.
 *
 * <p>The flag is unboxed to a primitive during sustainability scoring, so it
 * must never be {@code null} - that previously caused a NullPointerException
 * which surfaced as an opaque HTTP 500 with a {@code null} log message.</p>
 */
class RetirementYearPlanTest {

    @Test
    void noArgConstructorDefaultsSustainabilityToTrue() {
        RetirementYearPlan yearPlan = new RetirementYearPlan();

        assertNotNull(yearPlan.getIsSustainable(), "flag must never start as null");
        assertTrue(yearPlan.getIsSustainable());
    }

    @Test
    void fullConstructorDefaultsSustainabilityToTrue() {
        RetirementYearPlan yearPlan = new RetirementYearPlan(
                1,
                new BigDecimal("500000"),
                new BigDecimal("36000"),
                new BigDecimal("20000"),
                new BigDecimal("484000"));

        assertTrue(yearPlan.getIsSustainable());
    }

    @Test
    void settingNullFallsBackToTrueInsteadOfStoringNull() {
        RetirementYearPlan yearPlan = new RetirementYearPlan();

        yearPlan.setIsSustainable(null);

        assertNotNull(yearPlan.getIsSustainable());
        assertTrue(yearPlan.getIsSustainable());
    }

    @Test
    void falseIsPreserved() {
        RetirementYearPlan yearPlan = new RetirementYearPlan();

        yearPlan.setIsSustainable(false);

        assertFalse(yearPlan.getIsSustainable());
    }

    /** Guards the exact unboxing pattern used by the sustainability scorer. */
    @Test
    void flagCanBeUnboxedSafely() {
        RetirementYearPlan yearPlan = new RetirementYearPlan();

        assertDoesNotThrow(() -> {
            boolean unboxed = yearPlan.getIsSustainable();
            assertTrue(unboxed);
        });
    }
}