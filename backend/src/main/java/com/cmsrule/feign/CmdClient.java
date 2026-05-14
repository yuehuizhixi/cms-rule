package com.cmsrule.feign;

import com.cmsrule.dto.CmdRequestDTO;
import com.cmsrule.dto.CmdResultDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

/**
 * 下发指令Feign客户端
 * 对接 service-model 微服务：POST /api/hvac_iot/cmd
 * 
 * 221 开发集成环境地址通过配置注入
 */
@FeignClient(name = "cmd-service", url = "${cms-rule.cmd.remote-url}")
public interface CmdClient {

    /**
     * 下发指令（批量）
     * @param cmdList 指令请求列表
     * @return 每条指令的执行结果
     */
    @PostMapping("/cmd")
    List<CmdResultDTO> sendCmd(@RequestBody List<CmdRequestDTO> cmdList);
}
