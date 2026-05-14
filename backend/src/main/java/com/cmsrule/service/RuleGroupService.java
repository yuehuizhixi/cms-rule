package com.cmsrule.service;

import com.cmsrule.dto.ApiResponse;
import com.cmsrule.dto.GroupDTO;
import com.cmsrule.entity.RuleGroup;
import com.cmsrule.repository.RuleGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RuleGroupService {

    private final RuleGroupRepository ruleGroupRepository;

    public List<GroupDTO.Group> findAll() {
        return ruleGroupRepository.findAllByOrderByTabOrderAsc().stream()
                .map(this::toGroup)
                .collect(Collectors.toList());
    }

    public GroupDTO.Group findById(String groupId) {
        RuleGroup group = ruleGroupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_GROUP_NOT_FOUND, "分组不存在"));
        return toGroup(group);
    }

    @Transactional
    public RuleGroup create(String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new BusinessException(ApiResponse.ERR_DUPLICATE_NAME, "分组名称不能为空");
        }
        // 校验分组名称唯一性
        ruleGroupRepository.findByName(name.trim()).ifPresent(g -> {
            throw new BusinessException(ApiResponse.ERR_DUPLICATE_NAME, "分组名称已存在");
        });

        Integer nextOrder = ruleGroupRepository.findFirstByOrderByTabOrderDesc()
                .map(g -> g.getTabOrder() + 1)
                .orElse(0);

        RuleGroup group = RuleGroup.builder()
                .id(UUID.randomUUID().toString())
                .name(name.trim())
                .tabOrder(nextOrder)
                .build();
        return ruleGroupRepository.save(group);
    }

    @Transactional
    public RuleGroup update(String groupId, String name) {
        if (name == null || name.trim().isEmpty()) {
            throw new BusinessException(ApiResponse.ERR_DUPLICATE_NAME, "分组名称不能为空");
        }
        RuleGroup group = ruleGroupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_GROUP_NOT_FOUND, "分组不存在"));
        // 校验分组名称唯一性（排除自身）
        String trimmed = name.trim();
        if (!group.getName().equals(trimmed)) {
            ruleGroupRepository.findByName(trimmed).ifPresent(g -> {
                throw new BusinessException(ApiResponse.ERR_DUPLICATE_NAME, "分组名称已存在");
            });
        }
        group.setName(trimmed);
        return ruleGroupRepository.save(group);
    }

    @Transactional
    public void delete(String groupId) {
        if (ruleGroupRepository.count() <= 1) {
            throw new BusinessException(ApiResponse.ERR_LAST_GROUP, "至少保留一个分组");
        }
        ruleGroupRepository.deleteById(groupId);
    }

    private GroupDTO.Group toGroup(RuleGroup g) {
        return new GroupDTO.Group(g.getId(), g.getName(), g.getTabOrder(), g.getCreatedAt());
    }

    public static class BusinessException extends RuntimeException {
        private final int code;
        public BusinessException(int code, String message) {
            super(message);
            this.code = code;
        }
        public int getCode() { return code; }
    }
}
