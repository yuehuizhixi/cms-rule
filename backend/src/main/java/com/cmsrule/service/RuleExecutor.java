package com.cmsrule.service;

import com.cmsrule.client.PlatformService;
import com.cmsrule.entity.*;
import com.cmsrule.repository.ExecutionLogRepository;
import com.cmsrule.repository.LogEntryRepository;
import com.cmsrule.repository.RuleGroupRepository;
import com.cmsrule.repository.RuleRepository;
import com.cmsrule.sandbox.ScriptSandbox;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * 规则执行引擎核心实现
 * 实现7种节点类型的完整执行逻辑
 * 
 * 节点类型：
 * - rule: 条件判断（参数比较7种运算符 + 脚本两种模式）
 * - and_branch / or_branch: 多分支判断+嵌套子节点
 * - timer: 5种时间模式（specific/daily/weekly/monthly/yearly）
 * - delay: 延时执行
 * - modify: 修改点值
 * - route: 条件跳转
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RuleExecutor {

    private final RuleRepository ruleRepository;
    private final RuleGroupRepository ruleGroupRepository;
    private final ExecutionLogRepository executionLogRepository;
    private final LogEntryRepository logEntryRepository;
    private final ObjectMapper objectMapper;
    private final PlatformService platformService;
    private final ScriptSandbox scriptSandbox;

    @Value("${cms-rule.engine.max-loop-per-node:10}")
    private int maxLoopPerNode;

    // 参数引用模式：<%参数名%>
    private static final Pattern PARAM_REF_PATTERN = Pattern.compile("<%([^%]+)%>");

    // ==================== 主要执行方法 ====================

    public ExecutionLog execute(Rule rule) {
        String ruleId = rule.getId();
        LocalDateTime startTime = LocalDateTime.now();
        ExecutionLog.ExecutionLogBuilder logBuilder = ExecutionLog.builder()
                .id(UUID.randomUUID().toString())
                .ruleId(ruleId)
                .startTime(startTime);

        Map<String, String> nodeResults = new LinkedHashMap<>();
        Map<String, String> branchResults = new LinkedHashMap<>();
        Map<String, Integer> loopCounter = new HashMap<>();
        String errorCode = null;
        ExecutionStatus finalStatus;

        // Generate execution log ID for ref
        String execLogId = logBuilder.build().getId();

        try {
            JsonNode flow = objectMapper.readTree(rule.getFlow());
            JsonNode mainFlow = flow.get("mainFlow");
            if (mainFlow == null || !mainFlow.isArray() || mainFlow.isEmpty()) {
                // Empty flow is not an error, just skip
                saveLogEntry(rule, execLogId, LogLevel.info, "规则流程为空，无操作");
                finalStatus = ExecutionStatus.PASS;
            } else {
                JsonNode nodes = flow.get("nodes");
                // Initialize all nodes as PENDING
                nodes.fieldNames().forEachRemaining(nid -> nodeResults.put(nid, "PENDING"));

                // Build main flow list
                List<String> flowOrdered = new ArrayList<>();
                mainFlow.forEach(n -> flowOrdered.add(n.asText()));

                // Execute main flow sequentially
                int index = 0;
                boolean failed = false;

                while (index < flowOrdered.size() && !failed) {
                    String nodeId = flowOrdered.get(index);
                    JsonNode node = nodes.get(nodeId);
                    if (node == null) {
                        log.warn("节点不存在: {}", nodeId);
                        nodeResults.put(nodeId, "FAIL");
                        saveLogEntry(rule, execLogId, LogLevel.error,
                                "节点不存在: " + nodeId);
                        failed = true;
                        break;
                    }

                    // 环路检测
                    int visitCount = loopCounter.getOrDefault(nodeId, 0) + 1;
                    loopCounter.put(nodeId, visitCount);
                    if (visitCount > maxLoopPerNode) {
                        errorCode = "LOOP_DETECTED";
                        nodeResults.put(nodeId, "ERROR");
                        finalStatus = ExecutionStatus.ERROR;
                        saveLogEntry(rule, execLogId, LogLevel.error,
                                "环路检测：节点「" + node.path("name").asText() + "」访问超过" + maxLoopPerNode + "次");
                        break;
                    }

                    // 执行节点
                    String nodeType = node.path("type").asText("rule");
                    ExecutionResult result = executeSingleNode(node, nodes, flow, nodeResults, branchResults, rule);

                    nodeResults.put(nodeId, result.status.name());

                    if (result.status == ExecutionStatus.FAIL) {
                        // 记录失败日志
                        log.info("节点 {} ({}) 返回FAIL，停止执行", node.path("name").asText(), nodeType);
                        saveLogEntry(rule, execLogId, LogLevel.error,
                                "[" + getNodeTypeLabel(nodeType) + "]「" + node.path("name").asText()
                                        + "」— 条件不满足，中断");
                        failed = true;
                    } else if (result.status == ExecutionStatus.ERROR) {
                        errorCode = "EXECUTION_ERROR";
                        saveLogEntry(rule, execLogId, LogLevel.error,
                                "[" + getNodeTypeLabel(nodeType) + "]「" + node.path("name").asText()
                                        + "」— 执行异常");
                        failed = true;
                    }

                    // 路由跳转
                    if ("route".equals(nodeType) && result.jumpTarget != null) {
                        String targetId = result.jumpTarget;
                        int targetIndex = flowOrdered.indexOf(targetId);
                        if (targetIndex >= 0) {
                            index = targetIndex;
                            log.debug("路由跳转: {} -> {}", node.path("name").asText(), targetId);
                        } else {
                            index++;
                        }
                    } else {
                        index++;
                    }
                }

                // 统计执行结果
                if (!failed && errorCode == null) {
                    finalStatus = ExecutionStatus.PASS;
                } else if (errorCode != null) {
                    finalStatus = ExecutionStatus.ERROR;
                } else {
                    finalStatus = ExecutionStatus.FAIL;
                }

                // 写汇总日志
                long passCnt = nodeResults.values().stream().filter(s -> "PASS".equals(s)).count();
                long failCnt = nodeResults.values().stream().filter(s -> "FAIL".equals(s)).count();
                long pendCnt = nodeResults.values().stream().filter(s -> "PENDING".equals(s)).count();

                if (finalStatus == ExecutionStatus.PASS) {
                    saveLogEntry(rule, execLogId, LogLevel.success,
                            "轮询完成：" + passCnt + " 通过 / 0 不满足 / " + pendCnt + " 未执行");
                } else if (finalStatus == ExecutionStatus.FAIL) {
                    saveLogEntry(rule, execLogId, LogLevel.error,
                            "轮询完成：" + passCnt + " 通过 / " + failCnt + " 不满足 / " + pendCnt + " 未执行");
                }
            }

            if (errorCode == null) {
                // Count actual status
                long failCnt = nodeResults.values().stream().filter(s -> "FAIL".equals(s)).count();
                finalStatus = failCnt == 0 ? ExecutionStatus.PASS : ExecutionStatus.FAIL;
            } else {
                finalStatus = ExecutionStatus.ERROR;
            }

        } catch (Exception e) {
            log.error("规则执行异常: {} ({})", rule.getName(), ruleId, e);
            finalStatus = ExecutionStatus.ERROR;
            errorCode = "EXECUTION_ERROR";
            saveLogEntry(rule, execLogId, LogLevel.error, "规则执行异常: " + e.getMessage());
        }

        LocalDateTime endTime = LocalDateTime.now();

        String nodeResultsJson = serializeMap(nodeResults);
        String branchResultsJson = serializeMap(branchResults);

        ExecutionLog execLog = logBuilder
                .endTime(endTime)
                .status(finalStatus)
                .errorCode(errorCode)
                .nodeResults(nodeResultsJson)
                .branchResults(branchResultsJson)
                .build();

        executionLogRepository.save(execLog);
        log.info("规则执行完成: {} ({}) - {} ({}ms)", rule.getName(), ruleId, finalStatus,
                java.time.Duration.between(startTime, endTime).toMillis());

        return execLog;
    }

    // ==================== 节点执行 ====================

    /**
     * 执行单个节点
     */
    private ExecutionResult executeSingleNode(
            JsonNode node, JsonNode nodes, JsonNode flow,
            Map<String, String> nodeResults, Map<String, String> branchResults,
            Rule rule) {

        String nodeType = node.path("type").asText("rule");

        return switch (nodeType) {
            case "rule" -> executeRuleNode(node, rule);
            case "and_branch" -> executeAndBranch(node, nodes, nodeResults, branchResults, rule);
            case "or_branch" -> executeOrBranch(node, nodes, nodeResults, branchResults, rule);
            case "timer" -> executeTimerNode(node);
            case "delay" -> executeDelayNode(node);
            case "modify" -> executeModifyNode(node, rule);
            case "route" -> executeRouteNode(node, nodes, rule);
            default -> {
                log.warn("未知节点类型: {}", nodeType);
                yield new ExecutionResult(ExecutionStatus.FAIL, null);
            }
        };
    }

    // ===== Rule Node (条件判断) =====
    private ExecutionResult executeRuleNode(JsonNode node, Rule rule) {
        try {
            JsonNode config = node.path("config");
            String condMode = config.path("condMode").asText("param");

            boolean result;
            if ("script".equals(condMode)) {
                result = executeScriptCondition(config, rule);
            } else {
                result = executeParamCondition(config, rule);
            }

            log.debug("规则判断节点「{}」: {} -> {}", node.path("name").asText(),
                    config.path("param").asText(), result);
            return new ExecutionResult(result ? ExecutionStatus.PASS : ExecutionStatus.FAIL, null);

        } catch (Exception e) {
            log.error("规则判断节点执行异常: {}", e.getMessage());
            return new ExecutionResult(ExecutionStatus.ERROR, null);
        }
    }

    /**
     * 自选参数模式条件判断
     */
    private boolean executeParamCondition(JsonNode config, Rule rule) {
        String param = config.path("param").asText("");
        String op = config.path("op").asText("");
        String threshold = config.path("threshold").asText("");
        String min = config.path("min").asText("");
        String max = config.path("max").asText("");

        // 从平台读取点位值
        String pointValue = platformService.readPointValue(param);
        if (pointValue == null) {
            log.warn("读取点位值失败: {}", param);
            return false;
        }

        return evaluateCondition(pointValue, op, threshold, min, max);
    }

    /**
     * 7种运算符计算
     */
    private boolean evaluateCondition(String actualValue, String op, String threshold, String min, String max) {
        try {
            double actual = Double.parseDouble(actualValue);

            return switch (op) {
                case ">" -> actual > Double.parseDouble(threshold);
                case "<" -> actual < Double.parseDouble(threshold);
                case "=" -> Math.abs(actual - Double.parseDouble(threshold)) < 1e-9;
                case "≠" -> Math.abs(actual - Double.parseDouble(threshold)) >= 1e-9;
                case "≥" -> actual >= Double.parseDouble(threshold);
                case "≤" -> actual <= Double.parseDouble(threshold);
                case "范围内" -> {
                    double minVal = Double.parseDouble(min);
                    double maxVal = Double.parseDouble(max);
                    yield actual >= minVal && actual <= maxVal;
                }
                default -> {
                    log.warn("未知运算符: {}", op);
                    yield false;
                }
            };
        } catch (NumberFormatException e) {
            // String comparison fallback
            return switch (op) {
                case "=" -> actualValue.equals(threshold);
                case "≠" -> !actualValue.equals(threshold);
                default -> false;
            };
        }
    }

    /**
     * 脚本执行模式条件判断（Python脚本）
     */
    private boolean executeScriptCondition(JsonNode config, Rule rule) {
        String script = config.path("script").asText("");
        if (script.trim().isEmpty()) return false;

        try {
            // Extract all parameter references
            List<String> params = new ArrayList<>();
            Matcher m = PARAM_REF_PATTERN.matcher(script);
            while (m.find()) {
                params.add(m.group(1));
            }

            // Read point values
            Map<String, String> pointValues = new HashMap<>();
            for (String param : params) {
                String value = platformService.readPointValue(param);
                if (value != null) {
                    pointValues.put(param, value);
                }
            }

            // 使用沙箱执行表达式求值
            // 替换<%参数名%>为实际值
            String expression = script;
            for (Map.Entry<String, String> entry : pointValues.entrySet()) {
                expression = expression.replace("<%" + entry.getKey() + "%>", entry.getValue());
            }

            // 对于"return 1 if ... else 0"格式，提取条件部分
            boolean result = scriptSandbox.evaluate(expression, pointValues);
            log.debug("脚本条件求值: {}", result);
            return result;

        } catch (Exception e) {
            log.error("脚本条件执行异常: {}", e.getMessage());
            return false;
        }
    }

    // ===== AND Branch =====
    private ExecutionResult executeAndBranch(JsonNode node, JsonNode nodes,
                                              Map<String, String> nodeResults,
                                              Map<String, String> branchResults,
                                              Rule rule) {
        JsonNode branches = node.path("branches");
        if (!branches.isArray() || branches.isEmpty()) {
            return new ExecutionResult(ExecutionStatus.FAIL, null);
        }

        boolean allPass = true;
        for (JsonNode branch : branches) {
            String branchId = branch.path("id").asText();
            boolean branchPass = evaluateBranchCondition(branch, nodes, nodeResults, rule);
            branchResults.put(branchId, branchPass ? "PASS" : "FAIL");

            if (!branchPass) {
                allPass = false;
                log.debug("AND分支 {} 不满足", branch.path("name").asText());
            }
        }

        return new ExecutionResult(allPass ? ExecutionStatus.PASS : ExecutionStatus.FAIL, null);
    }

    // ===== OR Branch =====
    private ExecutionResult executeOrBranch(JsonNode node, JsonNode nodes,
                                             Map<String, String> nodeResults,
                                             Map<String, String> branchResults,
                                             Rule rule) {
        JsonNode branches = node.path("branches");
        if (!branches.isArray() || branches.isEmpty()) {
            return new ExecutionResult(ExecutionStatus.FAIL, null);
        }

        boolean anyPass = false;
        for (JsonNode branch : branches) {
            String branchId = branch.path("id").asText();
            boolean branchPass = evaluateBranchCondition(branch, nodes, nodeResults, rule);
            branchResults.put(branchId, branchPass ? "PASS" : "FAIL");

            if (branchPass) {
                anyPass = true;
                log.debug("OR分支 {} 满足，跳过其余分支", branch.path("name").asText());
                break;
            }
        }

        return new ExecutionResult(anyPass ? ExecutionStatus.PASS : ExecutionStatus.FAIL, null);
    }

    /**
     * 评估分支条件 + 嵌套节点
     */
    private boolean evaluateBranchCondition(JsonNode branch, JsonNode nodes,
                                            Map<String, String> nodeResults, Rule rule) {
        // 评估分支条件
        JsonNode config = branch.path("config");
        boolean condPass;

        String condMode = config.path("condMode").asText("param");
        if ("script".equals(condMode)) {
            condPass = executeScriptCondition(config, rule);
        } else {
            String param = config.path("param").asText("");
            String op = config.path("op").asText("");
            String threshold = config.path("threshold").asText("");
            String min = config.path("min").asText("");
            String max = config.path("max").asText("");

            String pointValue = platformService.readPointValue(param);
            condPass = pointValue != null && evaluateCondition(pointValue, op, threshold, min, max);
        }

        if (!condPass) return false;

        // 执行嵌套节点
        JsonNode nested = branch.path("nested");
        if (nested.isArray()) {
            for (JsonNode nid : nested) {
                String nestedId = nid.asText();
                JsonNode nestedNode = nodes.get(nestedId);
                if (nestedNode == null) continue;

                ExecutionResult nestedResult = executeSingleNode(
                        nestedNode, nodes, null, nodeResults, new HashMap<>(), rule);
                nodeResults.put(nestedId, nestedResult.status.name());

                if (nestedResult.status != ExecutionStatus.PASS) {
                    return false;
                }
            }
        }

        return true;
    }

    // ===== Timer Node (定时器) =====
    private ExecutionResult executeTimerNode(JsonNode node) {
        try {
            JsonNode config = node.path("config");
            String kind = config.path("kind").asText("");
            if (kind.isEmpty()) {
                return new ExecutionResult(ExecutionStatus.FAIL, null);
            }

            JsonNode groups = config.path("groups");
            if (!groups.isArray() || groups.isEmpty()) {
                return new ExecutionResult(ExecutionStatus.FAIL, null);
            }

            LocalDateTime now = LocalDateTime.now();
            LocalDate today = now.toLocalDate();
            LocalTime currentTime = now.toLocalTime();

            // 任意一个时段组匹配即PASS（OR关系）
            for (JsonNode group : groups) {
                boolean match = switch (kind) {
                    case "specific" -> checkSpecific(group, now);
                    case "daily" -> checkDaily(group, currentTime);
                    case "weekly" -> checkWeekly(group, currentTime, today);
                    case "monthly" -> checkMonthly(group, currentTime, today);
                    case "yearly" -> checkYearly(group, currentTime, today);
                    default -> false;
                };

                if (match) {
                    log.debug("定时器节点「{}」命中时段", node.path("name").asText());
                    return new ExecutionResult(ExecutionStatus.PASS, null);
                }
            }

            log.debug("定时器节点「{}」未命中任何时段", node.path("name").asText());
            return new ExecutionResult(ExecutionStatus.FAIL, null);

        } catch (Exception e) {
            log.error("定时器节点执行异常: {}", e.getMessage());
            return new ExecutionResult(ExecutionStatus.ERROR, null);
        }
    }

    private boolean checkSpecific(JsonNode group, LocalDateTime now) {
        JsonNode dr = group.path("dateRange");
        String startStr = dr.path("start").asText("");
        String endStr = dr.path("end").asText("");

        try {
            LocalDateTime start = LocalDateTime.parse(startStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            LocalDateTime end = LocalDateTime.parse(endStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            return !now.isBefore(start) && !now.isAfter(end);
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private boolean checkDaily(JsonNode group, LocalTime now) {
        JsonNode tr = group.path("timeRange");
        String startStr = tr.path("start").asText("00:00:00");
        String endStr = tr.path("end").asText("23:59:59");

        LocalTime start = parseTime(startStr);
        LocalTime end = parseTime(endStr);
        return !now.isBefore(start) && !now.isAfter(end);
    }

    private boolean checkWeekly(JsonNode group, LocalTime now, LocalDate today) {
        int dayOfWeek = today.getDayOfWeek().getValue(); // 1=Mon, 7=Sun
        JsonNode daysNode = group.path("days");
        if (daysNode.isArray()) {
            boolean dayMatch = false;
            for (JsonNode d : daysNode) {
                if (d.asInt() == dayOfWeek) {
                    dayMatch = true;
                    break;
                }
            }
            if (!dayMatch) return false;
        }

        return checkDaily(group, now);
    }

    private boolean checkMonthly(JsonNode group, LocalTime now, LocalDate today) {
        int dayOfMonth = today.getDayOfMonth();
        JsonNode dr = group.path("dayRange");
        try {
            int startDay = Integer.parseInt(dr.path("start").asText("1"));
            int endDay = Integer.parseInt(dr.path("end").asText("31"));
            if (dayOfMonth < startDay || dayOfMonth > endDay) return false;
        } catch (NumberFormatException e) {
            return false;
        }

        return checkDaily(group, now);
    }

    private boolean checkYearly(JsonNode group, LocalTime now, LocalDate today) {
        JsonNode dr = group.path("dateRange");
        try {
            int startMonth = Integer.parseInt(dr.path("startMonth").asText("1"));
            int startDay = Integer.parseInt(dr.path("startDay").asText("1"));
            int endMonth = Integer.parseInt(dr.path("endMonth").asText("12"));
            int endDay = Integer.parseInt(dr.path("endDay").asText("31"));

            LocalDate startDate = LocalDate.of(today.getYear(), startMonth, Math.min(startDay, 28));
            LocalDate endDate = LocalDate.of(today.getYear(), endMonth, Math.min(endDay, 28));

            if (today.isBefore(startDate) || today.isAfter(endDate)) return false;
        } catch (NumberFormatException e) {
            return false;
        }

        return checkDaily(group, now);
    }

    private LocalTime parseTime(String timeStr) {
        try {
            if (timeStr.length() <= 5) {
                // Only HH:mm
                return LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("HH:mm"));
            }
            return LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("HH:mm:ss"));
        } catch (DateTimeParseException e) {
            return LocalTime.parse("00:00");
        }
    }

    // ===== Delay Node (延时器) =====
    private ExecutionResult executeDelayNode(JsonNode node) {
        try {
            JsonNode config = node.path("config");
            int value = Integer.parseInt(config.path("value").asText("0"));
            String unit = config.path("unit").asText("秒");

            if (value <= 0) {
                return new ExecutionResult(ExecutionStatus.PASS, null);
            }

            int totalSeconds = "分钟".equals(unit) ? value * 60 : value;
            if (totalSeconds > 900) {
                log.warn("延时超过900秒限制({}s)，截断为900s", totalSeconds);
                totalSeconds = 900;
            }

            if (totalSeconds > 0) {
                log.debug("延时节点: {} {}", value, unit);
                Thread.sleep(totalSeconds * 1000L);
            }

            return new ExecutionResult(ExecutionStatus.PASS, null);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new ExecutionResult(ExecutionStatus.ERROR, null);
        } catch (Exception e) {
            log.error("延时节点执行异常: {}", e.getMessage());
            return new ExecutionResult(ExecutionStatus.PASS, null); // delay failure is not critical
        }
    }

    // ===== Modify Node (修改点值) =====
    private ExecutionResult executeModifyNode(JsonNode node, Rule rule) {
        try {
            JsonNode config = node.path("config");
            String param = config.path("param").asText("");
            String valueStr = config.path("value").asText("");

            if (param.isEmpty() || valueStr.isEmpty()) {
                return new ExecutionResult(ExecutionStatus.FAIL, null);
            }

            // 计算目标值
            String targetValue;
            if (valueStr.startsWith("=")) {
                // 表达式模式
                String expr = valueStr.substring(1);
                // 替换参数引用
                Matcher m = PARAM_REF_PATTERN.matcher(expr);
                while (m.find()) {
                    String refParam = m.group(1);
                    String refValue = platformService.readPointValue(refParam);
                    if (refValue != null) {
                        expr = expr.replace("<%" + refParam + "%>", refValue);
                    }
                }

                // 简单四则运算求值（安全沙箱）
                Map<String, String> vars = new HashMap<>();
                boolean success = scriptSandbox.evaluate(expr, vars);
                targetValue = String.valueOf(success);
            } else {
                targetValue = valueStr;
            }

            // 处理目标值（转换为double以便应用上下限）
            try {
                double computed = Double.parseDouble(targetValue);

                // 应用上下限
                String limitMin = config.path("limitMin").asText("");
                String limitMax = config.path("limitMax").asText("");

                if (!limitMin.isEmpty()) {
                    computed = Math.max(computed, Double.parseDouble(limitMin));
                }
                if (!limitMax.isEmpty()) {
                    computed = Math.min(computed, Double.parseDouble(limitMax));
                }

                targetValue = String.valueOf(computed);
            } catch (NumberFormatException ignored) {
                // Non-numeric value, keep as-is
            }

            // 下发指令到 service-model
            // deviceMark 和 paramMark 目前都用 param 参数名（前端选择参数时即点位编码）
            // 正式对接时可通过配置表将参数名映射为 deviceMark
            boolean success = platformService.writePointValue(param, param, targetValue);

            if (success) {
                log.debug("修改点值节点「{}」: {} = {}", node.path("name").asText(), param, targetValue);
            } else {
                log.warn("修改点值节点「{}」下发失败: {} = {}", node.path("name").asText(), param, targetValue);
            }

            return new ExecutionResult(success ? ExecutionStatus.PASS : ExecutionStatus.FAIL, null);

        } catch (Exception e) {
            log.error("修改点值节点执行异常: {}", e.getMessage());
            return new ExecutionResult(ExecutionStatus.ERROR, null);
        }
    }

    // ===== Route Node (动态路由) =====
    private ExecutionResult executeRouteNode(JsonNode node, JsonNode nodes, Rule rule) {
        try {
            JsonNode config = node.path("config");
            String condMode = config.path("condMode").asText("param");
            String targetId = config.path("targetId").asText("");

            if (targetId.isEmpty()) {
                return new ExecutionResult(ExecutionStatus.FAIL, null);
            }

            // 检查目标节点合法性
            JsonNode targetNode = nodes.get(targetId);
            if (targetNode == null || "route".equals(targetNode.path("type").asText())) {
                log.warn("路由节点「{}」目标不合法: {}", node.path("name").asText(), targetId);
                return new ExecutionResult(ExecutionStatus.FAIL, null);
            }

            boolean conditionMet;
            if ("script".equals(condMode)) {
                conditionMet = executeScriptCondition(config, rule);
            } else {
                String param = config.path("param").asText("");
                String op = config.path("op").asText("");
                String threshold = config.path("threshold").asText("");
                String min = config.path("min").asText("");
                String max = config.path("max").asText("");

                String pointValue = platformService.readPointValue(param);
                conditionMet = pointValue != null && evaluateCondition(pointValue, op, threshold, min, max);
            }

            if (conditionMet) {
                log.debug("路由节点「{}」条件满足，跳转到: {}", node.path("name").asText(), targetId);
                return new ExecutionResult(ExecutionStatus.PASS, targetId);
            } else {
                log.debug("路由节点「{}」条件不满足，终止", node.path("name").asText());
                return new ExecutionResult(ExecutionStatus.FAIL, null);
            }

        } catch (Exception e) {
            log.error("路由节点执行异常: {}", e.getMessage());
            return new ExecutionResult(ExecutionStatus.ERROR, null);
        }
    }

    // ==================== 辅助方法 ====================

    private String getNodeTypeLabel(String type) {
        return switch (type) {
            case "rule" -> "规则判断";
            case "and_branch" -> "AND分支";
            case "or_branch" -> "OR分支";
            case "timer" -> "定时器";
            case "delay" -> "延时器";
            case "modify" -> "修改点值";
            case "route" -> "动态路由";
            default -> type;
        };
    }

    private String serializeMap(Map<String, String> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }

    private void saveLogEntry(Rule rule, String executionLogId, LogLevel level, String msg) {
        String groupName = ruleGroupRepository.findById(rule.getGroupId())
                .map(RuleGroup::getName)
                .orElse("未知分组");

        LogEntry entry = LogEntry.builder()
                .id(UUID.randomUUID().toString())
                .ts(LocalDateTime.now())
                .ruleId(rule.getId())
                .ruleName(rule.getName())
                .groupName(groupName)
                .level(level)
                .msg(msg)
                .executionLogId(executionLogId)
                .build();
        logEntryRepository.save(entry);
    }

    // ==================== 执行结果 ====================

    public static class ExecutionResult {
        final ExecutionStatus status;
        final String jumpTarget; // Only for route nodes

        public ExecutionResult(ExecutionStatus status, String jumpTarget) {
            this.status = status;
            this.jumpTarget = jumpTarget;
        }
    }
}
