package com.cmsrule.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

/**
 * 下发指令Feign客户端
 * 用于向设备下发控制指令
 * 
 * 调用 service-model 微服务：POST /cmd
 */
@FeignClient(name = "cmd-service", url = "${cms-rule.cmd.remote-url:http://localhost:9998}")
public interface CmdClient {

    /**
     * 下发单个指令
     * @param request 指令请求
     * @return 指令执行结果
     */
    @PostMapping("/api/cmd/send")
    String sendCmd(@RequestBody CmdRequest request);

    /**
     * 查询指令执行状态
     * @param cmdId 指令ID
     * @return 指令状态
     */
    @GetMapping("/api/cmd/{cmdId}/status")
    String getCmdStatus(@PathVariable("cmdId") String cmdId);

    /**
     * 批量下发指令
     * @param requests 指令请求列表
     * @return 批量执行结果
     */
    @PostMapping("/api/cmd/send/batch")
    String sendCmdBatch(@RequestBody java.util.List<CmdRequest> requests);

    /**
     * 下发指令请求体
     */
    record CmdRequest(
            String deviceId,
            String pointId,
            Object value,
            String type,
            Integer timeout
    ) {}
}
