-- ============================================
-- CMS Rule Engine - 数据库初始化脚本
-- 目标数据库: cms_rule_db
-- 字符集: utf8mb4
-- ============================================

CREATE DATABASE IF NOT EXISTS `cms_rule_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE `cms_rule_db`;

-- ============================================
-- 1. 规则分组表
-- ============================================
CREATE TABLE IF NOT EXISTS `rule_group` (
  `id`         VARCHAR(36)   NOT NULL COMMENT '主键UUID',
  `name`       VARCHAR(50)   NOT NULL COMMENT '分组名称',
  `tab_order`  INT           NOT NULL DEFAULT 0 COMMENT '排序序号',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='规则分组';

-- ============================================
-- 2. 规则定义表
-- ============================================
CREATE TABLE IF NOT EXISTS `rule` (
  `id`            VARCHAR(36)   NOT NULL COMMENT '主键UUID',
  `group_id`      VARCHAR(36)   NOT NULL COMMENT '所属分组ID',
  `name`          VARCHAR(50)   NOT NULL COMMENT '规则名称',
  `description`   VARCHAR(200)  DEFAULT '' COMMENT '规则描述',
  `status`        VARCHAR(20)   NOT NULL DEFAULT 'DRAFT' COMMENT '状态: DRAFT/INACTIVE/ACTIVE',
  `poll_interval` INT           NOT NULL DEFAULT 30 COMMENT '轮询间隔(秒)',
  `flow`          MEDIUMTEXT    COMMENT '规则流程JSON',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_status` (`status`),
  UNIQUE KEY `uk_group_rule_name` (`group_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='规则定义';

-- ============================================
-- 3. 执行日志表（每次规则轮询一条记录）
-- ============================================
CREATE TABLE IF NOT EXISTS `execution_log` (
  `id`              VARCHAR(36)   NOT NULL COMMENT '主键UUID',
  `rule_id`         VARCHAR(36)   NOT NULL COMMENT '规则ID',
  `start_time`      DATETIME      NOT NULL COMMENT '执行开始时间',
  `end_time`        DATETIME      COMMENT '执行结束时间',
  `status`          VARCHAR(20)   NOT NULL COMMENT '状态: PASS/FAIL/ERROR',
  `error_code`      VARCHAR(50)   DEFAULT NULL COMMENT '错误码',
  `node_results`    TEXT          NOT NULL COMMENT '节点执行结果JSON',
  `branch_results`  TEXT          NOT NULL COMMENT '分支执行结果JSON',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_rule_id` (`rule_id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='执行日志';

-- ============================================
-- 4. 操作日志表（执行过程中的每一条日志条目）
-- ============================================
CREATE TABLE IF NOT EXISTS `log_entry` (
  `id`               VARCHAR(36)   NOT NULL COMMENT '主键UUID',
  `ts`               DATETIME      NOT NULL COMMENT '日志时间',
  `rule_id`          VARCHAR(36)   NOT NULL COMMENT '规则ID',
  `rule_name`        VARCHAR(50)   NOT NULL COMMENT '规则名称',
  `group_name`       VARCHAR(50)   NOT NULL COMMENT '分组名称',
  `level`            VARCHAR(20)   NOT NULL COMMENT '级别: info/success/error',
  `msg`              TEXT          NOT NULL COMMENT '日志消息',
  `execution_log_id` VARCHAR(36)   DEFAULT NULL COMMENT '关联的执行日志ID',
  PRIMARY KEY (`id`),
  KEY `idx_rule_id` (`rule_id`),
  KEY `idx_ts` (`ts`),
  KEY `idx_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='操作日志条目';
