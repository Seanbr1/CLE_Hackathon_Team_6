package com.example.demo.retirement.api;

import com.example.demo.retirement.models.Case;
import com.example.demo.retirement.service.DemoDataService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Demo-only control for restoring the prototype scenarios between runs.
 */
@RestController
@RequestMapping("/api/v1/demo")
public class DemoDataController {

    private final DemoDataService demoDataService;

    public DemoDataController(DemoDataService demoDataService) {
        this.demoDataService = demoDataService;
    }

    /** Clears all demo data and re-seeds the three prototype scenarios. */
    @PostMapping("/reset")
    public List<Case> reset() {
        demoDataService.reset();
        return demoDataService.listCases();
    }
}
