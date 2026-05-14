package com.cmsrule.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 简单的内存令牌桶限流拦截器
 * 按请求路径限流，每个路径独立计数
 */
@Slf4j
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    /** 默认每接口每秒最多请求数 */
    @Value("${cms-rule.rate-limit.default-qps:100}")
    private int defaultQps;

    /** 突发阈值（秒） */
    @Value("${cms-rule.rate-limit.burst-seconds:2}")
    private int burstSeconds;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();

        // 健康检查接口不限流
        if (path.contains("/actuator/health") || path.contains("/actuator/info")) {
            return true;
        }

        // 获取对应路径的令牌桶，分组粒度用路径前缀的前两级
        String bucketKey = getBucketKey(path);
        Bucket bucket = buckets.computeIfAbsent(bucketKey, k -> new Bucket(defaultQps, burstSeconds));

        if (!bucket.tryAcquire()) {
            log.warn("限流触发: path={}, bucketKey={}", path, bucketKey);
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"code\":429,\"message\":\"请求过于频繁，请稍后重试\",\"data\":null}");
            return false;
        }

        return true;
    }

    /**
     * 提取限流分组key
     * 如 /api/rule-engine/groups → api/rule-engine
     *     /api/rule-engine/rules/xxx → api/rule-engine
     */
    private String getBucketKey(String path) {
        String p = path.replaceAll("^/+", "").replaceAll("/+$", "");
        String[] parts = p.split("/");
        if (parts.length <= 2) return p;
        return parts[0] + "/" + parts[1];
    }

    /**
     * 简单令牌桶实现
     */
    static class Bucket {
        private final long capacity;
        private final AtomicLong tokens;
        private final long windowNanos;
        private volatile long lastRefillTime;

        Bucket(int qps, int burstSeconds) {
            this.capacity = (long) qps * burstSeconds;
            this.tokens = new AtomicLong(capacity);
            this.windowNanos = 1_000_000_000L / qps;
            this.lastRefillTime = System.nanoTime();
        }

        boolean tryAcquire() {
            refill();
            while (true) {
                long current = tokens.get();
                if (current <= 0) return false;
                if (tokens.compareAndSet(current, current - 1)) return true;
            }
        }

        private void refill() {
            long now = System.nanoTime();
            long elapsed = now - lastRefillTime;
            if (elapsed < windowNanos) return;

            // 每经过一个时间窗口补充1个令牌
            long tokensToAdd = elapsed / windowNanos;
            if (tokensToAdd > 0) {
                lastRefillTime = now;
                tokens.updateAndGet(t -> Math.min(capacity, t + tokensToAdd));
            }
        }
    }
}
