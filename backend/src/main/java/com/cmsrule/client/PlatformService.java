package com.cmsrule.client;

import com.cmsrule.dto.CmdRequestDTO;
import com.cmsrule.dto.CmdResultDTO;
import com.cmsrule.feign.CmdClient;
import com.cmsrule.feign.IotPlatformClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * 平台服务适配层
 * 封装IoT点位读取和Cmd指令下发
 *
 * 下发逻辑：
 * 1. 构建 CommandRequest（deviceMark+paramMark+value）
 * 2. 调用 service-model 的 POST /cmd 接口
 * 3. 返回每条指令的下发结果（success/msg）
 *
 * 测试环境使用Mock实现，生产环境调用真实Feign接口
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PlatformService {

    private final IotPlatformClient iotPlatformClient;
    private final CmdClient cmdClient;
    private final ObjectMapper objectMapper;

    /** 测试模式标志（可通过配置切换） */
    private boolean mockMode = true;

    // ==================== 点位读取 ====================

    /**
     * 读取点位当前值
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
     * 批量读取点位值
     */
    public java.util.Map<String, String> readPointValues(List<String> pointIds) {
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
            node.fields().forEachRemaining(field ->
                result.put(field.getKey(), field.getValue().asText())
            );
            return result;
        } catch (Exception e) {
            log.warn("批量读取点位值失败: {}", e.getMessage());
            return new java.util.HashMap<>();
        }
    }

    // ==================== 指令下发 ====================

    /**
     * 下发控制指令（简化版）
     * 
     * 调用 service-model 的 POST /cmd 接口
     * POST /api/hvac_iot/cmd
     * Request: List<CommandRequest>
     * Response: List<CommandResultVo>
     *
     * @param deviceMark 设备标识（物模型实例编码）
     * @param paramMark 点位标识（物模型点位编码）
     * @param value     下发值
     * @return 是否全部下发成功
     */
    public boolean writePointValue(String deviceMark, String paramMark, String value) {
        CmdRequestDTO req = new CmdRequestDTO();
        req.setDeviceMark(deviceMark);
        req.setParamMark(paramMark);
        req.setValue(value);
        req.setTimeout(30L);     // 规则引擎场景超时适当放宽
        req.setCreateBy("cms-rule");
        return writePointValues(List.of(req));
    }

    /**
     * 批量下发指令
     *
     * @param requests 指令请求列表
     * @return 是否全部下发成功
     */
    public boolean writePointValues(List<CmdRequestDTO> requests) {
        if (requests == null || requests.isEmpty()) {
            return true;
        }

        if (mockMode) {
            for (CmdRequestDTO r : requests) {
                log.info("[MOCK] 下发指令: device={}, param={}, value={}",
                        r.getDeviceMark(), r.getParamMark(), r.getValue());
            }
            return true;
        }

        try {
            List<CmdResultDTO> results = cmdClient.sendCmd(requests);
            if (results == null) {
                log.warn("下发指令返回 null，共{}条", requests.size());
                return false;
            }

            boolean allSuccess = true;
            for (CmdResultDTO r : results) {
                if (!r.isSuccess()) {
                    allSuccess = false;
                    log.warn("下发指令失败: device={}, param={}, msg={}",
                            r.getDeviceMark(), r.getParamMark(), r.getMsg());
                } else {
                    log.debug("下发指令成功: device={}, param={}, cmdId={}",
                            r.getDeviceMark(), r.getParamMark(), r.getId());
                }
            }
            return allSuccess;

        } catch (Exception e) {
            log.error("下发指令异常: {}条, error={}", requests.size(), e.getMessage());
            return false;
        }
    }

    // ==================== Mock ====================

    /**
     * Mock读取点位值（用于测试）
     */
    private String mockReadPointValue(String pointId) {
        if (pointId == null || pointId.isBlank()) return "0";
        int hash = pointId.hashCode();
        if (hash % 3 == 0) {
            return String.valueOf(18 + (Math.abs(hash) % 15));
        } else if (hash % 3 == 1) {
            return (hash % 2 == 0) ? "true" : "false";
        } else {
            return String.valueOf(Math.abs(hash) % 100);
        }
    }

    // ==================== 模式切换 ====================

    public void setMockMode(boolean mockMode) {
        this.mockMode = mockMode;
        log.info("PlatformService Mock模式: {} → {}", !mockMode, mockMode);
    }

    public boolean isMockMode() {
        return mockMode;
    }
}
