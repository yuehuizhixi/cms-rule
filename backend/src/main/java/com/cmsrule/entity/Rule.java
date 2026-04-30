package com.cmsrule.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "rule",
        indexes = {
            @Index(name = "idx_group_id", columnList = "group_id"),
            @Index(name = "idx_status", columnList = "status")
        },
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_group_name", columnNames = {"group_id", "name"})
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Rule {
    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "group_id", nullable = false, length = 36)
    private String groupId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 200)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private RuleStatus status = RuleStatus.DRAFT;

    @Column(name = "poll_interval", nullable = false)
    @Builder.Default
    private Integer pollInterval = 30;

    // RuleFlow JSON structure stored as TEXT (compatible with H2 and MySQL)
    @Column(columnDefinition = "text", nullable = false)
    @Builder.Default
    private String flow = "{\"nodes\":{},\"mainFlow\":[]}";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
