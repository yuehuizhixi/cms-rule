package com.cmsrule.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Redis点位缓存服务
 * 读取/写入 Redis 中 DP_LAST_DATA（最后数据缓存）
 *
 * Redis Key格式：
 * - 单个点位：DP_LAST_DATA:{pointId}
 * - 批量读取：DP_LAST_DATA:BATCH:{hash}
 * - 设备点位列表：DP_LAST_DATA:DEVICE:{deviceId}
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PointCacheService {

    private static final String KEY_PREFIX = "DP_LAST_DATA:";

    private final RedisTemplate<String, String> stringRedisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${cms-rule.cache.point-ttl-seconds:300}")
    private long pointTtlSeconds = 300;

    @Value("${cms-rule.cache.enabled:false}")
    private boolean cacheEnabled = false;

    // ==================== 读取缓存 ====================

    /**
     * 读取单个点位缓存值
     * @param pointId 点位ID
     * @return 点位值JSON字符串，缓存不存在返回null
     */
    public String getPointValue(String pointId) {
        if (!cacheEnabled) return null;
        try {
            String key = KEY_PREFIX + pointId;
            String value = stringRedisTemplate.opsForValue().get(key);
            if (value != null) {
                log.debug("缓存命中: pointId={}, value={}", pointId, value);
            }
            return value;
        } catch (Exception e) {
            log.warn("读取点位缓存失败: pointId={}, error={}", pointId, e.getMessage());
            return null;
        }
    }

    /**
     * 批量读取点位缓存值
     * @param pointIds 点位ID列表
     * @return 点位ID -> 值 的映射
     */
    public Map<String, String> getPointValues(List<String> pointIds) {
        Map<String, String> result = new HashMap<>();
        if (!cacheEnabled || pointIds == null || pointIds.isEmpty()) {
            return result;
        }

        try {
            String[] keys = pointIds.stream()
                    .map(id -> KEY_PREFIX + id)
                    .toArray(String[]::new);

            List<String> values = stringRedisTemplate.opsForValue().multiGet(List.of(keys));
            if (values != null) {
                for (int i = 0; i < pointIds.size(); i++) {
                    String value = values.get(i);
                    if (value != null) {
                        result.put(pointIds.get(i), value);
                    }
                }
            }
            log.debug("批量读取缓存: 请求={}, 命中={}", pointIds.size(), result.size());
        } catch (Exception e) {
            log.warn("批量读取点位缓存失败: error={}", e.getMessage());
        }
        return result;
    }

    // ==================== 写入缓存 ====================

    /**
     * 写入单个点位缓存值
     * @param pointId 点位ID
     * @param value 点位值（会序列化为JSON）
     */
    public void setPointValue(String pointId, Object value) {
        if (!cacheEnabled) return;
        try {
            String key = KEY_PREFIX + pointId;
            String json = serializeValue(value);
            stringRedisTemplate.opsForValue().set(key, json,
                    Duration.ofSeconds(pointTtlSeconds));
            log.debug("写入点位缓存: pointId={}, value={}, ttl={}s", pointId, json, pointTtlSeconds);
        } catch (Exception e) {
            log.warn("写入点位缓存失败: pointId={}, error={}", pointId, e.getMessage());
        }
    }

    /**
     * 批量写入点位缓存值
     * @param pointValues 点位ID -> 值 的映射
     */
    public void setPointValues(Map<String, Object> pointValues) {
        if (!cacheEnabled || pointValues == null || pointValues.isEmpty()) {
            return;
        }

        try {
            for (Map.Entry<String, Object> entry : pointValues.entrySet()) {
                String key = KEY_PREFIX + entry.getKey();
                String json = serializeValue(entry.getValue());
                stringRedisTemplate.opsForValue().set(key, json,
                        Duration.ofSeconds(pointTtlSeconds));
            }
            log.debug("批量写入点位缓存: {}条", pointValues.size());
        } catch (Exception e) {
            log.warn("批量写入点位缓存失败: error={}", e.getMessage());
        }
    }

    /**
     * 写入点位缓存值（使用Hash结构，支持设备维度）
     * @param deviceId 设备ID
     * @param pointId 点位ID
     * @param value 点位值
     */
    public void setPointValueWithDevice(String deviceId, String pointId, Object value) {
        if (!cacheEnabled) return;
        try {
            // 同时写入点位独立key和设备hash
            String pointKey = KEY_PREFIX + pointId;
            String deviceKey = KEY_PREFIX + "DEVICE:" + deviceId;

            String json = serializeValue(value);
            stringRedisTemplate.opsForValue().set(pointKey, json,
                    Duration.ofSeconds(pointTtlSeconds));
            stringRedisTemplate.opsForHash().put(deviceKey, pointId, json);
            stringRedisTemplate.expire(deviceKey, pointTtlSeconds, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("写入点位缓存（含设备）失败: deviceId={}, pointId={}, error={}",
                    deviceId, pointId, e.getMessage());
        }
    }

    // ==================== 缓存管理 ====================

    /**
     * 删除点位缓存
     * @param pointId 点位ID
     */
    public void evictPointValue(String pointId) {
        if (!cacheEnabled) return;
        try {
            String key = KEY_PREFIX + pointId;
            stringRedisTemplate.delete(key);
            log.debug("删除点位缓存: pointId={}", pointId);
        } catch (Exception e) {
            log.warn("删除点位缓存失败: pointId={}, error={}", pointId, e.getMessage());
        }
    }

    /**
     * 清空设备下所有点位缓存
     * @param deviceId 设备ID
     */
    public void evictDeviceCache(String deviceId) {
        if (!cacheEnabled) return;
        try {
            String deviceKey = KEY_PREFIX + "DEVICE:" + deviceId;
            Object entries = stringRedisTemplate.opsForHash().entries(deviceKey);
            if (entries instanceof Map) {
                for (Object pointId : ((Map<?, ?>) entries).keySet()) {
                    stringRedisTemplate.delete(KEY_PREFIX + pointId);
                }
            }
            stringRedisTemplate.delete(deviceKey);
            log.debug("清空设备缓存: deviceId={}", deviceId);
        } catch (Exception e) {
            log.warn("清空设备缓存失败: deviceId={}, error={}", deviceId, e.getMessage());
        }
    }

    /**
     * 判断缓存是否启用
     */
    public boolean isEnabled() {
        return cacheEnabled;
    }

    // ==================== 辅助方法 ====================

    private String serializeValue(Object value) {
        if (value == null) return "null";
        if (value instanceof String) return (String) value;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return String.valueOf(value);
        }
    }
}
