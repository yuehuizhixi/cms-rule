package com.cmsrule.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * RestTemplate 配置
 * 使用 JDK HttpClient（Java 11+）替代 SimpleClientHttpRequestFactory，
 * 后者在某些网络环境下连接超时
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    @Primary
    public RestTemplate restTemplate() {
        return new RestTemplate(clientHttpRequestFactory());
    }

    @Bean
    public RestTemplate proxyRestTemplate() {
        return new RestTemplate(clientHttpRequestFactory());
    }

    private JdkClientHttpRequestFactory clientHttpRequestFactory() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(30));
        return factory;
    }
}
