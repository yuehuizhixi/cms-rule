package com.cmsrule.controller;

import com.cmsrule.dto.ApiResponse;
import com.cmsrule.ems.service.EmsParamService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * EMS 数据源控制器
 *
 * 提供模型/设备/参数信息的查询接口，
 * 供前端选择参数时使用。
 * 所有数据来自 EMS 库（通过 HTTP 代理，只读）。
 */
@RestController
@RequestMapping("/api/rule-engine/ems")
@RequiredArgsConstructor
@Slf4j
public class EmsParamController {

    private final EmsParamService emsParamService;

    /**
     * GET /models — 获取模型列表
     */
    @GetMapping("/models")
    public ApiResponse<?> listModels() {
        try {
            List<Map<String, Object>> models = emsParamService.listModels();
            return ApiResponse.success(models);
        } catch (Exception e) {
            log.error("查询EMS模型列表失败", e);
            return ApiResponse.error(500, "查询模型列表失败: " + e.getMessage());
        }
    }

    /**
     * GET /models/{modelMark}/devices — 获取设备列表
     */
    @GetMapping("/models/{modelMark}/devices")
    public ApiResponse<?> listDevices(@PathVariable String modelMark) {
        try {
            List<Map<String, Object>> devices = emsParamService.listDevices(modelMark);
            return ApiResponse.success(devices);
        } catch (Exception e) {
            log.error("查询EMS设备列表失败: modelMark={}", modelMark, e);
            return ApiResponse.error(500, "查询设备列表失败: " + e.getMessage());
        }
    }

    /**
     * GET /models/{modelMark}/params — 获取参数列表
     *
     * 返回该模型下所有参数，包含 deliverFlag、valueSource 等信息。
     * 前端用此接口选择参数做配置。
     */
    @GetMapping("/models/{modelMark}/params")
    public ApiResponse<?> listParams(@PathVariable String modelMark) {
        try {
            List<Map<String, Object>> params = emsParamService.listParams(modelMark);
            return ApiResponse.success(params);
        } catch (Exception e) {
            log.error("查询EMS参数列表失败: modelMark={}", modelMark, e);
            return ApiResponse.error(500, "查询参数列表失败: " + e.getMessage());
        }
    }

    /**
     * GET /models/{modelMark}/params/deliverable — 获取可下发参数列表
     *
     * 仅返回 deliverFlag = "2" 的参数
     */
    @GetMapping("/models/{modelMark}/params/deliverable")
    public ApiResponse<?> listDeliverableParams(@PathVariable String modelMark) {
        try {
            List<Map<String, Object>> params = emsParamService.listDeliverableParams(modelMark);
            return ApiResponse.success(params);
        } catch (Exception e) {
            log.error("查询EMS可下发参数列表失败: modelMark={}", modelMark, e);
            return ApiResponse.error(500, "查询可下发参数列表失败: " + e.getMessage());
        }
    }

    /**
     * POST /params/values — 批量查询参数实时值
     *
     * 请求体：
     * [
     *   { "modelMark": "eleMeter_virtual", "paramMark": "energy_used" },
     *   { "modelMark": "eleMeter_virtual", "paramMark": "voltage" }
     * ]
     *
     * 响应返回每个参数的 deviceMark 和参数基本信息
     */
    @PostMapping("/params/values")
    public ApiResponse<?> batchQueryParamValues(
            @RequestBody List<Map<String, String>> requests) {
        try {
            if (requests == null || requests.isEmpty()) {
                return ApiResponse.success(Collections.emptyList());
            }
            List<Map<String, Object>> result = new ArrayList<>();
            for (Map<String, String> req : requests) {
                String modelMark = req.get("modelMark");
                String paramMark = req.get("paramMark");

                Map<String, Object> paramInfo = emsParamService.getParamInfo(modelMark, paramMark);
                String deviceMark = emsParamService.getDeviceMarkForParam(modelMark, paramMark);

                Map<String, Object> resp = new HashMap<>();
                resp.put("modelMark", modelMark);
                resp.put("paramMark", paramMark);
                resp.put("paramName", paramInfo != null ? paramInfo.get("paramName") : null);
                resp.put("unit", paramInfo != null ? paramInfo.get("unit") : null);
                resp.put("deviceMark", deviceMark);
                result.add(resp);
            }
            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("批量查询参数值失败", e);
            return ApiResponse.error(500, "查询参数值失败: " + e.getMessage());
        }
    }
}
