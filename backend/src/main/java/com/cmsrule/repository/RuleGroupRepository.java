package com.cmsrule.repository;

import com.cmsrule.entity.RuleGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RuleGroupRepository extends JpaRepository<RuleGroup, String> {
    List<RuleGroup> findAllByOrderByTabOrderAsc();
    Optional<RuleGroup> findFirstByOrderByTabOrderDesc();
    long count();
}
