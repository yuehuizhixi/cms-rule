package com.cmsrule.controller;

import com.cmsrule.dto.ApiResponse;
import com.cmsrule.dto.GroupDTO;
import com.cmsrule.dto.RuleDTO;
import com.cmsrule.entity.RuleGroup;
import com.cmsrule.service.RuleGroupService;
import com.cmsrule.service.RuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rule-engine")
@RequiredArgsConstructor
public class RuleGroupController {

    private final RuleGroupService ruleGroupService;
    private final RuleService ruleService;

    // API1: 获取分组与规则列表
    @GetMapping("/groups")
    public ApiResponse<GroupDTO.GroupsWithRulesResponse> getGroups() {
        List<GroupDTO.Group> groups = ruleGroupService.findAll();
        List<RuleDTO.Rule> rules = ruleService.findAll(null);
        return ApiResponse.success(new GroupDTO.GroupsWithRulesResponse(groups, rules));
    }

    // API1b: 获取单个分组
    @GetMapping("/groups/{groupId}")
    public ApiResponse<GroupDTO.Group> getGroup(@PathVariable String groupId) {
        GroupDTO.Group group = ruleGroupService.findById(groupId);
        return ApiResponse.success(group);
    }

    // API2: 新增规则分组
    @PostMapping("/groups")
    public ApiResponse<GroupDTO.Group> createGroup(@RequestBody GroupDTO.CreateRequest req) {
        RuleGroup group = ruleGroupService.create(req.getName());
        return ApiResponse.success(toGroupDTO(group));
    }

    // API3: 更新分组（重命名）
    @PutMapping("/groups/{groupId}")
    public ApiResponse<GroupDTO.Group> updateGroup(@PathVariable String groupId, @RequestBody GroupDTO.UpdateRequest req) {
        RuleGroup group = ruleGroupService.update(groupId, req.getName());
        return ApiResponse.success(toGroupDTO(group));
    }

    // API4: 删除分组
    @DeleteMapping("/groups/{groupId}")
    public ApiResponse<Void> deleteGroup(@PathVariable String groupId) {
        ruleGroupService.delete(groupId);
        return ApiResponse.success();
    }

    private GroupDTO.Group toGroupDTO(RuleGroup g) {
        return new GroupDTO.Group(g.getId(), g.getName(), g.getTabOrder(), g.getCreatedAt());
    }
}
