package com.cmsrule.controller;

import com.cmsrule.dto.ApiResponse;
import com.cmsrule.dto.LogDTO;
import com.cmsrule.service.LogService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/rule-engine")
@RequiredArgsConstructor
public class LogController {

    private final LogService logService;

    // API15: 获取运行日志
    @GetMapping("/logs")
    public ApiResponse<LogDTO.LogPageResponse> getLogs(
            @RequestParam(required = false) String ruleId,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime until,
            @RequestParam(defaultValue = "200") Integer limit
    ) {
        LogDTO.LogPageResponse resp = logService.queryLogs(ruleId, level, since, until, limit);
        return ApiResponse.success(resp);
    }
}
