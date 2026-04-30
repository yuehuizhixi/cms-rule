package com.cmsrule.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "execution_log",
        indexes = {
            @Index(name = "idx_exec_rule_id", columnList = "rule_id"),
            @Index(name = "idx_exec_start_time", columnList = "start_time")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExecutionLog {
    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "rule_id", nullable = false, length = 36)
    private String ruleId;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExecutionStatus status;

    @Column(name = "error_code", length = 50)
    private String errorCode;

    // Map<nodeId, PASS|FAIL|PENDING>
    @Column(name = "node_results", columnDefinition = "text", nullable = false)
    private String nodeResults = "{}";

    // Map<branchId, PASS|FAIL|PENDING>
    @Column(name = "branch_results", columnDefinition = "text", nullable = false)
    private String branchResults = "{}";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
