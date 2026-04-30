package com.cmsrule.service;

import com.cmsrule.client.PlatformService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 参数查询服务
 * 提供参数列表和实时数据查询
 * 对接平台外部系统（Mock实现）
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ParameterService {

    private final PlatformService platformService;
    private final ObjectMapper objectMapper;

    /**
     * 获取参数点位列表（Mock数据）
     */
    public List<Map<String, Object>> getParameterList() {
        List<Map<String, Object>> params = new ArrayList<>();
        String[][] rawParams = {
                {"室内温度", "°C", "室内环境温度"},
                {"室外温度", "°C", "室外环境温度"},
                {"相对湿度", "%RH", "室内相对湿度"},
                {"CO₂浓度", "ppm", "室内CO₂浓度"},
                {"光照强度", "lux", "室内光照强度"},
                {"1#空调启停", "", "1号空调开关"},
                {"2#空调启停", "", "2号空调开关"},
                {"照明开关", "", "照明系统开关"},
                {"新风机开关", "", "新风系统开关"},
                {"风机盘管阀", "%", "风机盘管阀门开度"},
                {"供水温度", "°C", "空调供水温度"},
                {"回水温度", "°C", "空调回水温度"},
                {"水泵状态", "", "循环水泵运行状态"},
                {"房间设定温度", "°C", "房间目标温度"},
                {"PM2.5", "μg/m³", "颗粒物浓度"},
                {"VOC浓度", "ppm", "挥发性有机物"},
                {"空调运行电流", "A", "空调运行电流"},
                {"新风量", "m³/h", "新风量"},
                {"室内人数", "人", "室内人数"},
        };

        for (String[] p : rawParams) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p[0]);
            m.put("unit", p[1]);
            m.put("desc", p[2]);
            params.add(m);
        }

        return params;
    }

    /**
     * 获取参数当前实时值（Mock实现）
     * 模拟IoT平台的数据
     */
    public List<Map<String, Object>> getParameterLastValues() {
        List<Map<String, Object>> values = new ArrayList<>();
        Random rnd = new Random(System.currentTimeMillis() / 60000); // Change every minute

        String[][] rawData = {
                {"室内温度", "°C", String.valueOf(22 + rnd.nextInt(8))},
                {"室外温度", "°C", String.valueOf(28 + rnd.nextInt(10))},
                {"相对湿度", "%RH", String.valueOf(50 + rnd.nextInt(30))},
                {"CO₂浓度", "ppm", String.valueOf(400 + rnd.nextInt(600))},
                {"光照强度", "lux", String.valueOf(200 + rnd.nextInt(500))},
                {"1#空调启停", "", rnd.nextBoolean() ? "1" : "0"},
                {"2#空调启停", "", rnd.nextBoolean() ? "1" : "0"},
                {"照明开关", "", rnd.nextBoolean() ? "1" : "0"},
                {"新风机开关", "", rnd.nextBoolean() ? "1" : "0"},
                {"风机盘管阀", "%", String.valueOf(30 + rnd.nextInt(70))},
                {"供水温度", "°C", String.valueOf(7 + rnd.nextInt(5))},
                {"回水温度", "°C", String.valueOf(12 + rnd.nextInt(5))},
                {"水泵状态", "", rnd.nextBoolean() ? "运行" : "停止"},
                {"房间设定温度", "°C", "24"},
                {"PM2.5", "μg/m³", String.valueOf(15 + rnd.nextInt(60))},
                {"VOC浓度", "ppm", String.valueOf(0.1 + rnd.nextDouble())},
                {"空调运行电流", "A", String.valueOf(5 + rnd.nextInt(15))},
                {"新风量", "m³/h", String.valueOf(500 + rnd.nextInt(2000))},
                {"室内人数", "人", String.valueOf(rnd.nextInt(20))},
        };

        for (String[] p : rawData) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p[0]);
            m.put("unit", p[1]);
            m.put("value", p[2]);
            m.put("time", new Date());
            values.add(m);
        }

        return values;
    }
}
