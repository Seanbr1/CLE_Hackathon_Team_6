package com.example.demo.retirement.models;

public enum CaseStatus {
    NEW,
    MATURITY_DETECTED,
    CLE_OWNER_DETECTED,
    NON_CLE_OWNER_DETECTED,
    MATURITY_PACKAGE_SENT,
    /** Customer has asked their advisor to advise before any option is selected. */
    ADVICE_REQUESTED,
    /** Advisor has accepted the lead and booked an advice appointment. */
    APPOINTMENT_BOOKED,
    AWAITING_INFORMATION,
    IN_PROGRESS,
    AWAITING_CUSTOMER,
    ON_HOLD,
    COMPLETED,
    CANCELLED
}