CREATE DATABASE IF NOT EXISTS cms_rule DEFAULT CHARSET=utf8mb4;
USE cms_rule;

CREATE TABLE IF NOT EXISTS rule_group (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    tab_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS `rule` (
    id VARCHAR(36) PRIMARY KEY,
    group_id VARCHAR(36) NOT NULL,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    status ENUM('ACTIVE','INACTIVE','DRAFT') NOT NULL DEFAULT 'DRAFT',
    poll_interval INT NOT NULL DEFAULT 30,
    flow JSON NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    FOREIGN KEY (group_id) REFERENCES rule_group(id) ON DELETE CASCADE,
    INDEX idx_group_id (group_id),
    INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS execution_log (
    id VARCHAR(36) PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    start_time DATETIME(3) NOT NULL,
    end_time DATETIME(3),
    status ENUM('PASS','FAIL','ERROR') NOT NULL,
    error_code VARCHAR(50),
    node_results JSON NOT NULL,
    branch_results JSON NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (rule_id) REFERENCES `rule`(id) ON DELETE CASCADE,
    INDEX idx_rule_id (rule_id),
    INDEX idx_start_time (start_time)
);

CREATE TABLE IF NOT EXISTS log_entry (
    id VARCHAR(36) PRIMARY KEY,
    ts DATETIME(3) NOT NULL,
    rule_id VARCHAR(36) NOT NULL,
    rule_name VARCHAR(50) NOT NULL,
    group_name VARCHAR(20) NOT NULL,
    level ENUM('info','success','error') NOT NULL,
    msg TEXT NOT NULL,
    execution_log_id VARCHAR(36),
    FOREIGN KEY (rule_id) REFERENCES `rule`(id) ON DELETE CASCADE,
    INDEX idx_rule_id (rule_id),
    INDEX idx_ts (ts),
    INDEX idx_level (level)
);
