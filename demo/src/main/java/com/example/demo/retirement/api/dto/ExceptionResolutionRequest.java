package com.example.demo.retirement.api.dto;

/**
 * A case worker's resolution of a validation exception.
 *
 * @param note  what was checked and why the case can proceed
 * @param actor who resolved it; defaults to "Case worker"
 */
public record ExceptionResolutionRequest(String note, String actor) {
}
