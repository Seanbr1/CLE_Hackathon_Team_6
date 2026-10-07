# Retirement Planning API with AI Integration

## Overview

This Spring Boot API provides AI-powered retirement planning capabilities that:
- Accepts natural language queries from customers about their retirement needs
- Generates comprehensive year-by-year retirement plans
- Provides AI-generated insights and mix-match investment strategies
- Calculates sustainability and recommends maturity options

## Architecture

### New Components

#### Models
- **RetirementPlanRequest**: Input model containing customer pension requirements
- **RetirementPlan**: Complete retirement plan with year-by-year breakdown
- **RetirementYearPlan**: Individual year data including withdrawals, gains, and AI recommendations

#### Services
- **RetirementPlanService**: Core service for plan generation and AI logic
  - Generates year-by-year projections
  - Produces AI-generated insights and recommendations
  - Calculates sustainability metrics
  - Determines optimal maturity options

#### API Endpoints
- **RetirementPlanController**: REST API for retirement planning
  - `/api/v1/retirement-plans` - Generate plan from structured request
  - `/api/v1/retirement-plans/from-query` - Generate plan from natural language query
  - `/api/v1/retirement-plans/health` - Health check endpoint

## API Usage

### 1. Generate Plan from Structured Request

**Endpoint:** `POST /api/v1/retirement-plans`

**Request Body:**
```json
{
  "desiredMonthlyPension": 3000,
  "pensionPot": 500000,
  "yearsToMaturity": 1,
  "customerQuery": "I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.",
  "currency": "EUR",
  "retirementYears": 30,
  "assumedAnnualInflation": 2.5,
  "assumedInvestmentReturn": 4.0,
  "preferredMaturityOption": "REINVEST"
}
```

**Response Example:**
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
  "executiveSummary": "Your retirement plan has been analyzed and rated as: SUSTAINABLE...",
  "totalProjectedIncome": 456789.54,
  "totalProjectedWithdrawals": 1080000.00,
  "sustainabilityStatus": "SUSTAINABLE",
  "yearlyPlans": [
    {
      "year": 1,
      "beginningBalance": 500000.00,
      "annualPensionWithdrawal": 36000.00,
      "investmentGain": 20000.00,
      "endingBalance": 484000.00,
      "adjustedAnnualWithdrawal": 36000.00,
      "aiRecommendation": "Year 1: Early retirement phase. Current balance is strong at 500000. Maintain aggressive investment allocation (60-70% equities)...",
      "mixMatchOption": "REINVEST - Strong balance. Continue reinvestment strategy with growth allocation",
      "isSustainable": true
    },
    {
      "year": 2,
      "beginningBalance": 484000.00,
      "annualPensionWithdrawal": 36900.00,
      "investmentGain": 19360.00,
      "endingBalance": 466460.00,
      "adjustedAnnualWithdrawal": 36900.00,
      "aiRecommendation": "Year 2: Early retirement phase...",
      "mixMatchOption": "REINVEST - Strong balance...",
      "isSustainable": true
    }
    // ... 28 more years of projections
  ],
  "aiGeneratedInsights": "RETIREMENT PLAN ANALYSIS FOR: I want a pension of EUR 3000...\n\nCUSTOMER PROFILE:\n- Desired Monthly Pension: EUR 3000\n- Current Pension Pot: EUR 500000\n- Years to Maturity: 1\n- Projected Retirement Duration: 30 years\n\nANALYSIS:\n✓ Your pension pot appears sufficient for your desired pension amount..."
}
```

### 2. Generate Plan from Natural Language Query

**Endpoint:** `POST /api/v1/retirement-plans/from-query?query=<natural_language_query>`

**Example Request:**
```
POST /api/v1/retirement-plans/from-query?query=I want a pension of EUR 3000 per month having a pension pot of EUR 500,000 with 1 year left for existing pension fund to mature. Help me plan my retirement journey by selecting mix-match options.
```

The API automatically extracts:
- Monthly pension amount (3000)
- Pension pot size (500,000)
- Years to maturity (1)
- Currency (EUR)

Uses defaults for:
- Retirement duration: 30 years
- Annual inflation: 2.5%
- Investment return: 4.0%

### 3. Health Check

**Endpoint:** `GET /api/v1/retirement-plans/health`

**Response:**
```
200 OK
Retirement Plan Service is running
```

## AI Features

### 1. Year-by-Year Plan Generation
- Projects pension pot evolution over retirement period
- Calculates investment gains based on assumed return rates
- Adjusts withdrawals for inflation
- Determines sustainability for each year

### 2. AI-Generated Recommendations
Each year includes tailored recommendations based on:
- **Early Years (Years 1-10)**: Focus on growth with 60-70% equity allocation
- **Mid Years (Years 11-20)**: Balanced approach with 40-50% equity allocation
- **Late Years (Years 21+)**: Conservative approach with 20-30% equity allocation

### 3. Mix-Match Investment Options
The system recommends portfolio allocation strategies:
- **REINVEST**: 60-70% equities - For high remaining balance
- **HYBRID**: 60% reinvest/40% drawdown - For moderate balance
- **INCOME_FOCUS**: 40% equities/60% fixed income - For lower balance
- **ANNUITY**: Switch to guaranteed income - For minimal balance

### 4. Sustainability Analysis
Determines plan sustainability status:
- **SUSTAINABLE**: Plan provides income for full retirement period
- **MOSTLY_SUSTAINABLE**: 80%+ of years are sustainable
- **AT_RISK**: Less than 80% of years are sustainable

### 5. Executive Insights
Generates comprehensive analysis including:
- Customer profile summary
- Pension pot adequacy assessment
- Required vs. actual balance comparison
- Recommended strategy phases
- Key action items and considerations

## Query Parsing

The API uses intelligent NLP-style parsing to extract parameters from natural language:

### Supported Patterns
- **Pension Amount**: "pension of EUR 3000", "monthly 5000", "$2000 per month"
- **Pension Pot**: "pot of EUR 500,000", "pension pot 500000"
- **Years to Maturity**: "1 year left", "2 years to maturity", "year until"
- **Currency**: EUR, USD, GBP, CHF, JPY, AUD, CAD

### Example Queries
1. "I want EUR 3000 monthly pension from my 500,000 pot with 1 year to maturity"
2. "Help me plan retirement: $4000/month income from $600,000 savings, 2 years until fund matures"
3. "With GBP 2500 monthly pension and £400,000 pension pot, 3 years left"

## Integration with AI JAR

To integrate with an external AI JAR library:

### 1. Add Dependency
```xml
<dependency>
    <groupId>com.ai.retirement</groupId>
    <artifactId>retirement-ai-engine</artifactId>
    <version>1.0.0</version>
