package com.cmsrule.dto;

import com.cmsrule.entity.RuleStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

public class RuleDTO {

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Rule {
        private String id;
        private String groupId;
        private String name;
        private String description;
        private RuleStatus status;
        private Integer pollInterval;
        private String flow;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class CreateRequest {
        private String groupId;
        private String name;
        private String description;
        private Integer pollInterval;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class UpdateRequest {
        private String name;
        private String description;
        private Integer pollInterval;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class StatusRequest {
        private RuleStatus status;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class FlowRequest {
        private String flow;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class BatchDeleteRequest {
        private java.util.List<String> ruleIds;
    }
}
