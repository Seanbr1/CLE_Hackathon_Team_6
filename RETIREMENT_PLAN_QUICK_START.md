# Retirement Planning API - Quick Start Guide

## Overview

This guide provides practical examples of how to use the new Retirement Planning API endpoints.

## Prerequisites

- Spring Boot backend running on `http://localhost:8080`
- The retirement plan service is enabled

## API Endpoints

### Base URL
```
http://localhost:8080/api/v1/retirement-plans
```

## Examples

### 1. Generate Plan from Natural Language Query (Recommended)

This is the simplest way to use the API. Simply send a customer's retirement question in natural language.

**Request:**
```bash
curl -X POST "http://localhost:8080/api/v1/retirement-plans/from-query?query=I%20want%20a%20pension%20of%20EUR%203000%20per%20month%20having%20a%20pension%20pot%20of%20EUR%20500000%20with%201%20year%20left%20for%20pension%20fund%20to%20mature"
```

**PowerShell Example:**
```powershell
$query = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options."
$encodedQuery = [System.Web.HttpUtility]::UrlEncode($query)
$url = "http://localhost:8080/api/v1/retirement-plans/from-query?query=$encodedQuery"

Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json"
```

**JavaScript/Node.js Example:**
```javascript
const query = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature";

fetch('http://localhost:8080/api/v1/retirement-plans/from-query?query=' + encodeURIComponent(query), {
  method: 'POST'
})
.then(response => response.json())
.then(data => {
  console.log('Retirement Plan:', data);
  console.log('Plan ID:', data.planId);
  console.log('Sustainability:', data.sustainabilityStatus);
  console.log('Years:', data.yearlyPlans.length);
  data.yearlyPlans.forEach(year => {
    console.log(`Year ${year.year}: Balance ${year.endingBalance}, Recommendation: ${year.mixMatchOption}`);
  });
})
.catch(error => console.error('Error:', error));
```

---

### 2. Generate Plan from Structured Request

Use this when you have parsed or structured data.

**Request:**
```bash
curl -X POST http://localhost:8080/api/v1/retirement-plans \
  -H "Content-Type: application/json" \
  -d '{
    "desiredMonthlyPension": 3000,
    "pensionPot": 500000,
    "yearsToMaturity": 1,
    "customerQuery": "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.",
    "currency": "EUR",
    "retirementYears": 30,
    "assumedAnnualInflation": 2.5,
    "assumedInvestmentReturn": 4.0,
    "preferredMaturityOption": "REINVEST"
  }'
```

**PowerShell Example:**
```powershell
$body = @{
    desiredMonthlyPension = 3000
    pensionPot = 500000
    yearsToMaturity = 1
    customerQuery = "I want EUR 3000 monthly from EUR 500,000 pot with 1 year to maturity"
    currency = "EUR"
    retirementYears = 30
    assumedAnnualInflation = 2.5
    assumedInvestmentReturn = 4.0
    preferredMaturityOption = "REINVEST"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

Write-Host "Plan ID: $($response.planId)"
Write-Host "Sustainability: $($response.sustainabilityStatus)"
Write-Host "Recommended Option: $($response.recommendedMaturityOption)"
```

**Python Example:**
```python
import requests
import json

url = "http://localhost:8080/api/v1/retirement-plans"

payload = {
    "desiredMonthlyPension": 3000,
    "pensionPot": 500000,
    "yearsToMaturity": 1,
    "customerQuery": "I want EUR 3000 monthly from EUR 500,000 pot",
    "currency": "EUR",
    "retirementYears": 30,
    "assumedAnnualInflation": 2.5,
    "assumedInvestmentReturn": 4.0
}

response = requests.post(url, json=payload)
plan = response.json()

print(f"Plan ID: {plan['planId']}")
print(f"Sustainability: {plan['sustainabilityStatus']}")
print(f"Total Years: {len(plan['yearlyPlans'])}")

# Print first 5 years
for year in plan['yearlyPlans'][:5]:
    print(f"\nYear {year['year']}:")
    print(f"  Beginning Balance: EUR {year['beginningBalance']}")
    print(f"  Withdrawal: EUR {year['annualPensionWithdrawal']}")
    print(f"  Investment Gain: EUR {year['investmentGain']}")
    print(f"  Ending Balance: EUR {year['endingBalance']}")
    print(f"  Strategy: {year['mixMatchOption']}")
```

---

### 3. Health Check

Verify the service is running.

**Request:**
```bash
curl http://localhost:8080/api/v1/retirement-plans/health
```

**Response:**
```
Retirement Plan Service is running
```

---

## Sample Responses

### Full Response Example

