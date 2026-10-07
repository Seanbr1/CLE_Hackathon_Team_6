# 🎯 QUICK CURL - Copy & Paste Ready

## ✅ Main Test (EUR 500,000 Fix)

### Simple Curl (One-liner)

```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options."
```

### PowerShell One-Liner

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options." -Method Post
```

### JSON Body Alternative

```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans" \
  -H "Content-Type: application/json" \
  -d '{"desiredMonthlyPension":3000,"pensionPot":500000,"yearsToMaturity":1,"customerQuery":"I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.","currency":"EUR","retirementYears":30,"assumedAnnualInflation":2.5,"assumedInvestmentReturn":4.0}'
```

---

## ✅ Other Tests

### Health Check

```bash
curl http://localhost:8080/api/v1/retirement-plans/health
```

### USD Query

```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20USD%204000%20per%20month%20from%20USD%20600%2C000%20with%202%20years%20to%20maturity"
```

### European Format

```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=Je%20veux%20EUR%203.000%2C50%20par%20mois%20a%20partir%20de%20EUR%20500.000"
```

---

## 📋 Step by Step

### 1. Start Backend
```powershell
cd demo
.\mvnw.cmd spring-boot:run
# Wait for "Started DemoApplication" message
```

### 2. Open New Terminal and Run Test

**Option A - Simple Copy-Paste:**
```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options."
```

**Option B - PowerShell:**
```powershell
.\test-api.ps1
```

**Option C - Using Invoke-RestMethod:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options." -Method Post | ConvertTo-Json
```

### 3. Verify Results

Look for in the response:
- ✅ `"pensionPot": 500000` (should be exactly 500000, not 500 or 500.000)
- ✅ `"sustainabilityStatus": "SUSTAINABLE"` or similar
- ✅ `"yearlyPlans": [...]` with array of years

---

## 🔗 URLs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `http://localhost:8080/api/v1/retirement-plans/from-query` | POST | Natural language query |
| `http://localhost:8080/api/v1/retirement-plans` | POST | Structured JSON request |
| `http://localhost:8080/api/v1/retirement-plans/health` | GET | Health check |

---

## 🎯 Expected Output (Key Parts)

```json
{
  "planId": "550e8400-e29b-41d4-a716-446655440000",
  "desiredMonthlyPension": 3000,
  "pensionPot": 500000,
  "yearsToMaturity": 1,
  "currency": "EUR",
  "recommendedMaturityOption": "REINVEST",
  "sustainabilityStatus": "SUSTAINABLE",
  "yearlyPlans": [
    {
      "year": 1,
      "beginningBalance": 500000,
      "annualPensionWithdrawal": 36000,
      "investmentGain": 20000,
      "endingBalance": 484000
    },
    // ... 29 more years
  ]
}
```

---

## ⚡ Quick Verification

After running curl, check:
1. HTTP Status: Should be **201 (CREATED)** ✅
2. `pensionPot` value: Should be **500000** ✅
3. `yearlyPlans` length: Should have **30 items** ✅
4. `sustainabilityStatus`: Should be calculated ✅

---

## 📝 Notes

- Replace `EUR` with `USD`, `GBP`, `CHF`, etc. for other currencies
- The comma in `500,000` is the critical test for the fix
- All endpoints support natural language queries
- JSON body is an alternative to query string parameter

---

**Ready? Copy the curl command above and paste into your terminal!**

Status: ✅ READY FOR TESTING