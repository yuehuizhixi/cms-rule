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
        Integer nextOrder = ruleGroupRepository.findFirstByOrderByTabOrderDesc()
                .map(g -> g.getTabOrder() + 1)
                .orElse(0);

        RuleGroup group = RuleGroup.builder()
                .id(UUID.randomUUID().toString())
                .name(name)
                .tabOrder(nextOrder)
                .build();
        return ruleGroupRepository.save(group);
    }

    @Transactional
    public RuleGroup update(String groupId, String name) {
        RuleGroup group = ruleGroupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ApiResponse.ERR_GROUP_NOT_FOUND, "分组不存在"));
        group.setName(name);
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
