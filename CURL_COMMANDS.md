# API Testing - Quick Curl Commands

## Prerequisites

Make sure the Spring Boot backend is running:
```powershell
cd demo
.\mvnw.cmd spring-boot:run
```

The API will be available at: `http://localhost:8080/api/v1/retirement-plans`

---

## 🎯 MAIN TEST: EUR 500,000 Query

This is the primary test for the comma separator fix.

### Curl Command (URL-encoded)

```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query" \
  --data-urlencode 'query=I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.' \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### PowerShell Command

```powershell
$query = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options."
$encodedQuery = [System.Web.HttpUtility]::UrlEncode($query)

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/from-query?query=$encodedQuery" `
    -Method Post `
    -ContentType "application/json"
```

### Raw URL (can be pasted directly in browser or curl)

```
http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options.
```

---

## Alternative Tests

### Test 2: Structured JSON Request

```bash
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
  }'
```

### PowerShell Version

```powershell
$body = @{
    desiredMonthlyPension = 3000
    pensionPot = 500000
    yearsToMaturity = 1
    customerQuery = "I want a pension of EUR 3000 per month..."
    currency = "EUR"
    retirementYears = 30
    assumedAnnualInflation = 2.5
    assumedInvestmentReturn = 4.0
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

### Test 3: Health Check

```bash
curl http://localhost:8080/api/v1/retirement-plans/health
```

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/health" -Method Get
```

---

## Running Test Scripts

### Bash Script
```bash
bash test-api.sh
```

### PowerShell Script
```powershell
.\test-api.ps1
```

---

## Expected Response

### Success Response (Excerpt)

```json
{
  "planId": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "550e8400-e29b-41d4-a716-446655440001",
  "desiredMonthlyPension": 3000,
  "pensionPot": 500000,              ← Should be 500000 (not 500.000)
  "yearsToMaturity": 1,
  "currency": "EUR",
  "recommendedMaturityOption": "REINVEST",
  "sustainabilityStatus": "SUSTAINABLE",
  "totalProjectedIncome": 456789.54,
  "totalProjectedWithdrawals": 1080000.00,
  "yearlyPlans": [
    {
      "year": 1,
      "beginningBalance": 500000,
      "annualPensionWithdrawal": 36000,
      "investmentGain": 20000,
      "endingBalance": 484000,
      "aiRecommendation": "Year 1: Early retirement phase...",
      "mixMatchOption": "REINVEST - Strong balance...",
      "isSustainable": true
    },
    // ... more years
  ],
  "aiGeneratedInsights": "RETIREMENT PLAN ANALYSIS FOR: ..."
}
```

### Key Verification
- ✅ `pensionPot: 500000` (not 500.000 or 500)
- ✅ `yearlyPlans` array populated with 30 years
- ✅ `sustainabilityStatus: SUSTAINABLE`
- ✅ `aiGeneratedInsights` contains recommendations

---

## Postman Alternative

If you prefer Postman:

1. **Method:** POST
2. **URL:** `http://localhost:8080/api/v1/retirement-plans/from-query`
3. **Params:**
   - Key: `query`
   - Value: `I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.`
4. **Send**

---

## Troubleshooting

### If you get connection refused:
1. Make sure backend is running: `.\mvnw.cmd spring-boot:run` from `demo/` folder
2. Wait a few seconds for startup
3. Try again

### If you get 400 Bad Request:
1. Check query string is properly encoded
2. Verify required parameters are present
3. Check logs for parsing errors

### If pension pot is wrong:
1. Verify EUR 500,000 is in the query
2. Run the test commands as-is first
3. Check the fix was applied: grep "processNumberString" RetirementPlanController.java

---

## Success Criteria

✅ Pension pot parsed as 500000 (not 500.000)
✅ Status 201 (CREATED) returned
✅ Full retirement plan generated
✅ 30 years of projections included
✅ AI recommendations present
✅ Sustainability status calculated

---

**Quick Start:**
1. Start backend: `cd demo && .\mvnw.cmd spring-boot:run`
2. Run tests: `.\test-api.ps1`
3. Verify pension pot = 500000 ✅

**Location:** http://localhost:8080/api/v1/retirement-plans/from-query