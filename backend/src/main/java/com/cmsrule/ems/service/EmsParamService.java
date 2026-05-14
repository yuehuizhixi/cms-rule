package com.cmsrule.ems.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * EMS 参数服务
 *
 * 通过 HTTP 调用本地代理端点（/api/rule-engine/proxy/...）从 10.74.170.221 查询
 * 设备/模型/参数信息及实时值。
 * 所有查询默认使用 tenantId = "geek"。
 * 本服务只读，不执行任何写入操作。
 */
@Service
@Slf4j
public class EmsParamService {

    private final RestTemplate restTemplate;
    private final String localBaseUrl;
    private final String proxyAuthToken;

    /** 默认租户 */
    private static final String DEFAULT_TENANT_ID = "geek";

    public EmsParamService(RestTemplate restTemplate,
                           @Value("${ems.proxy.base-url}") String localBaseUrl,
                           @Value("${cms-rule.proxy.auth-token}") String proxyAuthToken) {
        this.restTemplate = restTemplate;
        this.localBaseUrl = localBaseUrl;
        this.proxyAuthToken = proxyAuthToken;
    }

    // ==================== 模型查询 ====================

    /**
     * 获取指定租户的所有模型
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listModels(String tenantId) {
        String tid = tenantId != null ? tenantId : DEFAULT_TENANT_ID;
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("tenantId", tid);
            request.put("category", "");

            Map<String, Object> response = postForMap("/device/queryModelList", request);
            return extractListOrEmpty(response);
        } catch (Exception e) {
            log.error("listModels 失败: tenantId={}", tid, e);
            return Collections.emptyList();
        }
    }

    /**
     * 获取所有模型（默认租户）
     */
    public List<Map<String, Object>> listModels() {
        return listModels(DEFAULT_TENANT_ID);
    }

    /**
     * 按模型标识获取模型详情
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getModelByMark(String modelMark) {
        List<Map<String, Object>> models = listModels(DEFAULT_TENANT_ID);
        return models.stream()
                .filter(m -> modelMark.equals(m.get("modelMark")))
                .findFirst()
                .orElse(null);
    }

    // ==================== 设备查询 ====================

    /**
     * 按模型标识查询设备列表
     */
    public List<Map<String, Object>> listDevices(String modelMark) {
        return listDevices(DEFAULT_TENANT_ID, modelMark);
    }

    /**
     * 按模型标识查询设备列表（指定租户）
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listDevices(String tenantId, String modelMark) {
        String tid = tenantId != null ? tenantId : DEFAULT_TENANT_ID;
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("modelMark", modelMark);
            // 透传 tenantId
            Map<String, Object> body = new HashMap<>();
            body.put("tenantId", tid);
            body.putAll(request);

            Map<String, Object> response = postForMap("/device/queryDeviceListByModelMark", body);
            return extractListOrEmpty(response);
        } catch (Exception e) {
            log.error("listDevices 失败: tenantId={}, modelMark={}", tid, modelMark, e);
            return Collections.emptyList();
        }
    }

    // ==================== 参数查询 ====================

    /**
     * 按模型标识查询参数列表（默认租户）
     */
    public List<Map<String, Object>> listParams(String modelMark) {
        return listParams(DEFAULT_TENANT_ID, modelMark);
    }

    /**
     * 按模型标识查询参数列表（指定租户）
     * 从 proxy/queryParamlist 获取后，在内存中按 tenantId + modelMark 过滤
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listParams(String tenantId, String modelMark) {
        String tid = tenantId != null ? tenantId : DEFAULT_TENANT_ID;
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("modelMark", modelMark);
            request.put("search", "");
            request.put("paramType", "");
            request.put("tenantId", tid);

            Map<String, Object> response = postForMap("/device/queryParamlist", request);
            List<Map<String, Object>> all = extractListOrEmpty(response);
            // 内存过滤 tenantId (API 返回包含所有租户的参数)
            return all.stream()
                    .filter(p -> tid.equals(p.get("tenantId")))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("listParams 失败: tenantId={}, modelMark={}", tid, modelMark, e);
            return Collections.emptyList();
        }
    }

    /**
     * 按模型标识查询可下发的参数（deliverFlag = "2"）
     */
    public List<Map<String, Object>> listDeliverableParams(String modelMark) {
        return listDeliverableParams(DEFAULT_TENANT_ID, modelMark);
    }

