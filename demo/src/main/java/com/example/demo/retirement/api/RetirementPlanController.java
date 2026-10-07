package com.example.demo.retirement.api;

import com.example.demo.retirement.ai.ParsedRetirementQuery;
import com.example.demo.retirement.ai.RetirementAiAdvisor;
import com.example.demo.retirement.models.RetirementPlan;
import com.example.demo.retirement.models.RetirementPlanRequest;
import com.example.demo.retirement.service.RetirementPlanService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * REST API Controller for retirement planning services.
 * Handles requests to generate AI-powered retirement plans based on customer queries.
 *
 * Example query:
 * POST /api/v1/retirement-plans
 * {
 *   "desiredMonthlyPension": 3000,
 *   "pensionPot": 500000,
 *   "yearsToMaturity": 1,
 *   "customerQuery": "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.",
 *   "currency": "EUR",
 *   "retirementYears": 30,
 *   "assumedAnnualInflation": 2.5,
 *   "assumedInvestmentReturn": 4.0
 * }
 */
@RestController
@RequestMapping("/api/v1/retirement-plans")
@Slf4j
public class RetirementPlanController {

    private final RetirementPlanService retirementPlanService;
    private final RetirementAiAdvisor aiAdvisor;

    public RetirementPlanController(RetirementPlanService retirementPlanService,
                                    RetirementAiAdvisor aiAdvisor) {
        this.retirementPlanService = retirementPlanService;
        this.aiAdvisor = aiAdvisor;
    }

