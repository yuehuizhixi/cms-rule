package com.cmsrule.service;

import com.cmsrule.entity.Rule;
import com.cmsrule.entity.RuleGroup;
import com.cmsrule.repository.RuleGroupRepository;
import com.cmsrule.repository.RuleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImportExportService {

    public static class BusinessException extends RuntimeException {
        private final int code;
        public BusinessException(int code, String message) {
            super(message);
            this.code = code;
        }
        public int getCode() { return code; }
    }

    private final RuleRepository ruleRepository;
    private final RuleGroupRepository ruleGroupRepository;
    private final ObjectMapper objectMapper;

    // 导出格式
    public String exportRules(List<String> ruleIds) throws Exception {
        List<Rule> rules = ruleRepository.findAllById(ruleIds);
        List<Map<String, Object>> exports = rules.stream().map(rule -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", rule.getName());
            m.put("description", rule.getDescription());
            m.put("pollInterval", rule.getPollInterval());
            try {
                m.put("flow", objectMapper.readTree(rule.getFlow()));
            } catch (Exception e) {
                m.put("flow", rule.getFlow());
            }
            m.put("groupName", ruleGroupRepository.findById(rule.getGroupId())
                    .map(RuleGroup::getName).orElse(""));
            return m;
        }).collect(Collectors.toList());
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(exports);
    }

    // 导入规则
    @Transactional
    public int importRules(String jsonData, String targetGroupId) throws Exception {
        log.info("Import received {} chars", jsonData != null ? jsonData.length() : 0);
        // 解析JSON（支持传入JSON字符串或JSON数组）
        java.util.List<java.util.Map<String, Object>> imported;
        try {
            imported = objectMapper.readValue(jsonData,
                    objectMapper.getTypeFactory().constructCollectionType(java.util.List.class, java.util.Map.class));
        } catch (Exception e) {
            // 可能是字符串被双重序列化，尝试预处理
            String cleaned = jsonData;
            if (cleaned.startsWith("\"\"")) {
                cleaned = cleaned.substring(1); // 去掉前导多余引号
            }
            if (cleaned.endsWith("\"")) {
                cleaned = cleaned.substring(0, cleaned.length() - 1);
            }
            try {
                imported = objectMapper.readValue(cleaned,
                        objectMapper.getTypeFactory().constructCollectionType(java.util.List.class, java.util.Map.class));
            } catch (Exception e2) {
                // 最后尝试：将整个输入作为JSON解析（可能是数组）
                com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(jsonData);
                if (node.isArray()) {
                    imported = objectMapper.convertValue(node,
                            objectMapper.getTypeFactory().constructCollectionType(java.util.List.class, java.util.Map.class));
                } else {
                    throw new BusinessException(4001, "导入数据格式错误: " + e2.getMessage());
                }
            }
        }

        int count = 0;
        for (Map item : imported) {
            String name = (String) item.get("name");
            if (ruleRepository.findByGroupIdAndName(targetGroupId, name).isPresent()) {
                log.warn("规则已存在，跳过: {}", name);
                continue;
            }

            Object flowObj = item.get("flow");
            String flowJson = objectMapper.writeValueAsString(flowObj);

            Rule rule = Rule.builder()
                    .id(UUID.randomUUID().toString())
                    .groupId(targetGroupId)
                    .name(name)
                    .description((String) item.get("description"))
                    .pollInterval((Integer) item.getOrDefault("pollInterval", 30))
                    .flow(flowJson)
                    .build();
            ruleRepository.save(rule);
            count++;
        }
        return count;
    }
}