    /**
     * 按模型标识查询可下发的参数（指定租户）
     */
    public List<Map<String, Object>> listDeliverableParams(String tenantId, String modelMark) {
        return listParams(tenantId, modelMark).stream()
                .filter(p -> "2".equals(p.get("deliverFlag")))
                .collect(Collectors.toList());
    }

    /**
     * 获取单个参数详情
     */
    public Map<String, Object> getParamInfo(String modelMark, String paramMark) {
        return getParamInfo(DEFAULT_TENANT_ID, modelMark, paramMark);
    }

    /**
     * 获取单个参数详情（指定租户）
     */
    public Map<String, Object> getParamInfo(String tenantId, String modelMark, String paramMark) {
        String tid = tenantId != null ? tenantId : DEFAULT_TENANT_ID;
        List<Map<String, Object>> params = listParams(tid, modelMark);
        return params.stream()
                .filter(p -> paramMark.equals(p.get("paramMark")))
                .findFirst()
                .orElse(null);
    }

    // ==================== 映射查询 ====================

    /**
     * 获取参数对应的设备标识
     * 通过实时值接口查询 realdata，从结果解析设备标识
     */
    @SuppressWarnings("unchecked")
    public String getDeviceMarkForParam(String modelMark, String paramMark) {
        return getDeviceMarkForParam(DEFAULT_TENANT_ID, modelMark, paramMark);
    }

    /**
     * 获取参数对应的设备标识（指定租户）
     */
    @SuppressWarnings("unchecked")
    public String getDeviceMarkForParam(String tenantId, String modelMark, String paramMark) {
        String tid = tenantId != null ? tenantId : DEFAULT_TENANT_ID;
        try {
            // 查询该模型下的所有设备
            List<Map<String, Object>> devices = listDevices(tid, modelMark);
            if (devices.isEmpty()) {
                return null;
            }
            // 对每个设备尝试查询实时值，看是否有该参数
            for (Map<String, Object> device : devices) {
                String deviceMark = (String) device.get("deviceMark");
                if (deviceMark == null) continue;

                String paramsKey = modelMark + "#" + deviceMark + "#" + paramMark;
                Map<String, Object> request = new HashMap<>();
                request.put("params", paramsKey);

                Map<String, Object> response = postForMap("/device/realdata", request);
                List<Map<String, Object>> values = extractListOrEmpty(response);
                if (!values.isEmpty()) {
                    return deviceMark;
                }
            }
        } catch (Exception e) {
            log.warn("getDeviceMarkForParam 失败: modelMark={}, paramMark={}", modelMark, paramMark, e);
        }
        return null;
    }

    /**
     * 获取参数对应的设备列表（通过实时值接口探测）
     */
    public List<Map<String, Object>> getDevicesForParam(String modelMark, String paramMark) {
        return getDevicesForParam(DEFAULT_TENANT_ID, modelMark, paramMark);
    }

    /**
     * 获取参数对应的设备列表（指定租户）
     */
    public List<Map<String, Object>> getDevicesForParam(String tenantId, String modelMark, String paramMark) {
        String tid = tenantId != null ? tenantId : DEFAULT_TENANT_ID;
        List<Map<String, Object>> allDevices = listDevices(tid, modelMark);
        return allDevices.stream()
                .filter(d -> {
                    String deviceMark = (String) d.get("deviceMark");
                    if (deviceMark == null) return false;
                    try {
                        String paramsKey = modelMark + "#" + deviceMark + "#" + paramMark;
                        Map<String, Object> request = new HashMap<>();
                        request.put("params", paramsKey);
                        Map<String, Object> response = postForMap("/device/realdata", request);
                        List<Map<String, Object>> values = extractListOrEmpty(response);
                        return !values.isEmpty();
                    } catch (Exception e) {
                        return false;
                    }
                })
                .collect(Collectors.toList());
    }

    /**
     * 获取设备参数的物理点位映射信息
     * 注意：老的映射查询逻辑依赖 device_param_point_mapping 表，
     * 新方案通过实时值/comm-raw-param API 获取绑定关系。
     * 此方法返回一个空 Map 占位，具体映射在规则引擎运行时决定。
     */
    public Map<String, Object> getPointMapping(Long deviceId, String paramMark) {
        return Collections.emptyMap();
    }

    /**
     * 获取设备所有参数的映射信息
     */
    public List<Map<String, Object>> getDevicePointMappings(Long deviceId) {
        return Collections.emptyList();
    }

    // ==================== 批量查询 ====================

