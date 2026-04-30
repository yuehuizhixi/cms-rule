package com.cmsrule.dto;

import com.cmsrule.entity.LogLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

public class LogDTO {

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class LogEntry {
        private String id;
        private LocalDateTime ts;
        private String ruleId;
        private String ruleName;
        private String groupName;
        private LogLevel level;
        private String msg;
        private String executionLogId;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class ExecutionLog {
        private String id;
        private String ruleId;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private String status;
        private String errorCode;
        private String nodeResults;
        private String branchResults;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class LogQueryRequest {
        private String ruleId;
        private String level;
        private LocalDateTime since;
        private LocalDateTime until;
        private Integer limit;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class LogPageResponse {
        private java.util.List<LogEntry> items;
        private long total;
    }
}
