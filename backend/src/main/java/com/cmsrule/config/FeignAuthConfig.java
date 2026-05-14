package com.cmsrule.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;

/**
 * Feign 全局认证拦截器
 * 自动为所有 Feign 客户端添加 Authorization header
 */
@Configuration
public class FeignAuthConfig {

    @Value("${cms-rule.proxy.auth-token}")
    private String authToken;

    @Bean
    public RequestInterceptor authRequestInterceptor() {
        return requestTemplate ->
            requestTemplate.header(HttpHeaders.AUTHORIZATION, "Bearer " + authToken);
    }
}
