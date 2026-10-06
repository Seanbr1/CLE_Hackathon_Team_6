package com.example.demo.retirement.models;

/**
 * Straight-through-processing lane a case falls into once the customer has
 * responded.
 *
 * <p>The operating principle is that the platform handles predictable work and
 * humans handle exceptions:</p>
 * <ul>
 *   <li>{@link #GREEN} - complete and consistent, eligible for STP.</li>
 *   <li>{@link #AMBER} - isolated missing information, one targeted request.</li>
 *   <li>{@link #RED} - conflict or exception, routed to human review.</li>
 * </ul>
 */
public enum ProcessingLane {

    GREEN("Straight-through", "Complete and consistent. No manual handling required."),
    AMBER("Targeted follow-up", "Isolated information outstanding. One targeted request."),
    RED("Human review", "Conflict or exception. A case worker decision is required.");

    private final String label;
    private final String description;

    ProcessingLane(String label, String description) {
        this.label = label;
        this.description = description;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }
}
