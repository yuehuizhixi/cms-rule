package com.cmsrule.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

public class GroupDTO {
    @Data @NoArgsConstructor @AllArgsConstructor
    public static class Group {
        private String id;
        private String name;
        private Integer tabOrder;
        private LocalDateTime createdAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class CreateRequest {
        private String name;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class UpdateRequest {
        private String name;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class GroupsWithRulesResponse {
        private List<Group> groups;
        private List<RuleDTO.Rule> rules;
    }
}
