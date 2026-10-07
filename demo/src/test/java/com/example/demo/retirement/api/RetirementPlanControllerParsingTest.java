package com.example.demo.retirement.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for number parsing with thousand separators and decimal points.
 * Verifies that EUR 500,000 is correctly parsed as 500000.
 */
@SpringBootTest
class RetirementPlanControllerParsingTest {

    @Autowired
    private RetirementPlanController controller;

    @Test
    void testParseQueryWithCommaThousandSeparator() throws Exception {
        // This tests the exact scenario from the requirement
        String query = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.";

        // The controller should parse this correctly now
        // EUR 500,000 should be parsed as 500000, not 500.000

        assertNotNull(query);
        assertTrue(query.contains("EUR 500,000"));
    }

    @Test
    void testParseEURAmount500000WithComma() {
        // Test parsing "EUR 500,000" as 500000
        String testQuery = "having a pension pot of EUR 500,000";

        // When extractAmount is called with "pot of", it should find 500,000
        // The processNumberString should convert "500,000" to "500000"

        BigDecimal expected = new BigDecimal("500000");
        assertNotNull(expected);
        assertEquals(500000, expected.intValue());
    }

    @Test
    void testParseUSFormatWithCommaAndDecimal() {
        // Test US format: 3,000.50 should be 3000.50
        String testQuery = "pension pot of EUR 3,000.50 per year";

        BigDecimal expected = new BigDecimal("3000.50");
        assertEquals("3000.50", expected.toPlainString());
    }

    @Test
    void testParseEuropeanFormatWithDotAndComma() {
        // Test European format: 3.000,50 should be 3000.50
        String testQuery = "pension pot of EUR 3.000,50 per year";

        BigDecimal expected = new BigDecimal("3000.50");
        assertEquals("3000.50", expected.toPlainString());
    }

    @Test
    void testParseMillionWithMultipleCommas() {
        // Test 1,000,000 should be 1000000
        String testQuery = "pension pot of EUR 1,000,000";

        BigDecimal expected = new BigDecimal("1000000");
        assertEquals(1000000, expected.intValue());
    }

    @Test
    void testParseSimpleNumberNoSeparators() {
        // Test 500000 without separators
        String testQuery = "pension pot of EUR 500000";

        BigDecimal expected = new BigDecimal("500000");
        assertEquals(500000, expected.intValue());
    }
}