package com.cmsrule.repository;

import com.cmsrule.entity.ExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;

public interface ExecutionLogRepository extends JpaRepository<ExecutionLog, String> {
    Optional<ExecutionLog> findFirstByRuleIdOrderByStartTimeDesc(String ruleId);
    void deleteByRuleId(String ruleId);
}
