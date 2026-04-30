package com.cmsrule.config;

import com.cmsrule.entity.Rule;
import com.cmsrule.entity.RuleGroup;
import com.cmsrule.entity.RuleStatus;
import com.cmsrule.repository.RuleGroupRepository;
import com.cmsrule.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 初始化演示数据
 * 创建2个分组和3条规则
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RuleGroupRepository ruleGroupRepository;
    private final RuleRepository ruleRepository;

    @Override
    public void run(String... args) {
        if (ruleGroupRepository.count() > 0) {
            log.info("数据库已有数据，跳过初始化");
            return;
        }

        log.info("初始化演示数据...");

        // 创建2个分组
        String groupId1 = UUID.randomUUID().toString();
        String groupId2 = UUID.randomUUID().toString();

        ruleGroupRepository.save(RuleGroup.builder()
                .id(groupId1)
                .name("温度控制")
                .tabOrder(0)
                .build());

        ruleGroupRepository.save(RuleGroup.builder()
                .id(groupId2)
                .name("空调策略")
                .tabOrder(1)
                .build());

        // 创建3条规则
        // 规则1: 空调自动开启 - AND分支判断 + modify
        String ruleId1 = UUID.randomUUID().toString();
        String flow1 = "{\"nodes\":{" +
                "\"nd_001\":{\"id\":\"nd_001\",\"type\":\"and_branch\",\"name\":\"温湿度判断\",\"config\":{},\"branches\":[" +
                "{\"id\":\"br_001\",\"name\":\"分支1\",\"config\":{\"condMode\":\"param\",\"param\":\"室内温度\",\"op\":\">\",\"threshold\":\"26\"},\"nested\":[]}," +
                "{\"id\":\"br_002\",\"name\":\"分支2\",\"config\":{\"condMode\":\"param\",\"param\":\"相对湿度\",\"op\":\">\",\"threshold\":\"60\"},\"nested\":[]}]}," +
                "\"nd_002\":{\"id\":\"nd_002\",\"type\":\"modify\",\"name\":\"开启空调\",\"config\":{\"param\":\"1#空调启停\",\"value\":\"1\",\"limitMin\":\"\",\"limitMax\":\"\"}}}" +
                ",\"mainFlow\":[\"nd_001\",\"nd_002\"]}";

        ruleRepository.save(Rule.builder()
                .id(ruleId1)
                .groupId(groupId1)
                .name("空调自动开启")
                .description("当温度超过26°C或湿度超过60%时开启空调")
                .status(RuleStatus.INACTIVE)
                .pollInterval(30)
                .flow(flow1)
                .build());

        // 规则2: 温度告警 - 条件规则
        String ruleId2 = UUID.randomUUID().toString();
        String flow2 = "{\"nodes\":{" +
                "\"nd_001\":{\"id\":\"nd_001\",\"type\":\"rule\",\"name\":\"温度检查\",\"config\":{\"condMode\":\"param\",\"param\":\"室内温度\",\"op\":\">\",\"threshold\":\"28\"}}" +
                "},\"mainFlow\":[\"nd_001\"]}";

        ruleRepository.save(Rule.builder()
                .id(ruleId2)
                .groupId(groupId1)
                .name("高温告警")
                .description("室内温度超过28°C触发告警")
                .status(RuleStatus.DRAFT)
                .pollInterval(60)
                .flow(flow2)
                .build());

        // 规则3: 定时调温 - 定时器 + modify
        String ruleId3 = UUID.randomUUID().toString();
        String flow3 = "{\"nodes\":{" +
                "\"nd_001\":{\"id\":\"nd_001\",\"type\":\"timer\",\"name\":\"工作时间\",\"config\":{\"kind\":\"daily\",\"groups\":[{\"timeRange\":{\"start\":\"09:00:00\",\"end\":\"18:00:00\"}}]}}," +
                "\"nd_002\":{\"id\":\"nd_002\",\"type\":\"modify\",\"name\":\"设定温度\",\"config\":{\"param\":\"房间设定温度\",\"value\":\"24\",\"limitMin\":\"18\",\"limitMax\":\"30\"}}" +
                "},\"mainFlow\":[\"nd_001\",\"nd_002\"]}";

        ruleRepository.save(Rule.builder()
                .id(ruleId3)
                .groupId(groupId2)
                .name("定时调温")
                .description("工作时间内设定温度为24°C")
                .status(RuleStatus.INACTIVE)
                .pollInterval(300)
                .flow(flow3)
                .build());

        log.info("演示数据初始化完成: 2个分组, 3条规则");
    }
}
