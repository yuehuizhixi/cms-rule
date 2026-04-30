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
@Table(name = "rule_group")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RuleGroup {
    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "tab_order", nullable = false)
    @Builder.Default
    private Integer tabOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
