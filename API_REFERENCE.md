# Retirement Planning API - Quick Reference

## Endpoints

```
POST /api/v1/retirement-plans
POST /api/v1/retirement-plans/from-query?query=...
GET /api/v1/retirement-plans/health
```

## Test Run Command

```powershell
cd demo
.\mvnw.cmd test -Dtest=RetirementPlanServiceTest
.\mvnw.cmd test -Dtest=RetirementPlanControllerTest
```

## Example Queries

EUR 3000/month, 500k pot, 1yr to maturity
USD 4000/month, 600k pot, 2yrs to maturity  
GBP 2500/month, 400k pot, 3yrs to maturity

## Response Fields

- `planId` - Unique plan identifier
- `sustainabilityStatus` - SUSTAINABLE/MOSTLY_SUSTAINABLE/AT_RISK
- `recommendedMaturityOption` - ANNUITY/LUMP_SUM/REINVEST
- `totalProjectedIncome` - Total investment gains over period
- `totalProjectedWithdrawals` - Total pension withdrawals
- `aiGeneratedInsights` - Detailed AI analysis
- `yearlyPlans` - Array of 30+ years of projections

## Year-by-Year Fields

- `year` - Year number
- `beginningBalance` - Starting pension pot
- `annualPensionWithdrawal` - Inflation-adjusted withdrawal
- `investmentGain` - Annual returns
- `endingBalance` - Remaining pot
- `aiRecommendation` - Year-specific advice
- `mixMatchOption` - Investment strategy
- `isSustainable` - Viability flag

## Mix-Match Strategies

REINVEST (>75% balance) - 60-70% equities
HYBRID (50-75%) - 40-50% equities  
INCOME_FOCUS (25-50%) - 20-30% equities
ANNUITY (<25%) - Guaranteed income

## Files Created

Models:
- RetirementPlanRequest.java
- RetirementPlan.java
- RetirementYearPlan.java

Service:
- RetirementPlanService.java

Controller:
- RetirementPlanController.java

Tests:
- RetirementPlanServiceTest.java (11 tests)
- RetirementPlanControllerTest.java (15 tests)

Docs:
- RETIREMENT_PLAN_API.md
- RETIREMENT_PLAN_QUICK_START.md