    /**
     * 批量查询参数信息
     *
     * @param requests 参数查询请求：每个包含 modelMark + paramMark
     * @return 参数信息列表（按请求顺序，不存在的项为 null）
     */
    public List<Map<String, Object>> batchGetParamInfo(List<ParamQueryRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return Collections.emptyList();
        }
        return requests.stream()
                .map(req -> getParamInfo(req.modelMark(), req.paramMark()))
                .collect(Collectors.toList());
    }

    /**
     * 批量查询参数的设备标识
     *
     * @param requests 参数查询请求
     * @return Map: paramMark -> deviceMark
     */
    public Map<String, String> batchGetDeviceMarkForParam(List<ParamQueryRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, String> result = new LinkedHashMap<>();
        for (ParamQueryRequest req : requests) {
            String deviceMark = getDeviceMarkForParam(DEFAULT_TENANT_ID, req.modelMark(), req.paramMark());
            if (deviceMark != null) {
                result.put(req.paramMark(), deviceMark);
            }
        }
        return result;
    }

    // ==================== 实时值查询 ====================

    /**
     * 查询设备参数的实时值
     *
     * @param modelMark  模型标识
     * @param deviceMark 设备标识
     * @param paramMark  参数标识
     * @return 实时值列表（List<Map>），每个包含 value, time 等字段
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getParamValue(String modelMark, String deviceMark, String paramMark) {
        return getParamValue(DEFAULT_TENANT_ID, modelMark, deviceMark, paramMark);
    }

    /**
     * 查询设备参数的实时值（指定租户）
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getParamValue(String tenantId, String modelMark, String deviceMark, String paramMark) {
        try {
            String paramsKey = modelMark + "#" + deviceMark + "#" + paramMark;
            Map<String, Object> request = new HashMap<>();
            request.put("params", paramsKey);

            Map<String, Object> response = postForMap("/device/realdata", request);
            return extractListOrEmpty(response);
        } catch (Exception e) {
            log.warn("getParamValue 失败: modelMark={}, deviceMark={}, paramMark={}",
                    modelMark, deviceMark, paramMark, e);
            return Collections.emptyList();
        }
    }

    // ==================== 内部帮助方法 ====================

    /**
     * 调用本地代理 POST 端点并返回 Map 响应
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> postForMap(String path, Object requestBody) {
        String url = localBaseUrl + "/api/rule-engine/proxy" + path;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + proxyAuthToken);
        HttpEntity<Object> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                url, HttpMethod.POST, entity,
                new ParameterizedTypeReference<Map<String, Object>>() {});
        return response.getBody() != null ? response.getBody() : new HashMap<>();
    }

    /**
     * 从代理响应 Map 中提取 data 列表，兼容多种格式：
     * 1. {"code": 200, "data": [...] }
     * 2. {"data": [...] }
     * 3. {"data": {"list": [...], "total": "N"}}  ← business API 实际格式
     * 4. 本身就是列表的直接返回
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractListOrEmpty(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            return Collections.emptyList();
        }

        // 尝试取 data 字段
        Object dataObj = response.get("data");
        // 格式 3: {"data": {"list": [...], "total": "N"}}
        if (dataObj instanceof Map) {
            Map<?, ?> dataMap = (Map<?, ?>) dataObj;
            Object listObj = dataMap.get("list");
            if (listObj instanceof List) {
                List<?> rawList = (List<?>) listObj;
                List<Map<String, Object>> result = new ArrayList<>();
                for (Object item : rawList) {
                    if (item instanceof Map) {
                        result.add((Map<String, Object>) item);
                    }
                }
                return result;
            }
        }
        // 格式 1/2: {"data": [...]}
        if (dataObj instanceof List) {
            List<?> rawList = (List<?>) dataObj;
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object item : rawList) {
                if (item instanceof Map) {
                    result.add((Map<String, Object>) item);
                }
            }
            return result;
        }

        // 如果响应本身就是列表
        if (response.values().stream().anyMatch(v -> v instanceof List)) {
            for (Object v : response.values()) {
                if (v instanceof List) {
                    List<?> rawList = (List<?>) v;
                    List<Map<String, Object>> result = new ArrayList<>();
                    for (Object item : rawList) {
                        if (item instanceof Map) {
                            result.add((Map<String, Object>) item);
                        }
                    }
                    return result;
                }
            }
        }

        return Collections.emptyList();
    }

    /**
     * 参数查询请求 DTO（内部使用）
     */
    public record ParamQueryRequest(String modelMark, String paramMark) {}
}
