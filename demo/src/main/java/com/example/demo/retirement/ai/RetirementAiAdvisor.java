package com.example.demo.retirement.ai;

import com.example.demo.retirement.models.RetirementPlan;
import com.example.demo.retirement.models.RetirementYearPlan;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Thin wrapper around Spring AI's {@link ChatClient} that turns partner query
 * strings and computed cash-flow projections into natural-language retirement
 * advice.
 *
 * <p>Replaces the hand-written string parsing and hard-coded recommendation
 * templates. The component degrades gracefully: when no {@code ChatModel} bean
 * is configured (no API key, or {@code spring.ai.model.chat=none}) every method
 * returns {@link Optional#empty()} and callers fall back to deterministic
 * rule-based logic.</p>
 */
@Component
@Slf4j
public class RetirementAiAdvisor {

    private static final String SYSTEM_PROMPT = """
            You are a retirement planning analyst for Canada Life Europe.
            You read customer requests and explain pension drawdown projections.

            Rules you MUST follow:
            - Interpret money using international formats. A comma or a dot may be a
              thousand separator: "EUR 500,000" and "EUR 500.000" both mean 500000.
            - Never invent figures. Use only the numbers supplied to you.
            - Reply with JSON only, matching the requested schema exactly.
            - Keep wording factual and neutral. This is guidance, not financial advice.
            """;

    private static final String PARSE_PROMPT = """
            Extract the retirement planning parameters from this customer query.

            Query:
            ---
            {query}
            ---

            Guidance:
            - desiredMonthlyPension: the monthly income the customer wants, as a plain number.
            - pensionPot: the current pension pot value, as a plain number.
              Strip thousand separators: "EUR 500,000" -> 500000.
            - yearsToMaturity: whole years until the existing fund matures. Default 1 if absent.
            - currency: ISO-4217 code mentioned (EUR, USD, GBP, CHF, JPY, AUD, CAD). Default EUR.
            - retirementYears: how many years of retirement to project. Default 30 if not stated.
            - wantsMixMatch: true if the customer asked for mix-match or blended options.
            - interpretationNote: one sentence describing how you read the request.

            Return null for any value the query genuinely does not contain.
            """;

    private static final String NARRATIVE_PROMPT = """
            Produce retirement guidance for the following customer.

            Original request:
            ---
            {query}
            ---

            Customer profile:
            - Desired monthly pension: {currency} {monthlyPension}
            - Current pension pot: {currency} {pensionPot}
            - Years until existing fund matures: {yearsToMaturity}
            - Projection horizon: {retirementYears} years
            - Sustainability of the projection: {sustainability}
            - Total projected withdrawals: {currency} {totalWithdrawals}
            - Total projected investment growth: {currency} {totalGrowth}

            Year-by-year projection already calculated (do not recalculate):
            {projection}

            Deliver:
            1. executiveSummary - one short paragraph the customer can read first.
            2. overallInsights - a longer analysis covering whether the pot supports the
               desired income, the mix-match strategy across early / mid / late retirement,
               and concrete action points.
            3. recommendedMaturityOption - exactly one of: ANNUITY, LUMP_SUM, REINVEST.
            4. yearNarratives - one entry for EVERY year listed in the projection, each with:
               - year: the year number
               - recommendation: guidance for that year referencing its actual balance
               - mixMatchOption: a label starting with REINVEST, HYBRID, INCOME_FOCUS or
                 ANNUITY followed by " - " and a short justification.
            """;

    private final ObjectProvider<ChatModel> chatModelProvider;
    private final boolean aiEnabled;

    private volatile ChatClient chatClient;
    private volatile boolean initialised;

    public RetirementAiAdvisor(ObjectProvider<ChatModel> chatModelProvider,
                               @Value("${retirement.ai.enabled:true}") boolean aiEnabled) {
        this.chatModelProvider = chatModelProvider;
        this.aiEnabled = aiEnabled;
    }

    /** @return {@code true} when a chat model is configured and AI is switched on. */
    public boolean isAvailable() {
        return client() != null;
    }

    /**
     * Uses the LLM to read a free-text partner query.
     *
     * @param query the raw customer query string
     * @return parsed parameters, or empty when AI is unavailable or the call failed
     */
    public Optional<ParsedRetirementQuery> parseQuery(String query) {
        ChatClient client = client();
        if (client == null || query == null || query.isBlank()) {
            return Optional.empty();
        }
        try {
            ParsedRetirementQuery parsed = client.prompt()
                    .user(u -> u.text(PARSE_PROMPT).param("query", query))
                    .call()
                    .entity(ParsedRetirementQuery.class);

            if (parsed == null || !parsed.isUsable()) {
                log.warn("AI query parsing returned an unusable result; falling back to rule-based parsing");
                return Optional.empty();
            }
            log.debug("AI parsed query: pot={}, monthly={}, years={}",
                    parsed.pensionPot(), parsed.desiredMonthlyPension(), parsed.yearsToMaturity());
            return Optional.of(parsed);
        } catch (Exception e) {
            log.warn("AI query parsing failed ({}); falling back to rule-based parsing", e.toString());
            return Optional.empty();
        }
    }

    /**
     * Asks the LLM to narrate an already-calculated projection.
     *
     * @param plan          plan holding the computed year-by-year cash flows
     * @param customerQuery the original request, used for tone and context
     * @return generated narrative, or empty when AI is unavailable or the call failed
     */
    public Optional<AiRetirementNarrative> generateNarrative(RetirementPlan plan, String customerQuery) {
        ChatClient client = client();
        if (client == null || plan == null) {
            return Optional.empty();
        }
        try {
            AiRetirementNarrative narrative = client.prompt()
                    .user(u -> u.text(NARRATIVE_PROMPT)
                            .param("query", customerQuery == null ? "(not supplied)" : customerQuery)
                            .param("currency", nullSafe(plan.getCurrency()))
                            .param("monthlyPension", nullSafe(plan.getDesiredMonthlyPension()))
                            .param("pensionPot", nullSafe(plan.getPensionPot()))
                            .param("yearsToMaturity", nullSafe(plan.getYearsToMaturity()))
                            .param("retirementYears", nullSafe(plan.getTotalRetirementYears()))
                            .param("sustainability", nullSafe(plan.getSustainabilityStatus()))
                            .param("totalWithdrawals", nullSafe(plan.getTotalProjectedWithdrawals()))
                            .param("totalGrowth", nullSafe(plan.getTotalProjectedIncome()))
                            .param("projection", renderProjection(plan.getYearlyPlans())))
                    .call()
                    .entity(AiRetirementNarrative.class);

            return Optional.ofNullable(narrative);
        } catch (Exception e) {
            log.warn("AI narrative generation failed ({}); falling back to rule-based insights", e.toString());
            return Optional.empty();
        }
    }

    /** Renders the projection as a compact table the model can reason over. */
    private String renderProjection(List<RetirementYearPlan> yearlyPlans) {
        if (yearlyPlans == null || yearlyPlans.isEmpty()) {
            return "(no projection rows)";
        }
        StringBuilder table = new StringBuilder(
                "year | openingBalance | withdrawal | growth | closingBalance | sustainable\n");
        for (RetirementYearPlan year : yearlyPlans) {
            table.append(year.getYear()).append(" | ")
                    .append(nullSafe(year.getBeginningBalance())).append(" | ")
                    .append(nullSafe(year.getAnnualPensionWithdrawal())).append(" | ")
                    .append(nullSafe(year.getInvestmentGain())).append(" | ")
                    .append(nullSafe(year.getEndingBalance())).append(" | ")
                    .append(Boolean.TRUE.equals(year.getIsSustainable()))
                    .append('\n');
        }
        return table.toString();
    }

    private String nullSafe(Object value) {
        return value == null ? "unknown" : value.toString();
    }

    /**
     * Lazily resolves the chat client so a missing or misconfigured model never
     * breaks startup or a request.
     *
     * <p>We deliberately depend on {@link ChatModel} rather than on
     * {@code ChatClient.Builder}: Spring AI always registers a
     * {@code chatClientBuilder} bean definition, so resolving it would eagerly
     * instantiate it and throw when no {@code ChatModel} exists. A missing
     * {@code ChatModel} on the other hand simply resolves to {@code null}.</p>
     */
    private ChatClient client() {
        if (!aiEnabled) {
            return null;
        }
        if (!initialised) {
            synchronized (this) {
                if (!initialised) {
                    try {
                        ChatModel chatModel = chatModelProvider.getIfAvailable();
                        if (chatModel == null) {
                            log.info("No Spring AI ChatModel configured - retirement insights use rule-based fallback");
                        } else {
                            chatClient = ChatClient.builder(chatModel)
                                    .defaultSystem(SYSTEM_PROMPT)
                                    .build();
                            log.info("Spring AI ChatClient initialised using {}", chatModel.getClass().getSimpleName());
                        }
                    } catch (Exception e) {
                        log.warn("Could not initialise Spring AI ChatClient ({}); using rule-based fallback",
                                e.toString());
                        chatClient = null;
                    } finally {
                        initialised = true;
                    }
                }
            }
        }
        return chatClient;
    }
}