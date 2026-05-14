package com.cmsrule.config;

import com.cmsrule.repository.RuleGroupRepository;
import com.cmsrule.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 初始化空数据库（默认不做任何演示数据）
 * 部署后由用户手动创建分组和规则
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RuleGroupRepository ruleGroupRepository;
    private final RuleRepository ruleRepository;

    @Override
    public void run(String... args) {
        long groupCount = ruleGroupRepository.count();
        if (groupCount == 0) {
            log.info("数据库为空，等待用户手动创建分组和规则");
        } else {
            log.info("数据库已有 {} 个分组, {} 条规则", groupCount, ruleRepository.count());
        }
    }
}
