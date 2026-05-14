package com.cmsrule.config;

import com.cmsrule.repository.RuleGroupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * 自定义健康检查
 * 验证数据库连接是否正常
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CustomHealthIndicator implements HealthIndicator {

    private final RuleGroupRepository ruleGroupRepository;

    @Override
    public Health health() {
        try {
            // 验证数据库可访问
            ruleGroupRepository.count();
            return Health.up()
                    .withDetail("database", "connected")
                    .build();
        } catch (Exception e) {
            log.warn("健康检查 - 数据库连接异常: {}", e.getMessage());
            return Health.down()
                    .withDetail("database", "disconnected: " + e.getMessage())
                    .build();
        }
    }
}
