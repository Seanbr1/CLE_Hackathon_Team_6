#!/bin/bash
# Retirement Planning API - Test curl commands

# ============================================================================
# TEST 1: Natural Language Query with Comma Thousand Separator
# ============================================================================
# This is the MAIN TEST for the EUR 500,000 comma separator fix

echo "=========================================="
echo "TEST 1: Natural Language Query (EUR 500,000)"
echo "=========================================="
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query" \
  --data-urlencode 'query=I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.' \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w "\n\nStatus: %{http_code}\n"

echo ""
echo ""

# ============================================================================
# TEST 2: Structured JSON Request (alternative format)
# ============================================================================
echo "=========================================="
echo "TEST 2: Structured JSON Request"
echo "=========================================="
curl -X POST "http://localhost:8080/api/v1/retirement-plans" \
  -H "Content-Type: application/json" \
  -d '{
    "desiredMonthlyPension": 3000,
    "pensionPot": 500000,
    "yearsToMaturity": 1,
    "customerQuery": "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.",
    "currency": "EUR",
    "retirementYears": 30,
    "assumedAnnualInflation": 2.5,
    "assumedInvestmentReturn": 4.0
  }' \
  -w "\n\nStatus: %{http_code}\n"

echo ""
echo ""

# ============================================================================
# TEST 3: Health Check
# ============================================================================
echo "=========================================="
echo "TEST 3: Health Check"
echo "=========================================="
curl -X GET "http://localhost:8080/api/v1/retirement-plans/health" \
  -w "\n\nStatus: %{http_code}\n"

echo ""