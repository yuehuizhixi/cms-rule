package com.cmsrule.service;

import com.cmsrule.dto.ApiResponse;
import com.cmsrule.dto.RuleDTO;
import com.cmsrule.entity.Rule;
import com.cmsrule.entity.RuleStatus;
import com.cmsrule.repository.RuleGroupRepository;
import com.cmsrule.repository.RuleRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RuleService {

    private final RuleRepository ruleRepository;
    private final RuleGroupRepository ruleGroupRepository;
    private final RuleEngineService ruleEngineService;
    private final ObjectMapper objectMapper;

    public List<RuleDTO.Rule> findAll(String groupId) {
        List<Rule> rules;
        if (groupId != null && !groupId.isBlank()) {
            rules = ruleRepository.findByGroupIdOrderByNameAsc(groupId);
        } else {
            rules = ruleRepository.findAll();
        }
        return rules.stream().map(this::toRule).collect(Collectors.toList());
    }

    public RuleDTO.Rule findById(String ruleId) {
        Rule rule = ruleRepository.findById(ruleId)
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_RULE_NOT_FOUND, "规则不存在"));
        return toRule(rule);
    }

    @Transactional
    public Rule create(RuleDTO.CreateRequest req) {
        ruleGroupRepository.findById(req.getGroupId())
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_GROUP_NOT_FOUND, "分组不存在"));

        if (ruleRepository.findByGroupIdAndName(req.getGroupId(), req.getName()).isPresent()) {
            throw new BusinessException(ApiResponse.ERR_DUPLICATE_NAME, "规则名在分组内已存在");
        }

        String pollStr;
        if (req.getPollInterval() != null && req.getPollInterval() > 0) {
            pollStr = String.valueOf(req.getPollInterval());
        } else {
            pollStr = "30";
        }
        int pollInterval = Integer.parseInt(pollStr);
        if (pollInterval <= 0 || pollInterval > 2592000) {
            pollInterval = 30;
        }

        Rule rule = Rule.builder()
                .id(UUID.randomUUID().toString())
                .groupId(req.getGroupId())
                .name(req.getName())
                .description(req.getDescription() != null ? req.getDescription() : "")
                .pollInterval(pollInterval)
                .status(RuleStatus.DRAFT)
                .flow("{\"nodes\":{},\"mainFlow\":[]}")
                .build();
        Rule saved = ruleRepository.save(rule);
        log.info("创建规则: {} ({}) - group={}", saved.getName(), saved.getId(), saved.getGroupId());
        return saved;
    }

    @Transactional
    public Rule update(String ruleId, RuleDTO.UpdateRequest req) {
        Rule rule = ruleRepository.findById(ruleId)
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_RULE_NOT_FOUND, "规则不存在"));

        if (rule.getStatus() == RuleStatus.ACTIVE) {
            throw new BusinessException(4003, "规则启用中，不可编辑");
        }

        if (req.getName() != null) {
            // Check duplicate name in same group
            var existing = ruleRepository.findByGroupIdAndName(rule.getGroupId(), req.getName());
            if (existing.isPresent() && !existing.get().getId().equals(ruleId)) {
                throw new BusinessException(ApiResponse.ERR_DUPLICATE_NAME, "规则名在分组内已存在");
            }
            rule.setName(req.getName());
        }
        if (req.getDescription() != null) {
            rule.setDescription(req.getDescription());
        }
        if (req.getPollInterval() != null) {
            if (req.getPollInterval() <= 0 || req.getPollInterval() > 2592000) {
                throw new BusinessException(4005, "轮询间隔必须在1~2592000秒之间");
            }
            rule.setPollInterval(req.getPollInterval());
        }

        rule.setUpdatedAt(LocalDateTime.now());
        Rule saved = ruleRepository.save(rule);

        // Refresh engine if active
        if (saved.getStatus() == RuleStatus.ACTIVE) {
            ruleEngineService.refreshRule(ruleId);
        }

        return saved;
    }

    @Transactional
    public Rule updateFlow(String ruleId, String flow, boolean asDraft) {
        Rule rule = ruleRepository.findById(ruleId)
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_RULE_NOT_FOUND, "规则不存在"));

        if (rule.getStatus() == RuleStatus.ACTIVE) {
            throw new BusinessException(4003, "规则启用中，不可编辑流程");
        }

        // Parse and validate flow JSON structure
        try {
            JsonNode flowNode = objectMapper.readTree(flow);
            if (!flowNode.has("nodes") || !flowNode.has("mainFlow")) {
                throw new BusinessException(ApiResponse.ERR_FLOW_INCOMPLETE, "流程JSON格式错误：缺少nodes或mainFlow");
            }

            if (!asDraft) {
                // Full validation for save
                String validationError = validateFlowComplete(flowNode);
                if (validationError != null) {
                    throw new BusinessException(ApiResponse.ERR_FLOW_INCOMPLETE, validationError);
                }
            }
        } catch (Exception e) {
            if (e instanceof BusinessException) throw (BusinessException) e;
            throw new BusinessException(ApiResponse.ERR_FLOW_INCOMPLETE, "流程JSON格式错误: " + e.getMessage());
        }

        rule.setFlow(flow);
        rule.setUpdatedAt(LocalDateTime.now());

        if (!asDraft) {
            rule.setStatus(RuleStatus.INACTIVE);
        } else {
            rule.setStatus(RuleStatus.DRAFT);
        }

        Rule saved = ruleRepository.save(rule);
        log.info("{}流程: {} ({}) - {}", asDraft ? "暂存" : "保存", saved.getName(), saved.getId(),
                asDraft ? "DRAFT" : "INACTIVE");

        // Stop engine if it was somehow running
        ruleEngineService.stopRule(ruleId);

        return saved;
    }

    /**
     * Validate flow completeness according to PRD specs
     */
    private String validateFlowComplete(JsonNode flow) {
        JsonNode mainFlow = flow.get("mainFlow");
        if (!mainFlow.isArray() || mainFlow.isEmpty()) {
            return "主流程为空";
        }

        JsonNode nodes = flow.get("nodes");
        if (!nodes.isObject() || nodes.isEmpty()) {
            return "节点列表为空";
        }

        // Check each node in mainFlow exists
        for (JsonNode nid : mainFlow) {
            String nodeId = nid.asText();
            JsonNode node = nodes.get(nodeId);
            if (node == null) {
                return "主流程引用不存在的节点: " + nodeId;
            }
        }

        // Check each node is configured
        for (var it = nodes.fields(); it.hasNext(); ) {
            var entry = it.next();
            String nodeId = entry.getKey();
            JsonNode node = entry.getValue();

            String type = node.path("type").asText();
            JsonNode config = node.path("config");

            switch (type) {
                case "rule":
                case "route":
                    if (!isCondConfigured(config)) {
                        return "节点「" + node.path("name").asText() + "」条件配置不完整";
                    }
                    if ("route".equals(type)) {
                        String targetId = config.path("targetId").asText();
                        if (targetId.isEmpty()) {
                            return "路由节点「" + node.path("name").asText() + "」未选择目标节点";
                        }
                        JsonNode target = nodes.get(targetId);
                        if (target == null) {
                            return "路由节点「" + node.path("name").asText() + "」目标节点不存在";
                        }
                        if ("route".equals(target.path("type").asText())) {
                            return "路由节点「" + node.path("name").asText() + "」目标不能是路由节点";
                        }
                    }
                    break;
                case "and_branch":
                case "or_branch":
                    JsonNode branches = node.path("branches");
                    if (!branches.isArray() || branches.size() < 2) {
                        return "分支节点「" + node.path("name").asText() + "」至少需要2个分支";
                    }
                    for (JsonNode branch : branches) {
                        if (!isCondConfigured(branch.path("config"))) {
                            return "分支节点「" + node.path("name").asText() + "」分支「"
                                    + branch.path("name").asText() + "」条件不完整";
                        }
                        JsonNode nested = branch.path("nested");
                        if (nested.isArray()) {
                            for (JsonNode nid : nested) {
                                String nidStr = nid.asText();
                                JsonNode nestedNode = nodes.get(nidStr);
                                if (nestedNode == null) continue;
                                String nt = nestedNode.path("type").asText();
                                if (!"rule".equals(nt) && !"and_branch".equals(nt) && !"or_branch".equals(nt)) {
                                    return "嵌套节点不能包含类型: " + nt;
                                }
                            }
                        }
                    }
                    break;
                case "timer":
                    String kind = config.path("kind").asText();
                    if (kind.isEmpty()) {
                        return "定时节点「" + node.path("name").asText() + "」未配置触发类型";
                    }
                    JsonNode groups = config.path("groups");
                    if (!groups.isArray() || groups.isEmpty()) {
                        return "定时节点「" + node.path("name").asText() + "」未配置时段";
                    }
                    break;
                case "delay":
                    if (config.path("value").asText().isEmpty() || config.path("unit").asText().isEmpty()) {
                        return "延时节点「" + node.path("name").asText() + "」配置不完整";
                    }
                    break;
                case "modify":
                    if (config.path("param").asText().isEmpty() || config.path("value").asText().isEmpty()) {
                        return "修改点值节点「" + node.path("name").asText() + "」配置不完整";
                    }
                    break;
                default:
                    return "未知节点类型: " + type;
            }
        }

        return null; // All valid
    }

    private boolean isCondConfigured(JsonNode config) {
        if (config == null || config.isMissingNode()) return false;
        String mode = config.path("condMode").asText("param");
        if ("script".equals(mode)) {
            return !config.path("script").asText("").trim().isEmpty();
        }
        String param = config.path("param").asText();
        String op = config.path("op").asText();
        if (param.isEmpty() || op.isEmpty()) return false;
        if ("范围内".equals(op)) {
            String min = config.path("min").asText();
            String max = config.path("max").asText();
            return !min.isEmpty() && !max.isEmpty();
        }
        return !config.path("threshold").asText().isEmpty();
    }

    @Transactional
    public Rule updateStatus(String ruleId, RuleStatus status) {
        Rule rule = ruleRepository.findById(ruleId)
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_RULE_NOT_FOUND, "规则不存在"));

        // Idempotent check
        if (rule.getStatus() == status) {
            return rule;
        }

        if (status == RuleStatus.ACTIVE) {
            // Verify flow is complete
            String flow = rule.getFlow();
            if (flow == null || flow.isBlank()) {
                throw new BusinessException(ApiResponse.ERR_FLOW_INCOMPLETE, "规则流程不完整，不可启用");
            }
            try {
                JsonNode flowNode = objectMapper.readTree(flow);
                String validationError = validateFlowComplete(flowNode);
                if (validationError != null) {
                    throw new BusinessException(ApiResponse.ERR_FLOW_INCOMPLETE, "规则流程不完整，不可启用: " + validationError);
                }
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                throw new BusinessException(ApiResponse.ERR_FLOW_INCOMPLETE, "规则流程格式错误，不可启用");
            }
        }

        rule.setStatus(status);
        rule.setUpdatedAt(LocalDateTime.now());
        Rule savedRule = ruleRepository.save(rule);

        // Notify engine
        if (status == RuleStatus.ACTIVE) {
            ruleEngineService.startRule(savedRule);
        } else {
            ruleEngineService.stopRule(ruleId);
        }

        log.info("规则状态变更: {} ({}) -> {}", savedRule.getName(), savedRule.getId(), status);
        return savedRule;
    }

    @Transactional
    public void delete(String ruleId) {
        ruleEngineService.stopRule(ruleId);
        ruleRepository.findById(ruleId).ifPresent(rule -> {
            ruleRepository.delete(rule);
            log.info("删除规则: {} ({})", rule.getName(), ruleId);
        });
    }

    @Transactional
    public void batchDelete(List<String> ruleIds) {
        for (String ruleId : ruleIds) {
            ruleEngineService.stopRule(ruleId);
        }
        List<Rule> rules = ruleRepository.findAllById(ruleIds);
        ruleRepository.deleteAll(rules);
        log.info("批量删除规则: {} 条", rules.size());
    }

    public RuleDTO.Rule toRule(Rule rule) {
        return new RuleDTO.Rule(
                rule.getId(),
                rule.getGroupId(),
                rule.getName(),
                rule.getDescription(),
                rule.getStatus(),
                rule.getPollInterval(),
                rule.getFlow(),
                rule.getCreatedAt(),
                rule.getUpdatedAt()
        );
    }

    public static class BusinessException extends RuntimeException {
        private final int code;
        public BusinessException(int code, String message) {
            super(message);
            this.code = code;
        }
        public int getCode() { return code; }
    }
}
