package com.example.demo.retirement.models;

import java.time.Instant;

/**
 * A single entry in a case's audit trail.
 *
 * <p>Every state transition, rule decision and outbound contact is recorded so
 * Operations can see what happened and why. {@link #automated} separates work
 * the platform performed from work a person performed, which is what the
 * efficiency measures are built from.</p>
 */
public class JourneyEvent {

    private Instant at;
    /** Action framework reference, for example {@code ACTION_MATURITY_01}. */
    private String action;
    /** Who caused the transition: Automation, Customer, Broker or Case worker. */
    private String actor;
    private String detail;
    /** Case status after this event. */
    private CaseStatus status;
    private boolean automated;

    public JourneyEvent() {
    }

    public JourneyEvent(Instant at, String action, String actor, String detail,
                        CaseStatus status, boolean automated) {
        this.at = at;
        this.action = action;
        this.actor = actor;
        this.detail = detail;
        this.status = status;
        this.automated = automated;
    }

    /** Records work the platform performed without a person. */
    public static JourneyEvent automated(String action, String detail, CaseStatus status) {
        return new JourneyEvent(Instant.now(), action, "Automation", detail, status, true);
    }

    /** Records work a person performed. */
    public static JourneyEvent manual(String action, String actor, String detail, CaseStatus status) {
        return new JourneyEvent(Instant.now(), action, actor, detail, status, false);
    }

    public Instant getAt() {
        return at;
    }

    public void setAt(Instant at) {
        this.at = at;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String actor) {
        this.actor = actor;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    public CaseStatus getStatus() {
        return status;
    }

    public void setStatus(CaseStatus status) {
        this.status = status;
    }

    public boolean isAutomated() {
        return automated;
    }

    public void setAutomated(boolean automated) {
        this.automated = automated;
    }
}
