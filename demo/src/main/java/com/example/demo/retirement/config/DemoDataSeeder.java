package com.example.demo.retirement.config;

import com.example.demo.retirement.service.DemoDataService;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Seeds the prototype scenarios at start-up unless demo seeding is switched off.
 */
@Configuration
@ConditionalOnProperty(name = "retirement.demo.seed.enabled", havingValue = "true", matchIfMissing = true)
public class DemoDataSeeder {

    @Bean
    ApplicationRunner seedDemoScenarios(DemoDataService demoDataService) {
        return args -> demoDataService.seedIfEmpty();
    }
}
