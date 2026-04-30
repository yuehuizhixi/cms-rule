package com.cmsrule.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "log_entry",
        indexes = {
            @Index(name = "idx_log_rule_id", columnList = "rule_id"),
            @Index(name = "idx_log_ts", columnList = "ts"),
            @Index(name = "idx_log_level", columnList = "level")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LogEntry {
    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private LocalDateTime ts;

    @Column(name = "rule_id", nullable = false, length = 36)
    private String ruleId;

    @Column(name = "rule_name", nullable = false, length = 50)
    private String ruleName;

    @Column(name = "group_name", nullable = false, length = 50)
    private String groupName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LogLevel level;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String msg;

    @Column(name = "execution_log_id", length = 36)
    private String executionLogId;
}
