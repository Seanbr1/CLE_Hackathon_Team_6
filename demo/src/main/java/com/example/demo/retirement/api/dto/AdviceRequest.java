package com.example.demo.retirement.api.dto;

import com.example.demo.retirement.models.MaturityOption;

import java.time.Instant;

/** Advisor actions on a case: accepting the lead, booking, and recording advice. */
public record AdviceRequest(
        MaturityOption recommendedOption,
        String rationale,
        String advisor,
        String channel,
        Instant appointmentAt
) {
}
