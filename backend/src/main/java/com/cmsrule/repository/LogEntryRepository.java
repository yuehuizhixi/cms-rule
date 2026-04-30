package com.cmsrule.repository;

import com.cmsrule.entity.LogEntry;
import com.cmsrule.entity.LogLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface LogEntryRepository extends JpaRepository<LogEntry, String> {
    Page<LogEntry> findByRuleIdOrderByTsDesc(String ruleId, Pageable pageable);
    Page<LogEntry> findByLevelOrderByTsDesc(LogLevel level, Pageable pageable);
    Page<LogEntry> findByRuleIdAndLevelOrderByTsDesc(String ruleId, LogLevel level, Pageable pageable);
    Page<LogEntry> findByTsBetweenOrderByTsDesc(LocalDateTime start, LocalDateTime end, Pageable pageable);
    Page<LogEntry> findByRuleIdAndTsBetweenOrderByTsDesc(String ruleId, LocalDateTime start, LocalDateTime end, Pageable pageable);
    void deleteByRuleId(String ruleId);
}
