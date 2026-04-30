package com.cmsrule.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    private int code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(0, "success", data);
    }

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(0, "success", null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    // 业务错误码
    public static final int ERR_DUPLICATE_NAME = 4001;
    public static final int ERR_GROUP_NOT_FOUND = 4002;
    public static final int ERR_RULE_NOT_FOUND = 4004;
    public static final int ERR_DRAFT_CANNOT_ENABLE = 4003;
    public static final int ERR_FLOW_INCOMPLETE = 4005;
    public static final int ERR_ROUTE_TARGET_INVALID = 4006;
    public static final int ERR_LAST_GROUP = 4007;
}
