package com.example.demo.retirement.models;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * A retirement journey case tracked by the back-office.
 */
public class Case {

    private String caseId;
    private String caseName;
    private CaseStatus caseStatus;
    private String caseSla;
    private String owner;
    private String description;
    /** One-to-one link to {@link Policy#getPolicyId()}. At most one case per policy. */
    private String policyId;
    /** Owner classification, populated by the owner-detection step. */
    private OwnerType ownerType;
    /** Routing mailbox derived from {@link #ownerType}. */
    private String email;
    /** Binding maturity option. Recorded by the advisor, not the customer. */
    private MaturityOption maturityOption;
    /** Non-binding steer the customer shared before advice. Context for the advisor. */
    private MaturityOption customerPreference;
    /** When the advisor accepted the qualified lead. */
    private Instant leadAcceptedAt;
    /** When the advice appointment is scheduled for. */
    private Instant appointmentAt;
    /** Advice given before the binding option was recorded. */
    private AdviceRecord adviceRecord;
    /** Documents the customer has uploaded so far. */
    private final List<RequiredDocument> uploadedDocuments = new ArrayList<>();
    /** Set when the case is an exception that must not be processed automatically. */
    private String exceptionReason;
    /** Audit trail of every transition applied to this case. */
    private final List<JourneyEvent> journeyEvents = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    public Case() {
    }

    public Case(String caseId, String caseName, CaseStatus caseStatus, String caseSla,
                String owner, String description, Instant createdAt, Instant updatedAt) {
        this(caseId, caseName, caseStatus, caseSla, owner, description, null, createdAt, updatedAt);
    }

    public Case(String caseId, String caseName, CaseStatus caseStatus, String caseSla,
                String owner, String description, String policyId, Instant createdAt, Instant updatedAt) {
        this.caseId = caseId;
        this.caseName = caseName;
        this.caseStatus = caseStatus;
        this.caseSla = caseSla;
        this.owner = owner;
        this.description = description;
        this.policyId = policyId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getPolicyId() {
        return policyId;
    }

    public void setPolicyId(String policyId) {
        this.policyId = policyId;
    }

    public OwnerType getOwnerType() {
        return ownerType;
    }

    public void setOwnerType(OwnerType ownerType) {
        this.ownerType = ownerType;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getCaseId() {
        return caseId;
    }

    public void setCaseId(String caseId) {
        this.caseId = caseId;
    }

    public String getCaseName() {
        return caseName;
    }

    public void setCaseName(String caseName) {
        this.caseName = caseName;
    }

    public CaseStatus getCaseStatus() {
        return caseStatus;
    }

    public void setCaseStatus(CaseStatus caseStatus) {
        this.caseStatus = caseStatus;
    }

    public String getCaseSla() {
        return caseSla;
    }

    public void setCaseSla(String caseSla) {
        this.caseSla = caseSla;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public MaturityOption getMaturityOption() {
        return maturityOption;
    }

    public void setMaturityOption(MaturityOption maturityOption) {
        this.maturityOption = maturityOption;
    }

    public MaturityOption getCustomerPreference() {
        return customerPreference;
    }

    public void setCustomerPreference(MaturityOption customerPreference) {
        this.customerPreference = customerPreference;
    }

    public Instant getLeadAcceptedAt() {
        return leadAcceptedAt;
    }

    public void setLeadAcceptedAt(Instant leadAcceptedAt) {
        this.leadAcceptedAt = leadAcceptedAt;
    }

    public Instant getAppointmentAt() {
        return appointmentAt;
    }

    public void setAppointmentAt(Instant appointmentAt) {
        this.appointmentAt = appointmentAt;
    }

    public AdviceRecord getAdviceRecord() {
        return adviceRecord;
    }

    public void setAdviceRecord(AdviceRecord adviceRecord) {
        this.adviceRecord = adviceRecord;
    }

    public List<RequiredDocument> getUploadedDocuments() {
        return uploadedDocuments;
    }

    public void setUploadedDocuments(List<RequiredDocument> documents) {
        this.uploadedDocuments.clear();
        if (documents != null) {
            this.uploadedDocuments.addAll(documents);
        }
    }

    /** @return {@code true} when the document was newly added. */
    public boolean addUploadedDocument(RequiredDocument document) {
        if (document == null || uploadedDocuments.contains(document)) {
            return false;
        }
        return uploadedDocuments.add(document);
    }

    public String getExceptionReason() {
        return exceptionReason;
    }

    public void setExceptionReason(String exceptionReason) {
        this.exceptionReason = exceptionReason;
    }

    public List<JourneyEvent> getJourneyEvents() {
        return journeyEvents;
    }

    public void setJourneyEvents(List<JourneyEvent> events) {
        this.journeyEvents.clear();
        if (events != null) {
            this.journeyEvents.addAll(events);
        }
    }

    public void recordEvent(JourneyEvent event) {
        if (event != null) {
            journeyEvents.add(event);
        }
    }

    /**
     * Processing lane derived from the current case state.
     *
     * @return {@code null} until the customer has responded, because a lane can
     *         only be decided once there is a response to validate.
     */
    public ProcessingLane getProcessingLane() {
        if (exceptionReason != null && !exceptionReason.isBlank()) {
            return ProcessingLane.RED;
        }
        if (caseStatus == CaseStatus.ON_HOLD || caseStatus == CaseStatus.CANCELLED) {
            return ProcessingLane.RED;
        }
        if (maturityOption == null) {
            return null;
        }
        return uploadedDocuments.containsAll(List.of(RequiredDocument.values()))
                ? ProcessingLane.GREEN
                : ProcessingLane.AMBER;
    }

    /** Required documents the customer has not supplied yet. */
    public List<RequiredDocument> getOutstandingDocuments() {
        return Arrays.stream(RequiredDocument.values())
                .filter(document -> !uploadedDocuments.contains(document))
                .toList();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}