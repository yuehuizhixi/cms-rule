package com.cmsrule.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 下发请求 DTO — 对齐 service-model 的 CommandRequest
 * POST /api/hvac_iot/cmd
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CmdRequestDTO {
    /** 物模型实例编码（设备标识） */
    private String deviceMark;
    /** 物模型点位编码 */
    private String paramMark;
    /** 下发值 */
    private String value;
    /** 指令超时时长（秒），默认 10 */
    private Long timeout = 10L;
    /** 指令发起者信息 */
    private String createBy;
    /** 序列号 */
    private String seq;
    /** 模型标识 */
    private String modelMark;
}
