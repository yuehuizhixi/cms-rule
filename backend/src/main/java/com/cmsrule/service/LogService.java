package com.cmsrule.service;

import com.cmsrule.dto.LogDTO;
import com.cmsrule.entity.LogEntry;
import com.cmsrule.entity.LogLevel;
import com.cmsrule.repository.ExecutionLogRepository;
import com.cmsrule.repository.LogEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LogService {

    private final LogEntryRepository logEntryRepository;
    private final ExecutionLogRepository executionLogRepository;

    public LogDTO.LogPageResponse queryLogs(String ruleId, String level, LocalDateTime since, LocalDateTime until, int limit) {
        PageRequest pageRequest = PageRequest.of(0, Math.min(limit, 500), Sort.by(Sort.Direction.DESC, "ts"));
        Page<LogEntry> page;

        try {
            LogLevel lvl = null;
            if (level != null && !level.isBlank()) {
                try {
                    lvl = LogLevel.valueOf(level.trim().toLowerCase());
                } catch (IllegalArgumentException e) {
                    lvl = null;
                }
            }

            boolean hasRuleId = ruleId != null && !ruleId.isBlank();
            boolean hasSince = since != null;
            boolean hasUntil = until != null;

            if (hasSince && hasUntil) {
                if (hasRuleId) {
                    page = logEntryRepository.findByRuleIdAndTsBetweenOrderByTsDesc(ruleId, since, until, pageRequest);
                } else {
                    page = logEntryRepository.findByTsBetweenOrderByTsDesc(since, until, pageRequest);
                }
            } else if (hasRuleId && lvl != null) {
                page = logEntryRepository.findByRuleIdAndLevelOrderByTsDesc(ruleId, lvl, pageRequest);
            } else if (hasRuleId) {
                page = logEntryRepository.findByRuleIdOrderByTsDesc(ruleId, pageRequest);
            } else if (lvl != null) {
                page = logEntryRepository.findByLevelOrderByTsDesc(lvl, pageRequest);
            } else {
                page = logEntryRepository.findAll(pageRequest);
            }
        } catch (Exception e) {
            // Fallback to simple query
            page = logEntryRepository.findAll(pageRequest);
        }

        List<LogDTO.LogEntry> items = page.getContent().stream()
                .map(this::toLogEntry)
                .collect(Collectors.toList());

        return new LogDTO.LogPageResponse(items, page.getTotalElements());
    }

    public LogDTO.ExecutionLog getLatestExecution(String ruleId) {
        return executionLogRepository.findFirstByRuleIdOrderByStartTimeDesc(ruleId)
                .map(exec -> new LogDTO.ExecutionLog(
                        exec.getId(),
                        exec.getRuleId(),
                        exec.getStartTime(),
                        exec.getEndTime(),
                        exec.getStatus().name(),
                        exec.getErrorCode(),
                        exec.getNodeResults(),
                        exec.getBranchResults()
                ))
                .orElse(null);
    }

    private LogDTO.LogEntry toLogEntry(LogEntry e) {
        return new LogDTO.LogEntry(
                e.getId(),
                e.getTs(),
                e.getRuleId(),
                e.getRuleName(),
                e.getGroupName(),
                e.getLevel(),
                e.getMsg(),
                e.getExecutionLogId()
        );
    }
}
