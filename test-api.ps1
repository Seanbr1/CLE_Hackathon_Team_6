# Retirement Planning API - Test curl commands (PowerShell)

# ============================================================================
# TEST 1: Natural Language Query with Comma Thousand Separator
# ============================================================================
# This is the MAIN TEST for the EUR 500,000 comma separator fix

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TEST 1: Natural Language Query (EUR 500,000)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$query = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options."
$encodedQuery = [System.Web.HttpUtility]::UrlEncode($query)
$url1 = "http://localhost:8080/api/v1/retirement-plans/from-query?query=$encodedQuery"

Write-Host "URL: $url1`n" -ForegroundColor Yellow

try {
    $response1 = Invoke-RestMethod -Uri $url1 -Method Post -ContentType "application/json"
    Write-Host "SUCCESS! Response:" -ForegroundColor Green
    $response1 | ConvertTo-Json -Depth 5 | Write-Host
    Write-Host "Pension Pot Parsed As: $($response1.pensionPot)" -ForegroundColor Green
    Write-Host "Expected: 500000" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host "`n`n"

# ============================================================================
# TEST 2: Structured JSON Request (alternative format)
# ============================================================================
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TEST 2: Structured JSON Request" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$body = @{
    desiredMonthlyPension = 3000
    pensionPot = 500000
    yearsToMaturity = 1
    customerQuery = "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options."
    currency = "EUR"
    retirementYears = 30
    assumedAnnualInflation = 2.5
    assumedInvestmentReturn = 4.0
} | ConvertTo-Json

Write-Host "URL: http://localhost:8080/api/v1/retirement-plans`n" -ForegroundColor Yellow

try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    Write-Host "SUCCESS! Response:" -ForegroundColor Green
    $response2 | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host "`n`n"

# ============================================================================
# TEST 3: Health Check
# ============================================================================
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TEST 3: Health Check" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host "URL: http://localhost:8080/api/v1/retirement-plans/health`n" -ForegroundColor Yellow

try {
    $response3 = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/retirement-plans/health" `
        -Method Get
    Write-Host "SUCCESS! Response: $response3" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
}

Write-Host "`n"