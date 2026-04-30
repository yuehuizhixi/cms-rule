package com.cmsrule.client;

import com.cmsrule.feign.IotPlatformClient;
import com.cmsrule.feign.CmdClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 平台服务适配层
 * 封装IoT点位读取和Cmd指令下发
 * 测试环境使用Mock实现，生产环境调用真实Feign接口
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlatformService {

    private final IotPlatformClient iotPlatformClient;
    private final CmdClient cmdClient;
    private final ObjectMapper objectMapper;

    // 测试模式标志（可通过配置切换）
    private boolean mockMode = true;

    /**
     * 读取点位当前值
     * @param pointId 点位ID
     * @return 点位值（字符串格式），读取失败返回null
     */
    public String readPointValue(String pointId) {
        if (mockMode) {
            return mockReadPointValue(pointId);
        }
        try {
            String result = iotPlatformClient.getPointValue(pointId);
            JsonNode node = objectMapper.readTree(result);
            return node.path("value").asText();
        } catch (Exception e) {
            log.warn("读取点位值失败: pointId={}, error={}", pointId, e.getMessage());
            return null;
        }
    }

    /**
     * 读取多个点位值
     * @param pointIds 点位ID列表
     * @return 点位ID -> 值 映射
     */
    public java.util.Map<String, String> readPointValues(java.util.List<String> pointIds) {
        if (mockMode) {
            java.util.Map<String, String> mockResult = new java.util.HashMap<>();
            for (String id : pointIds) {
                mockResult.put(id, mockReadPointValue(id));
            }
            return mockResult;
        }
        try {
            String json = iotPlatformClient.getPointValuesBatch(pointIds);
            JsonNode node = objectMapper.readTree(json);
            java.util.Map<String, String> result = new java.util.HashMap<>();
            node.fields().forEachRemaining(field -> {
                result.put(field.getKey(), field.getValue().asText());
            });
            return result;
        } catch (Exception e) {
            log.warn("批量读取点位值失败: {}", e.getMessage());
            return new java.util.HashMap<>();
        }
    }

    /**
     * 下发控制指令
     * @param deviceId 设备ID
     * @param pointId 点位ID
     * @param value 目标值
     * @return 是否下发成功
     */
    public boolean writePointValue(String deviceId, String pointId, Object value) {
        return writePointValue(deviceId, pointId, value, "set", 30);
    }

    /**
     * 下发控制指令（完整参数）
     */
    public boolean writePointValue(String deviceId, String pointId, Object value, String type, Integer timeout) {
        if (mockMode) {
            log.info("[MOCK] 下发指令: device={}, point={}, value={}", deviceId, pointId, value);
            return true;
        }
        try {
            CmdClient.CmdRequest request = new CmdClient.CmdRequest(deviceId, pointId, value, type, timeout);
            String result = cmdClient.sendCmd(request);
            JsonNode node = objectMapper.readTree(result);
            return node.path("success").asBoolean(true);
        } catch (Exception e) {
            log.warn("下发指令失败: deviceId={}, pointId={}, error={}", deviceId, pointId, e.getMessage());
            return false;
        }
    }

    /**
     * 批量下发指令
     */
    public java.util.List<String> writePointValuesBatch(java.util.List<CmdClient.CmdRequest> requests) {
        if (mockMode) {
            log.info("[MOCK] 批量下发指令: {}条", requests.size());
            return requests.stream().map(r -> "mock-cmd-" + r.deviceId() + "-" + r.pointId()).toList();
        }
        try {
            String result = cmdClient.sendCmdBatch(requests);
            JsonNode node = objectMapper.readTree(result);
            java.util.List<String> cmdIds = new java.util.ArrayList<>();
            node.forEach(n -> cmdIds.add(n.path("cmdId").asText()));
            return cmdIds;
        } catch (Exception e) {
            log.warn("批量下发指令失败: {}", e.getMessage());
            return java.util.Collections.emptyList();
        }
    }

    /**
     * 查询指令状态
     */
    public String getCmdStatus(String cmdId) {
        if (mockMode) {
            return "{\"cmdId\":\"" + cmdId + "\",\"status\":\"SUCCESS\"}";
        }
        try {
            return cmdClient.getCmdStatus(cmdId);
        } catch (Exception e) {
            log.warn("查询指令状态失败: cmdId={}, error={}", cmdId, e.getMessage());
            return "{\"status\":\"UNKNOWN\"}";
        }
    }

    // ==================== Mock实现 ====================

    /**
     * Mock读取点位值（用于测试）
     * 模拟返回：温度类点位返回18~28随机值，开关类返回true/false
     */
    private String mockReadPointValue(String pointId) {
        // 简单Mock：随机返回有意义的值
        // 实际测试时可扩展为从配置文件或测试数据读取
        if (pointId == null || pointId.isBlank()) {
            return "0";
        }
        // 根据点位ID哈希生成确定性伪随机
        int hash = pointId.hashCode();
        if (hash % 3 == 0) {
            return String.valueOf(18 + (Math.abs(hash) % 15)); // 温度范围 18-32
        } else if (hash % 3 == 1) {
            return (hash % 2 == 0) ? "true" : "false"; // 开关状态
        } else {
            return String.valueOf(Math.abs(hash) % 100); // 通用数值
        }
    }

    /**
     * 设置Mock模式（测试用）
     */
    public void setMockMode(boolean mockMode) {
        this.mockMode = mockMode;
        log.info("PlatformService Mock模式: {}", mockMode);
    }

    public boolean isMockMode() {
        return mockMode;
    }
}
