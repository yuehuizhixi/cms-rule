package com.cmsrule.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

/**
 * IoT平台点位读取Feign客户端
 * 用于从IoT平台读取实时点位值
 * 
 * 调用 business 微服务：GET /modelParam/list/all?modelMark=xxx
 */
@FeignClient(name = "iot-platform", url = "${cms-rule.iot.remote-url:http://localhost:9999}")
public interface IotPlatformClient {

    /**
     * 读取单个点位值
     * @param pointId 点位ID
     * @return 点位值（JSON格式）
     */
    @GetMapping("/api/points/{pointId}/value")
    String getPointValue(@PathVariable("pointId") String pointId);

    /**
     * 批量读取点位值
     * @param pointIds 点位ID列表（逗号分隔）
     * @return 点位值映射（JSON格式）
     */
    @GetMapping("/api/points/values")
    String getPointValues(@RequestParam("ids") String pointIds);

    /**
     * 批量读取点位值（POST方式）
     * @param pointIds 点位ID列表
     * @return 点位值映射
     */
    @PostMapping("/api/points/values/batch")
    String getPointValuesBatch(@RequestBody java.util.List<String> pointIds);

    /**
     * 读取点位详情（包含值）
     * @param pointId 点位ID
     * @return 点位完整信息
     */
    @GetMapping("/api/points/{pointId}")
    String getPointInfo(@PathVariable("pointId") String pointId);

    /**
     * 按模型标识读取所有点位（调用business微服务）
     * @param modelMark 模型标识
     * @return 该模型下所有点位列表
     */
    @GetMapping("/modelParam/list/all")
    java.util.List<java.util.Map<String, Object>> listPointsByModel(@RequestParam("modelMark") String modelMark);
}
