package com.cmsrule.service;

import com.cmsrule.entity.Rule;
import com.cmsrule.entity.RuleStatus;
import com.cmsrule.repository.RuleRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.PeriodicTrigger;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class RuleEngineService {

    private final RuleRepository ruleRepository;
    private final RuleExecutor ruleExecutor;

    private ThreadPoolTaskScheduler scheduler;
    private final Map<String, ScheduledFuture<?>> runningTasks = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);
        scheduler.setThreadNamePrefix("rule-engine-");
        scheduler.initialize();

        // 恢复所有 ACTIVE 规则
        ruleRepository.findByStatus(RuleStatus.ACTIVE).forEach(rule -> {
            log.info("恢复规则调度: {} ({})", rule.getName(), rule.getId());
            startRule(rule);
        });
    }

    @PreDestroy
    public void shutdown() {
        runningTasks.values().forEach(f -> f.cancel(true));
        scheduler.shutdown();
    }

    public void startRule(Rule rule) {
        if (runningTasks.containsKey(rule.getId())) {
            log.warn("规则已在运行: {}", rule.getId());
            return;
        }
        PeriodicTrigger trigger = new PeriodicTrigger(Duration.ofSeconds(rule.getPollInterval()));
        trigger.setInitialDelay(Duration.ofSeconds(2)); // 启动后2秒开始第一次执行
        ScheduledFuture<?> future = scheduler.schedule(
                () -> ruleExecutor.execute(rule),
                trigger
        );
        runningTasks.put(rule.getId(), future);
        log.info("启动规则调度: {} (间隔{}秒)", rule.getName(), rule.getPollInterval());
    }

    public void stopRule(String ruleId) {
        ScheduledFuture<?> future = runningTasks.remove(ruleId);
        if (future != null) {
            future.cancel(true);
            log.info("停止规则调度: {}", ruleId);
        }
    }

    public void refreshRule(String ruleId) {
        // 规则更新后重启调度
        ruleRepository.findById(ruleId).ifPresent(rule -> {
            if (rule.getStatus() == RuleStatus.ACTIVE) {
                stopRule(ruleId);
                startRule(rule);
            }
        });
    }
}