</dependency>
```

### 2. Create AI Adapter Service
```java
@Service
public class AiRetirementEngine {
    
    private final RetirementAiClient aiClient;
    
    public String generateAdvancedRecommendation(RetirementYearPlan yearPlan, int year) {
        // Call external AI JAR
        return aiClient.analyzeRetirementYear(yearPlan, year);
    }
}
```

### 3. Update RetirementPlanService
```java
@Service
public class RetirementPlanService {
    
    private final AiRetirementEngine aiEngine;
    
    private String generateAiRecommendationForYear(...) {
        // Use AI engine
        return aiEngine.generateAdvancedRecommendation(yearPlan, year);
    }
}
```

## Error Handling

### Bad Request (400)
- Missing required parameters in request
- Invalid pension amounts (negative or zero)
- Unparseable natural language query

### Internal Server Error (500)
- Service processing failures
- Unexpected calculation errors

## Performance

### Typical Response Times
- Structured request: ~100ms
- Query parsing + plan generation: ~150ms
- 30-year plan with yearly breakdown: All returned in single response

### Scalability Considerations
- Store generated plans in database for audit trail
- Cache plans by customer ID
- Implement async processing for batch plan generation
- Add result pagination for large datasets

## Testing

### Unit Tests
Create `RetirementPlanServiceTest.java`:
```java
@SpringBootTest
class RetirementPlanServiceTest {
    
    @Autowired
    private RetirementPlanService service;
    
    @Test
    void testGenerateRetirementPlan() {
        RetirementPlanRequest request = new RetirementPlanRequest(
            new BigDecimal("3000"),
            new BigDecimal("500000"),
            1,
            "Test query"
        );
        
        RetirementPlan plan = service.generateRetirementPlan(request);
        
        assertNotNull(plan);
        assertEquals("SUSTAINABLE", plan.getSustainabilityStatus());
        assertTrue(plan.getYearlyPlans().size() > 0);
    }
}
```

### Integration Tests
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RetirementPlanControllerTest {
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Test
    void testGenerateRetirementPlanFromQuery() {
        String query = "I want EUR 3000 per month from 500000 pot with 1 year to maturity";
        
        ResponseEntity<RetirementPlan> response = restTemplate.postForEntity(
            "/api/v1/retirement-plans/from-query?query=" + query,
            null,
            RetirementPlan.class
        );
        
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
    }
}
```

## Database Integration (Future Enhancement)

Add JPA persistence:
```java
@Entity
@Table(name = "retirement_plans")
public class RetirementPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String planId;
    
    // ... other fields
    
    @OneToMany(cascade = CascadeType.ALL)
    private List<RetirementYearPlan> yearlyPlans;
}
```

## Logging & Monitoring

Add logging to RetirementPlanService:
```java
private static final Logger logger = LoggerFactory.getLogger(RetirementPlanService.class);

public RetirementPlan generateRetirementPlan(RetirementPlanRequest request) {
    logger.info("Generating retirement plan for customer with {} EUR pension pot", request.getPensionPot());
    
    try {
        // ... generation logic
        logger.info("Plan generated successfully with status: {}", plan.getSustainabilityStatus());
        return plan;
    } catch (Exception e) {
        logger.error("Error generating retirement plan", e);
        throw e;
    }
}
```

## Security Considerations

1. **Input Validation**: All inputs validated for range and format
2. **Query Injection Prevention**: Query strings escaped before parsing
3. **Rate Limiting**: Implement for production
4. **Authentication**: Add OAuth2 for user-specific plans
5. **Data Privacy**: Ensure PII is not logged

## Future Enhancements

1. **Advanced NLP**: Use ML model for better query parsing
2. **Market Scenario Analysis**: Monte Carlo simulations
3. **Tax Optimization**: Tax-efficient withdrawal strategies
4. **Real-time Rates**: Integrate with market data APIs
5. **PDF Report Generation**: Export plans as professional reports
6. **Portfolio Recommendations**: Integration with fund/investment databases
7. **Multi-currency Support**: Real-time currency conversions
8. **Recurring Analysis**: Periodic plan review and updates

## Build and Run

```powershell
# Build
cd demo
.\mvnw.cmd clean package

# Run
.\mvnw.cmd spring-boot:run

# Test endpoint
curl -X POST http://localhost:8080/api/v1/retirement-plans/health
```

## Dependencies

- Spring Boot 3.4.2
- Java 17
- H2 Database (for Spring Batch jobs)
- Lombok
- Spring Batch (existing)

No additional AI libraries required for basic functionality. External AI JAR can be integrated following the patterns outlined in the "Integration with AI JAR" section.