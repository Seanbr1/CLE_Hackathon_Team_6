package com.example.demo.retirement.api.dto;

import com.example.demo.retirement.models.RequiredDocument;

/**
 * A document upload. {@code fileName} is informational only - the demo does not store content.
 *
 * <p>{@code accountHolder} is the name read from a bank-details document. When it is supplied
 * and does not match the policyholder, validation holds the case for human review.</p>
 */
public record DocumentUploadRequest(RequiredDocument document, String fileName, String accountHolder) {
}
