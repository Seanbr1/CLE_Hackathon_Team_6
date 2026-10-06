package com.example.demo.retirement.models;

import java.time.Instant;

/**
 * The advice an intermediary or In-House Sales advisor gave before the binding
 * maturity option was recorded.
 *
 * <p>The customer explores options but does not select one. The advisor makes
 * the selection on the customer's behalf, and this record is the evidence of
 * why. In production this would sit alongside a full suitability assessment and
 * the customer's documented authority to proceed.</p>
 */
public class AdviceRecord {

    private MaturityOption recommendedOption;
    private String rationale;
    private String advisedBy;
    /** How the advice was delivered, for example Telephone or Video. */
    private String channel;
    private Instant advisedAt;

    public AdviceRecord() {
    }

    public AdviceRecord(MaturityOption recommendedOption, String rationale,
                        String advisedBy, String channel, Instant advisedAt) {
        this.recommendedOption = recommendedOption;
        this.rationale = rationale;
        this.advisedBy = advisedBy;
        this.channel = channel;
        this.advisedAt = advisedAt;
    }

    public MaturityOption getRecommendedOption() {
        return recommendedOption;
    }

    public void setRecommendedOption(MaturityOption recommendedOption) {
        this.recommendedOption = recommendedOption;
    }

    public String getRationale() {
        return rationale;
    }

    public void setRationale(String rationale) {
        this.rationale = rationale;
    }

    public String getAdvisedBy() {
        return advisedBy;
    }

    public void setAdvisedBy(String advisedBy) {
        this.advisedBy = advisedBy;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public Instant getAdvisedAt() {
        return advisedAt;
    }

    public void setAdvisedAt(Instant advisedAt) {
        this.advisedAt = advisedAt;
    }
}
