# 🎯 CURL COMMANDS - COMPLETE REFERENCE

## ⚡ FASTEST WAY TO TEST (Copy & Paste)

### Main Test - EUR 500,000 Query

```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options."
```

---

## 📋 All Curl Commands

### 1️⃣ Main Test (Natural Language with Comma)
```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options."
```

### 2️⃣ Health Check
```bash
curl http://localhost:8080/api/v1/retirement-plans/health
```

### 3️⃣ Structured JSON Request
```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans" \
  -H "Content-Type: application/json" \
  -d '{"desiredMonthlyPension":3000,"pensionPot":500000,"yearsToMaturity":1,"customerQuery":"I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.","currency":"EUR","retirementYears":30,"assumedAnnualInflation":2.5,"assumedInvestmentReturn":4.0}'
```

### 4️⃣ USD Format Test
```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20USD%204000%20per%20month%20from%20USD%20600%2C000%20with%202%20years%20to%20maturity"
```

### 5️⃣ European Format Test
```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=EUR%203.000%2C50%20monatlich%20aus%20EUR%20500.000"
```

### 6️⃣ Multiple Thousands Test
```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=EUR%201%2C000%2C000%20pension%20pot%20with%205000%20monthly"
```

---

## 🚀 PowerShell Commands

### Main Test
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options." -Method Post | ConvertTo-Json -Depth 10
```

### Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/health" -Method Get
```

### With Nice Formatting
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500%2C000%20with%201%20year%20left%20for%20existing%20pension%20fund%20to%20mature.%20Help%20me%20plan%20my%20retirement%20journey%20by%20selecting%20mix-match%20options." -Method Post
Write-Host "Pension Pot: $($response.pensionPot)" -ForegroundColor Green
Write-Host "Status: $($response.sustainabilityStatus)" -ForegroundColor Green
Write-Host "Years Planned: $($response.yearlyPlans.Count)" -ForegroundColor Green
```

---

## 📝 Running the Pre-Made Scripts

### PowerShell Script (Recommended for Windows)
```powershell
.\test-api.ps1
```

### Bash Script (for Git Bash or WSL)
```bash
bash test-api.sh
```

---

## ✅ Verification Checklist

After running any curl command, verify:

- [ ] HTTP Status: **201** (CREATED) for generate, **200** for health
- [ ] Response contains: **pensionPot** field
- [ ] Pension pot value: **500000** (NOT 500 or 500.000)
- [ ] Response contains: **yearlyPlans** array
- [ ] Array has: **30 items** (30-year plan)
- [ ] Response contains: **sustainabilityStatus**
- [ ] Status is one of: SUSTAINABLE, MOSTLY_SUSTAINABLE, AT_RISK

---

## 🔍 Understanding the Response

### Key Fields to Check

```json
{
  "planId": "UUID",                    // Unique plan identifier
  "desiredMonthlyPension": 3000,      // Input: 3000 ✅
  "pensionPot": 500000,               // Critical: Should be 500000 ✅
  "yearsToMaturity": 1,               // Input: 1 ✅
  "currency": "EUR",                  // Parsed: EUR ✅
  "totalRetirementYears": 30,         // Number of years in plan
  "recommendedMaturityOption": "REINVEST",  // AI recommendation
  "sustainabilityStatus": "SUSTAINABLE",    // Plan viability
  "yearlyPlans": [                    // Array of 30 years
    {
      "year": 1,
      "beginningBalance": 500000,
      "annualPensionWithdrawal": 36000,
      "investmentGain": 20000,
      "endingBalance": 484000,
      "aiRecommendation": "...",      // AI text
      "mixMatchOption": "REINVEST...",  // Strategy
      "isSustainable": true
    }
    // ... 29 more years
  ],
  "aiGeneratedInsights": "..."        // Long AI analysis
}
```

---

## 🎯 Success Criteria

### ✅ MAIN TEST SUCCESS WHEN:

1. Response status is **201 CREATED**
2. `pensionPot` equals **500000** (from "EUR 500,000" in query)
3. `yearlyPlans` array contains **30 elements**
4. First year shows `beginningBalance: 500000`
5. `sustainabilityStatus` is calculated (not null)
6. `aiGeneratedInsights` contains retirement advice

---

## 🔧 Troubleshooting

### Issue: Connection Refused
**Solution:** Start the backend first
```powershell
cd demo
.\mvnw.cmd spring-boot:run
# Wait for "Started DemoApplication" message
```

### Issue: 400 Bad Request
**Solution:** Ensure query is properly URL encoded (the commands above are pre-encoded)

### Issue: Pension Pot Shows 500 or 500.000
**Solution:** The comma separator fix wasn't applied. Check:
```bash
grep "processNumberString" demo/src/main/java/com/example/demo/retirement/api/RetirementPlanController.java
```

### Issue: No Response / Timeout
**Solution:** Check firewall isn't blocking port 8080
```powershell
# Test connectivity
Test-NetConnection localhost -Port 8080
```

---

## 📊 Different Query Formats to Test

| Format | Query | Expected Pot |
|--------|-------|--------------|
| US comma | EUR 500,000 | 500000 ✅ |
| European dot | EUR 500.000 | 500000 ✅ |
| US decimal | EUR 3,000.50 | 3000.50 ✅ |
| European decimal | EUR 3.000,50 | 3000.50 ✅ |
| Simple | EUR 500000 | 500000 ✅ |

---

## 🚀 Quickest Test Flow

### Step 1: Start Backend
```powershell
cd demo
.\mvnw.cmd spring-boot:run
```

### Step 2: In New Terminal, Run Test Script
```powershell
.\test-api.ps1
```

### Step 3: Look for in Output
```
SUCCESS! Response:
Pension Pot Parsed As: 500000
Expected: 500000
```

### ✅ Done!

---

## 📞 Support

**Q: Which command should I run?**
A: If on Windows with PowerShell: `.\test-api.ps1`
   If using Git Bash: `bash test-api.sh`
   Or copy any curl command above

**Q: What's the most important test?**
A: The main test that checks EUR 500,000 → 500000

**Q: How do I know it worked?**
A: Pension pot in response = 500000 ✅

**Q: Scripts don't work?**
A: Copy the curl commands directly, they're pre-formatted

---

## Files Provided

- ✅ `test-api.ps1` - PowerShell test script
- ✅ `test-api.sh` - Bash test script
- ✅ `CURL_COMMANDS.md` - Detailed command reference
- ✅ `CURL_QUICK.md` - Quick copy-paste reference
- ✅ This file: `CURL_REFERENCE.md` - Complete guide

---

**Status:** ✅ READY TO TEST
**Time to Run:** ~5 seconds
**Backend Required:** YES (must be running first)

Pick any command above and paste into your terminal! 🚀