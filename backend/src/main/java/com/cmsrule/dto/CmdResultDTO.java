package com.cmsrule.dto;

import lombok.Data;

/**
 * 下发结果 DTO — 对齐 service-model 的 CommandResultVo
 */
@Data
public class CmdResultDTO {
    /** 指令 id */
    private Long id;
    /** 下发结果 "true"/"false" */
    private String success;
    /** 失败信息 */
    private String msg;
    /** 设备标识 */
    private String deviceMark;
    /** 点位编码 */
    private String paramMark;
    /** 序列号 */
    private String seq;

    public boolean isSuccess() {
        return "true".equalsIgnoreCase(success);
    }
}
