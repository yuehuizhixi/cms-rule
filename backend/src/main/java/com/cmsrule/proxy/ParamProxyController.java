package com.cmsrule.proxy;

import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * 参数选择代理——将前端请求转发到实际的 HVAC-IoT 和 CMS 服务
 *
 * 前端 → Vite proxy → cms-rule 后端 (:8080) → 10.74.170.221 (Kong API 网关)
 * 认证通过 Authorization header (Bearer token) 透传
 */
@RestController
@RequestMapping("/api/rule-engine/proxy")
public class ParamProxyController {

    private static final String REMOTE_HOST = "http://10.74.170.221";
    private static final String CMS_API  = REMOTE_HOST + "/api/cms-cloud-service";
    private static final String HVAC_API = REMOTE_HOST + "/api/hvac_iot";

    private final WebClient webClient;

    public ParamProxyController(WebClient.Builder wb) {
        this.webClient = wb.build();
    }

    /** 构造带认证透传的 POST 请求 */
    private WebClient.RequestBodySpec buildPost(String url, String authHeader) {
        return webClient.post()
                .uri(url)
                .header(HttpHeaders.AUTHORIZATION, authHeader != null ? authHeader : "");
    }

    // ── 1. 能源类型 ──
    @PostMapping("/energyInfo/queryCache")
    public Mono<Object> queryEnergyCache(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return buildPost(CMS_API + "/energyInfo/queryCache", auth)
                .bodyValue(body == null ? Map.of() : body)
                .retrieve()
                .bodyToMono(Object.class);
    }

    // ── 2. 位置树 ──
    @PostMapping("/locationTree/query")
    public Mono<Object> queryLocationTree(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return buildPost(CMS_API + "/locationTree/query", auth)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Object.class);
    }

    // ── 3. 设备参数列表（分页） ──
    @PostMapping("/jnyz/dataset/queryParams")
    public Mono<Object> queryParams(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return buildPost(HVAC_API + "/jnyz/dataset/queryParams", auth)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Object.class);
    }

    // ── 4. 字典查询（模型类型等） ──
    @PostMapping("/dictionary/queryNoCacheQuery")
    public Mono<Object> queryDictionaryNoCache(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return buildPost(CMS_API + "/dictionary/queryNoCacheQuery", auth)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Object.class);
    }

    // ── 5. 绑定关系查询 ──
    @PostMapping("/projectModel/queryBindRelationAll")
    public Mono<Object> queryBindRelationAll(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String auth) {
        return buildPost(CMS_API + "/projectModel/queryBindRelationAll", auth)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Object.class);
    }
}
