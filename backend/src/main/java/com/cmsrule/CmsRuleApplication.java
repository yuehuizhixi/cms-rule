package com.cmsrule;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableFeignClients(basePackages = "com.cmsrule.feign")
public class CmsRuleApplication {
    public static void main(String[] args) {
        SpringApplication.run(CmsRuleApplication.class, args);
    }
}
