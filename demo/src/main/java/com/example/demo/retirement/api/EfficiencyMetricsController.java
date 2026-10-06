package com.example.demo.retirement.api;

import com.example.demo.retirement.api.dto.EfficiencyMetricsResponse;
import com.example.demo.retirement.service.EfficiencyMetricsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Operational efficiency measures used by the maturity operations dashboard.
 */
@RestController
@RequestMapping("/api/v1/metrics")
public class EfficiencyMetricsController {

    private final EfficiencyMetricsService efficiencyMetricsService;

    public EfficiencyMetricsController(EfficiencyMetricsService efficiencyMetricsService) {
        this.efficiencyMetricsService = efficiencyMetricsService;
    }

    @GetMapping("/efficiency")
    public EfficiencyMetricsResponse efficiency() {
        return efficiencyMetricsService.calculate();
    }
}
