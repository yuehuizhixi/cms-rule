package com.cmsrule.repository;

import com.cmsrule.entity.Rule;
import com.cmsrule.entity.RuleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RuleRepository extends JpaRepository<Rule, String> {
    List<Rule> findByGroupIdOrderByNameAsc(String groupId);
    List<Rule> findByStatus(RuleStatus status);
    Optional<Rule> findByGroupIdAndName(String groupId, String name);
    long countByGroupId(String groupId);
    void deleteByGroupId(String groupId);
}
