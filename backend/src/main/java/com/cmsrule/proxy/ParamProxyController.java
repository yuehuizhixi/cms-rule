package com.cmsrule.proxy;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * 参数选择代理——将前端请求转发到实际的 HVAC-IoT 和 CMS 服务
 *
 * 由于 10.74.170.221 需要通过代理访问，使用 RestTemplate（自动遵循 JVM 代理设置）
 */
@RestController
@RequestMapping("/api/rule-engine/proxy")
public class ParamProxyController {

    private static final String REMOTE_HOST = "http://10.74.170.221";
    private static final String CMS_API  = REMOTE_HOST + "/api/cms-cloud-service";
    private static final String HVAC_API = REMOTE_HOST + "/api/hvac_iot";
    private static final String BUSINESS_API = REMOTE_HOST + "/api/business";

    @Value("${cms-rule.proxy.auth-token}")
    private String fallbackAuthToken;

    private final RestTemplate restTemplate;

    public ParamProxyController(@Qualifier("proxyRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /** POST 请求带认证兜底 */
    private Object post(String url, Object body, String authHeader) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String auth = (authHeader != null && !authHeader.isBlank())
                ? authHeader : "Bearer " + fallbackAuthToken;
        headers.set(HttpHeaders.AUTHORIZATION, auth);
        HttpEntity<Object> entity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<Object> resp = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Object.class);
            return resp.getBody();
        } catch (Exception e) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("code", 500);
            err.put("message", "代理请求失败: " + e.getMessage());
            return err;
        }
    }

    // ── 原有代理端点 ──
    @PostMapping("/energyInfo/queryCache")
    public Object queryEnergyCache(@RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(CMS_API + "/energyInfo/queryCache", body == null ? Map.of() : body, auth);
    }
    @PostMapping("/locationTree/query")
    public Object queryLocationTree(@RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(CMS_API + "/locationTree/query", body, auth);
    }
    @PostMapping("/jnyz/dataset/queryParams")
    public Object queryParams(@RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(HVAC_API + "/jnyz/dataset/queryParams", body, auth);
    }
    @PostMapping("/dictionary/queryCacheQuery")
    public Object queryDictionaryCache(@RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(CMS_API + "/dictionary/queryCacheQuery", body, auth);
    }
    @PostMapping("/dictionary/queryNoCacheQuery")
    public Object queryDictionaryNoCache(@RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(CMS_API + "/dictionary/queryNoCacheQuery", body, auth);
    }
    @PostMapping("/projectModel/queryBindRelationAll")
    public Object queryBindRelationAll(@RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(CMS_API + "/projectModel/queryBindRelationAll", body, auth);
    }
    @PostMapping("/dataSimulation/list")
    public Object queryDataSimulationList(@RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(BUSINESS_API + "/dataSimulation/list", body, auth);
    }
    @PostMapping("/emissionInfo/queryCacheAll")
    public Object queryEmissionCacheAll(@RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(CMS_API + "/emissionInfo/queryCacheAll", body == null ? Map.of() : body, auth);
    }

    // ── EMS 数据代理 ──
    @PostMapping("/device/queryModelList")
    public Object queryModelList(@RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(BUSINESS_API + "/device/queryModelList", body == null ? Map.of() : body, auth);
    }
    @PostMapping("/device/queryDeviceListByModelMark")
    public Object queryDeviceListByModelMark(@RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(BUSINESS_API + "/device/queryDeviceListByModelMark", body == null ? Map.of() : body, auth);
    }
    @PostMapping("/device/queryParamlist")
    public Object queryParamlist(@RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(BUSINESS_API + "/device/queryParamlist", body == null ? Map.of() : body, auth);
    }
    @PostMapping("/device/realdata")
    public Object realdata(@RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(BUSINESS_API + "/device/realdata", body == null ? Map.of() : body, auth);
    }
    @PostMapping("/comm-raw-param/batch-latest")
    public Object batchLatest(@RequestBody(required = false) Object body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return post(CMS_API + "/comm-raw-param/batch-latest", body == null ? Map.of() : body, auth);
    }
}