```json
{
  "planId": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "550e8400-e29b-41d4-a716-446655440001",
  "desiredMonthlyPension": 3000,
  "pensionPot": 500000,
  "yearsToMaturity": 1,
  "currency": "EUR",
  "totalRetirementYears": 30,
  "recommendedMaturityOption": "REINVEST",
  "executiveSummary": "Your retirement plan has been analyzed and rated as: SUSTAINABLE. Review the detailed year-by-year breakdown for specific recommendations.",
  "totalProjectedIncome": 456789.54,
  "totalProjectedWithdrawals": 1080000.00,
  "sustainabilityStatus": "SUSTAINABLE",
  "aiGeneratedInsights": "RETIREMENT PLAN ANALYSIS FOR: I want a pension of EUR 3000 per month...\n\nCUSTOMER PROFILE:\n- Desired Monthly Pension: EUR 3000\n- Current Pension Pot: EUR 500000\n- Years to Maturity: 1\n- Projected Retirement Duration: 30 years\n\nANALYSIS:\n✓ Your pension pot appears sufficient for your desired pension amount...",
  "yearlyPlans": [
    {
      "year": 1,
      "beginningBalance": 500000,
      "annualPensionWithdrawal": 36000,
      "investmentGain": 20000,
      "endingBalance": 484000,
      "adjustedAnnualWithdrawal": 36000,
      "aiRecommendation": "Year 1: Early retirement phase. Current balance is strong at 500000. Maintain aggressive investment allocation (60-70% equities) to maximize growth. Consider reinvesting part of gains to counter inflation. Your pension withdrawal is sustainable.",
      "mixMatchOption": "REINVEST - Strong balance. Continue reinvestment strategy with growth allocation",
      "isSustainable": true
    },
    // ... more years
  ]
}
```

---

## Query Examples by Currency

### EUR (Euro)
```
"I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left"
"I need EUR 2500 monthly pension from EUR 400,000 savings, 2 years to maturity"
"Help me with EUR 4000 monthly from EUR 600,000 pot, 3 years until maturity"
```

### USD (US Dollar)
```
"I want a pension of USD 4000 per month from USD 600,000 with 2 years to maturity"
"I need $3500 monthly from $500,000 pot, 1 year left"
```

### GBP (British Pound)
```
"I want £2500 monthly pension from £400,000 pot, 1 year to maturity"
"Help me plan £3000 monthly income from £500,000 savings"
```

### CHF (Swiss Franc)
```
"I need CHF 3500 monthly from CHF 450,000, 2 years until maturity"
```

### Mixed Formats
```
"I want 3000 EUR per month from 500000 EUR pot with 1 year left"
"3,000 EUR monthly from 500,000 EUR pension fund, 1 year to maturity"
"EUR3000 monthly, EUR500000 pot, 1 year to pension maturity"
```

---

## Using the Response

### Checking Sustainability

```javascript
const response = await fetch(url).then(r => r.json());

if (response.sustainabilityStatus === 'SUSTAINABLE') {
  console.log('✓ Plan is sustainable for full retirement period');
} else if (response.sustainabilityStatus === 'MOSTLY_SUSTAINABLE') {
  console.log('⚠ Plan is sustainable for 80%+ of retirement');
} else {
  console.log('✗ Plan at risk - consider adjustments');
}
```

### Analyzing Year-by-Year Breakdown

```javascript
response.yearlyPlans.forEach(year => {
  const balanceDecrease = year.beginningBalance - year.endingBalance;
  const percentDecrease = (balanceDecrease / year.beginningBalance * 100).toFixed(2);
  
  console.log(`
    Year ${year.year}:
    - Starting: EUR ${year.beginningBalance.toLocaleString()}
    - Withdrawal: EUR ${year.annualPensionWithdrawal.toLocaleString()}
    - Investment Gain: EUR ${year.investmentGain.toLocaleString()}
    - Ending: EUR ${year.endingBalance.toLocaleString()}
    - Balance Change: ${percentDecrease}%
    - Strategy: ${year.mixMatchOption}
  `);
});
```

### AI Recommendations by Phase

The API automatically generates phase-based recommendations:

1. **Years 1-10: Early Retirement (Growth Phase)**
   - Portfolio: 60-70% equities, 30-40% bonds
   - Focus: Capital appreciation and growth
   - Action: Reinvest gains where possible

2. **Years 11-20: Mid Retirement (Balanced Phase)**
   - Portfolio: 40-50% equities, 50-60% bonds
   - Focus: Income and stability
   - Action: Regular rebalancing

3. **Years 21+: Late Retirement (Preservation Phase)**
   - Portfolio: 20-30% equities, 70-80% bonds
   - Focus: Capital preservation and income
   - Action: Consider partial annuity purchase

---

## Mix-Match Options Explained

The API recommends investment strategies based on remaining balance:

### REINVEST (Balance > 75% of initial)
- Continue aggressive growth strategy
- Reinvest pension gains
- Maintain 60-70% equity allocation
- Best for: Early retirement years with strong balance

### HYBRID (Balance 50-75% of initial)
- Mixed approach: 60% reinvest, 40% drawdown
- Moderate portfolio: 40-50% equities
- Gradually shift toward income
- Best for: Mid-retirement transition

### INCOME_FOCUS (Balance 25-50% of initial)
- Focus on income generation
- Conservative portfolio: 40% equities, 60% fixed income
- Reduce withdrawal risk
- Best for: Later retirement years

