package com.example.demo.retirement.api.dto;

import com.example.demo.retirement.models.MaturityOption;

/** Customer's non-binding steer, sent when asking an advisor to advise. */
public record AdviceRequestFromCustomer(MaturityOption preference) {
}
