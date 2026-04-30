package com.cmsrule.controller;

import com.cmsrule.dto.ApiResponse;
import com.cmsrule.dto.LogDTO;
import com.cmsrule.dto.RuleDTO;
import com.cmsrule.entity.Rule;
import com.cmsrule.repository.RuleRepository;
import com.cmsrule.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rule-engine")
@RequiredArgsConstructor
public class RuleController {

    private final RuleService ruleService;
    private final LogService logService;
    private final ImportExportService importExportService;
    private final RuleEngineService ruleEngineService;
    private final ParameterService parameterService;
    private final RuleExecutor ruleExecutor;
    private final RuleRepository ruleRepository;

    // API5: 获取规则列表（按分组过滤）
    @GetMapping("/rules")
    public ApiResponse<List<RuleDTO.Rule>> getRules(@RequestParam(required = false) String groupId) {
        List<RuleDTO.Rule> rules = ruleService.findAll(groupId);
        return ApiResponse.success(rules);
    }

    // API5b: 获取单个规则
    @GetMapping("/rules/{ruleId}")
    public ApiResponse<RuleDTO.Rule> getRule(@PathVariable String ruleId) {
        return ApiResponse.success(ruleService.findById(ruleId));
    }

    // API6: 新建规则
    @PostMapping("/rules")
    public ApiResponse<RuleDTO.Rule> createRule(@RequestBody RuleDTO.CreateRequest req) {
        Rule rule = ruleService.create(req);
        return ApiResponse.success(ruleService.toRule(rule));
    }

    // API7: 更新规则基础信息
    @PutMapping("/rules/{ruleId}")
    public ApiResponse<RuleDTO.Rule> updateRule(@PathVariable String ruleId, @RequestBody RuleDTO.UpdateRequest req) {
        Rule rule = ruleService.update(ruleId, req);
        return ApiResponse.success(ruleService.toRule(rule));
    }

    // API8: 删除单条规则
    @DeleteMapping("/rules/{ruleId}")
    public ApiResponse<Void> deleteRule(@PathVariable String ruleId) {
        ruleService.delete(ruleId);
        return ApiResponse.success();
    }

    // API9: 启用/停用规则
    @PatchMapping("/rules/{ruleId}/status")
    public ApiResponse<RuleDTO.Rule> updateStatus(@PathVariable String ruleId, @RequestBody RuleDTO.StatusRequest req) {
        Rule rule = ruleService.updateStatus(ruleId, req.getStatus());
        return ApiResponse.success(ruleService.toRule(rule));
    }

    // API10: 批量删除规则
    @DeleteMapping("/rules/batch")
    public ApiResponse<Void> batchDelete(@RequestBody RuleDTO.BatchDeleteRequest req) {
        ruleService.batchDelete(req.getRuleIds());
        return ApiResponse.success();
    }

    // API11: 保存完整流程
    @PutMapping("/rules/{ruleId}/flow")
    public ApiResponse<RuleDTO.Rule> saveFlow(@PathVariable String ruleId, @RequestBody Map<String, String> body) {
        String flow = body.get("flow");
        Rule rule = ruleService.updateFlow(ruleId, flow, false);
        return ApiResponse.success(ruleService.toRule(rule));
    }

    // API12: 暂存不完整流程
    @PutMapping("/rules/{ruleId}/flow/draft")
    public ApiResponse<RuleDTO.Rule> saveFlowDraft(@PathVariable String ruleId, @RequestBody Map<String, String> body) {
        String flow = body.get("flow");
        Rule rule = ruleService.updateFlow(ruleId, flow, true);
        return ApiResponse.success(ruleService.toRule(rule));
    }

    // API13: 获取规则最新执行记录
    @GetMapping("/rules/{ruleId}/execution/latest")
    public ApiResponse<LogDTO.ExecutionLog> getLatestExecution(@PathVariable String ruleId) {
        LogDTO.ExecutionLog execLog = logService.getLatestExecution(ruleId);
        return ApiResponse.success(execLog);
    }

    // API14: 导入规则
    @PostMapping("/rules/import")
    public ApiResponse<Integer> importRules(
            @RequestParam String targetGroupId,
            @RequestBody String jsonData
    ) throws Exception {
        int count = importExportService.importRules(jsonData, targetGroupId);
        return ApiResponse.success(count);
    }

    // API15: 导出规则
    @GetMapping("/rules/export")
    public ApiResponse<Object> exportRules(@RequestParam(required = false) List<String> ruleIds) throws Exception {
        String json = importExportService.exportRules(ruleIds);
        Object parsed = new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, Object.class);
        return ApiResponse.success(parsed);
    }

    // 手动执行规则
    @PostMapping("/rules/{ruleId}/execute")
    public ApiResponse<Object> executeRule(@PathVariable String ruleId) {
        Rule rule = ruleRepository.findById(ruleId).orElse(null);
        if (rule == null) {
            return ApiResponse.error(4004, "规则不存在");
        }
        var execLog = ruleExecutor.execute(rule);
        return ApiResponse.success(Map.of(
                "executionId", execLog.getId(),
                "status", execLog.getStatus().name(),
                "nodeResults", execLog.getNodeResults()
        ));
    }

    // ========== 参数接口 ==========

    // 获取参数列表
    @GetMapping("/parameters")
    public ApiResponse<List<Map<String, Object>>> getParameters() {
        return ApiResponse.success(parameterService.getParameterList());
    }

    // 获取参数实时值（用于预览）
    @GetMapping("/parameters/last-values")
    public ApiResponse<List<Map<String, Object>>> getParameterLastValues() {
        return ApiResponse.success(parameterService.getParameterLastValues());
    }
}