### ANNUITY (Balance < 25% of initial)
- Switch to guaranteed income
- Minimize longevity risk
- Stable, predictable payments
- Best for: Final retirement years

---

## Error Handling

### Missing Required Parameters
```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Could not extract pension pot from query"
}
```

### Invalid Input
```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "Missing required retirement plan parameters"
}
```

### Server Error
```json
{
  "status": 500,
  "error": "Internal Server Error"
}
```

---

## Advanced Usage

### Scenario Planning

Test multiple scenarios to find optimal strategy:

```python
import requests

scenarios = [
    {"monthly": 2000, "pot": 500000, "years": 1},
    {"monthly": 2500, "pot": 500000, "years": 1},
    {"monthly": 3000, "pot": 500000, "years": 1},
    {"monthly": 3500, "pot": 500000, "years": 1},
]

results = []
for scenario in scenarios:
    payload = {
        "desiredMonthlyPension": scenario["monthly"],
        "pensionPot": scenario["pot"],
        "yearsToMaturity": scenario["years"],
        "currency": "EUR",
        "retirementYears": 30
    }
    
    response = requests.post(
        "http://localhost:8080/api/v1/retirement-plans",
        json=payload
    )
    
    plan = response.json()
    results.append({
        "monthly_pension": scenario["monthly"],
        "sustainability": plan["sustainabilityStatus"],
        "final_balance": plan["yearlyPlans"][-1]["endingBalance"]
    })

# Compare results
for result in results:
    print(f"EUR {result['monthly_pension']}: {result['sustainability']}")
```

### Sensitivity Analysis

Test impact of different investment returns:

```python
for return_rate in [2.0, 3.0, 4.0, 5.0, 6.0]:
    payload = {
        "desiredMonthlyPension": 3000,
        "pensionPot": 500000,
        "yearsToMaturity": 1,
        "assumedInvestmentReturn": return_rate,
        "currency": "EUR",
        "retirementYears": 30
    }
    
    response = requests.post(
        "http://localhost:8080/api/v1/retirement-plans",
        json=payload
    )
    
    plan = response.json()
    print(f"{return_rate}% return: {plan['sustainabilityStatus']}")
```

---

## Integration with Frontend

### React Example

```jsx
import React, { useState } from 'react';

function RetirementPlanForm() {
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(
        `http://localhost:8080/api/v1/retirement-plans/from-query?query=${encodeURIComponent(query)}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      setPlan(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleGeneratePlan}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe your retirement needs..."
          rows={4}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generating Plan...' : 'Generate Retirement Plan'}
        </button>
      </form>

      {plan && (
        <div>
          <h2>Your Retirement Plan</h2>
          <p>Status: {plan.sustainabilityStatus}</p>
          <p>Recommended Strategy: {plan.recommendedMaturityOption}</p>
          
          <h3>Year-by-Year Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Beginning Balance</th>
                <th>Withdrawal</th>
                <th>Investment Gain</th>
                <th>Ending Balance</th>
                <th>Strategy</th>
              </tr>
            </thead>
            <tbody>
              {plan.yearlyPlans.map(year => (
                <tr key={year.year}>
                  <td>{year.year}</td>
                  <td>€{year.beginningBalance.toFixed(0)}</td>
                  <td>€{year.annualPensionWithdrawal.toFixed(0)}</td>
                  <td>€{year.investmentGain.toFixed(0)}</td>
                  <td>€{year.endingBalance.toFixed(0)}</td>
                  <td>{year.mixMatchOption}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RetirementPlanForm;
```

---

## Testing Endpoints

### Using Postman

1. **Create New Request**
   - Method: `POST`
   - URL: `http://localhost:8080/api/v1/retirement-plans/from-query`
   - Params: `query` = "I want EUR 3000 per month..."

2. **Headers**
   - Content-Type: application/json

3. **Send** and view response

---

## Support & Troubleshooting

### Query Not Parsing Correctly

Ensure your query includes:
- Currency (EUR, USD, GBP, etc.)
- Monthly pension amount
- Pension pot size
- Years to maturity (optional, defaults to 1)

### Server Not Responding

1. Verify backend is running: `curl http://localhost:8080/api/v1/retirement-plans/health`
2. Check logs for errors
3. Ensure port 8080 is not blocked

### Unusual Results

1. Review the AI recommendations in `aiGeneratedInsights`
2. Check `sustainabilityStatus` for warnings
3. Compare with alternative scenarios
4. Consult financial advisor for personalized advice

---

## Best Practices

1. **Always verify** the generated plan with a qualified financial advisor
2. **Review annually** and regenerate plans as circumstances change
3. **Test scenarios** with different assumptions
4. **Document assumptions** used (inflation rate, investment return)
5. **Plan for flexibility** - actual returns may vary significantly
6. **Consider taxes** - the API assumes pre-tax amounts

---

This guide covers the main use cases. For advanced scenarios or integration questions, refer to `RETIREMENT_PLAN_API.md` for detailed technical documentation.