    /**
     * Generates a comprehensive AI-powered retirement plan based on customer requirements.
     *
     * @param request Retirement plan request containing pension details and customer query
     * @return ResponseEntity containing the generated retirement plan with year-by-year breakdown
     */
    @PostMapping
    public ResponseEntity<RetirementPlan> generateRetirementPlan(@RequestBody RetirementPlanRequest request) {
        try {
            RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(plan);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid retirement plan request: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error generating retirement plan", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Parses customer query string and generates a retirement plan.
     *
     * Supports query string format like:
     * "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000
     *  with 1 year left for existing pension fund to mature"
     *
     * @param query Natural language query string from customer
     * @return ResponseEntity containing the generated retirement plan
     */
    @PostMapping("/from-query")
    public ResponseEntity<RetirementPlan> generateRetirementPlanFromQuery(@RequestParam String query) {
        try {
            RetirementPlanRequest request = parseCustomerQuery(query);
            RetirementPlan plan = retirementPlanService.generateRetirementPlan(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(plan);
        } catch (IllegalArgumentException e) {
            log.warn("Could not parse customer query: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            // Log the stack trace: some exceptions (e.g. NullPointerException)
            // carry no message, which would otherwise log as "null".
            log.error("Error generating retirement plan from query", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Health check endpoint for retirement plan service.
     *
     * @return Simple response indicating service state and whether Spring AI is wired up
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        String aiState = aiAdvisor.isAvailable() ? "AI (Spring AI chat model active)" : "RULE_BASED (no chat model)";
        return ResponseEntity.ok("Retirement Plan Service is running | insights=" + aiState);
    }

    /**
     * Parses natural language customer query to extract retirement planning parameters.
     *
     * <p>Primary path is Spring AI: the LLM reads the sentence and returns a
     * structured {@link ParsedRetirementQuery}, which natively understands
     * thousand separators such as {@code "EUR 500,000"}. When no chat model is
     * configured, or the model call fails, the deterministic string parser below
     * is used instead so the endpoint keeps working offline.</p>
     *
     * @param query Customer query string
     * @return RetirementPlanRequest with parsed parameters
     */
    private RetirementPlanRequest parseCustomerQuery(String query) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Query cannot be empty");
        }

        Optional<ParsedRetirementQuery> aiParsed = aiAdvisor.parseQuery(query);
        if (aiParsed.isPresent()) {
            log.debug("Query parsed by Spring AI");
            return toRequest(query, aiParsed.get());
        }

        log.debug("Query parsed by rule-based fallback parser");
        return parseCustomerQueryWithRules(query);
    }

    /** Maps the LLM's structured answer onto the service request, filling defaults. */
    private RetirementPlanRequest toRequest(String query, ParsedRetirementQuery parsed) {
        RetirementPlanRequest request = new RetirementPlanRequest();
        request.setCustomerQuery(query);
        request.setDesiredMonthlyPension(parsed.desiredMonthlyPension());
        request.setPensionPot(parsed.pensionPot());
        request.setYearsToMaturity(parsed.yearsToMaturity() != null ? parsed.yearsToMaturity() : 1);
        request.setCurrency(parsed.currency() != null && !parsed.currency().isBlank()
                ? parsed.currency().toUpperCase()
                : extractCurrency(query));
        if (parsed.retirementYears() != null && parsed.retirementYears() > 0) {
            request.setRetirementYears(parsed.retirementYears());
        }
        return request;
    }

    /**
     * Deterministic fallback parser.
     *
     * Example: "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000
     *           with 1 year left for existing pension fund to mature"
     *
     * Extracts:
     * - Monthly pension amount (EUR 3000)
     * - Pension pot size (EUR 500,000)
     * - Years to maturity (1)
     *
     * @param query Customer query string
     * @return RetirementPlanRequest with parsed parameters
     */
    private RetirementPlanRequest parseCustomerQueryWithRules(String query) {
        RetirementPlanRequest request = new RetirementPlanRequest();
        request.setCustomerQuery(query);

        // Convert to lowercase for parsing
        String lowerQuery = query.toLowerCase();

        // Extract monthly pension amount (EUR 3000, 3000, etc.)
        BigDecimal monthlyPension = extractAmount(lowerQuery, "pension of");
        if (monthlyPension == null) {
            monthlyPension = extractAmount(lowerQuery, "monthly");
        }
        if (monthlyPension == null) {
            throw new IllegalArgumentException("Could not extract desired monthly pension from query");
        }
        request.setDesiredMonthlyPension(monthlyPension);

        // Extract pension pot size (EUR 500,000, 500000, etc.)
        BigDecimal pensionPot = extractAmount(lowerQuery, "pot of");
        if (pensionPot == null) {
            pensionPot = extractAmount(lowerQuery, "pension pot");
        }
        if (pensionPot == null) {
            throw new IllegalArgumentException("Could not extract pension pot from query");
        }
        request.setPensionPot(pensionPot);

        // Extract years to maturity
        Integer yearsToMaturity = extractYears(lowerQuery);
        if (yearsToMaturity == null) {
            yearsToMaturity = 1; // Default to 1 year
        }
        request.setYearsToMaturity(yearsToMaturity);

        // Extract currency (default EUR)
        String currency = extractCurrency(query);
        request.setCurrency(currency);

        return request;
    }

    /**
     * Extracts numerical amount from query string following a keyword.
     * Properly handles thousand separators (commas) and decimal points.
     *
     * @param query Query string
     * @param keyword Keyword to search after
     * @return Extracted amount or null if not found
     */
    private BigDecimal extractAmount(String query, String keyword) {
        int index = query.indexOf(keyword);
        if (index == -1) {
            return null;
        }

        String after = query.substring(index + keyword.length());

        // Extract number with potential thousand separators and decimal point
        StringBuilder rawNumber = new StringBuilder();
        boolean foundDigit = false;

        for (char c : after.toCharArray()) {
            if (Character.isDigit(c)) {
                rawNumber.append(c);
                foundDigit = true;
            } else if ((c == ',' || c == '.') && foundDigit) {
                // Include separator for now, will process later
                rawNumber.append(c);
            } else if (foundDigit) {
                // Stop when we hit a non-digit, non-separator character
                break;
            }
        }

        if (rawNumber.length() > 0) {
            try {
                // Process the number string to handle separators correctly
                String processedNumber = processNumberString(rawNumber.toString());
                return new BigDecimal(processedNumber);
            } catch (NumberFormatException e) {
                return null;
            }
        }

        return null;
    }

    /**
     * Processes a number string with thousand separators and decimal points.
     * Distinguishes between thousand separators (commas) and decimal separators (dots).
     *
     * Examples:
     * - "500,000" → "500000" (comma is thousand separator)
     * - "500.000" → "500" (dot is decimal separator in some locales, but here we treat last . as decimal)
     * - "3000" → "3000" (no separators)
     * - "3,000.50" → "3000.50" (comma is thousand separator, dot is decimal)
     * - "3.000,50" → "3000.50" (European format: dot is thousand separator, comma is decimal)
     *
     * @param numberStr Raw number string with potential separators
     * @return Processed number string suitable for BigDecimal
     */
    private String processNumberString(String numberStr) {
        // Count commas and dots to determine format
        int commaCount = 0;
        int dotCount = 0;
        int lastCommaIndex = -1;
        int lastDotIndex = -1;

        for (int i = 0; i < numberStr.length(); i++) {
            if (numberStr.charAt(i) == ',') {
                commaCount++;
                lastCommaIndex = i;
            } else if (numberStr.charAt(i) == '.') {
                dotCount++;
                lastDotIndex = i;
            }
        }

        // Determine the format and process accordingly
        if (commaCount == 0 && dotCount == 0) {
            // No separators
            return numberStr;
        } else if (commaCount == 0 && dotCount == 1) {
            // Only dots, treat last dot as decimal separator
            return numberStr;
        } else if (commaCount == 1 && dotCount == 0) {
            // Only one comma - could be thousand separator or decimal separator
            // Check position: if comma is 3+ positions from end, it's a thousand separator
            if (numberStr.length() - lastCommaIndex - 1 >= 3) {
                // Comma is thousand separator (e.g., "500,000")
                return numberStr.replace(",", "");
            } else {
                // Comma is decimal separator (rare in English but possible)
                return numberStr.replace(",", ".");
            }
        } else if (commaCount == 1 && dotCount == 1) {
            // Both comma and dot present
            if (lastDotIndex > lastCommaIndex) {
                // Dot is after comma: US format "3,000.50"
                // Remove comma, keep dot
                return numberStr.replace(",", "");
            } else {
                // Comma is after dot: European format "3.000,50"
                // Remove dot, replace comma with dot
                return numberStr.replace(".", "").replace(",", ".");
            }
        } else if (commaCount > 1 && dotCount == 0) {
            // Multiple commas, no dots: comma is thousand separator
            // "1,000,000" or "1,000,000,000"
            return numberStr.replace(",", "");
        } else if (commaCount > 1 && dotCount == 1) {
            // Multiple commas and one dot: US format with thousand separators
            // "1,000,000.50"
            return numberStr.replace(",", "");
        } else if (dotCount > 1 && commaCount == 0) {
            // Multiple dots, no commas: dot is thousand separator (European)
            // All but last dot should be removed, last dot treated as decimal
            StringBuilder result = new StringBuilder();
            for (int i = 0; i < numberStr.length(); i++) {
                char c = numberStr.charAt(i);
                if (c == '.') {
                    if (i == lastDotIndex) {
                        result.append('.');
                    }
                    // Skip other dots (they're thousand separators)
                } else {
                    result.append(c);
                }
            }
            return result.toString();
        } else if (dotCount > 1 && commaCount == 1) {
            // Multiple dots and one comma: European format "1.000.000,50"
            StringBuilder result = new StringBuilder();
            for (int i = 0; i < numberStr.length(); i++) {
                char c = numberStr.charAt(i);
                if (c == '.') {
                    // Skip dots (thousand separators in European format)
                    continue;
                } else if (c == ',') {
                    // Replace comma with dot (decimal separator)
                    result.append('.');
                } else {
                    result.append(c);
                }
            }
            return result.toString();
        }

        // Default: just remove all commas and keep everything else
        return numberStr.replace(",", "");
    }

    /**
     * Extracts number of years from query string.
     *
     * @param query Query string
     * @return Number of years or null if not found
     */
    private Integer extractYears(String query) {
        // Look for patterns like "1 year", "2 years", "year to maturity"
        String[] patterns = {"year left", "years left", "year to maturity", "years to maturity", "year until"};

        for (String pattern : patterns) {
            int index = query.indexOf(pattern);
            if (index > 0) {
                // Look backwards for a digit
                for (int i = index - 1; i >= 0; i--) {
                    char c = query.charAt(i);
                    if (Character.isDigit(c)) {
                        // Found a digit, extract it
                        int yearValue = Character.getNumericValue(c);
                        return yearValue;
                    } else if (c == ' ') {
                        continue;
                    } else {
                        break;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extracts currency code from query string.
     *
     * @param query Query string
     * @return Currency code (EUR, USD, GBP, etc.) or default EUR
     */
    private String extractCurrency(String query) {
        String[] currencies = {"EUR", "USD", "GBP", "CHF", "JPY", "AUD", "CAD"};

        for (String currency : currencies) {
            if (query.toUpperCase().contains(currency)) {
                return currency;
            }
        }

        return "EUR"; // Default to EUR
    }
}