# LoadProfile 用户画像存储字段定义

> 用途：记录用户填写的 LoadProfile 干预因子，供安装商（GS）查看及内部分析使用。
> 所有字段均允许为空（用户跳过时存 null）。

---

## 字段定义

| 字段名 | 数据类型 | 允许值 | 为空含义 | 说明 |
|--------|---------|--------|---------|------|
| `daytime_occupancy` | string / enum | 见下方 | 用户跳过，不修正基准曲线 | 居住占用模式 |
| `hvac_system` | string / enum | 见下方 | 用户跳过，等同 No system | 供暖/制冷系统 |
| `hvac_usage_level` | string / enum | 见下方 | 用户跳过，等同 Medium | 冷暖使用强度（仅当 hvac_system 非空且非 No system 时有意义） |
| `ev_annual_mileage_km` | integer | 见下方 | 用户跳过，等同 No EV | 电动车年里程（km） |
| `ev_charging_pattern` | string / enum | 见下方 | 用户跳过，等同 Mostly overnight | EV充电习惯（仅当 ev_annual_mileage_km 非空且非 0 时有意义） |

---

## 枚举值定义

### daytime_occupancy

| 存储值 | 显示文案（EN） | 显示文案（CN） |
|--------|--------------|--------------|
| `mostly_away` | Mostly away during the day | 白天大多不在家 |
| `working_from_home` | Working from home | 居家办公 |
| `always_home` | Someone always at home | 始终有人在家 |
| `null` | — | 用户跳过 |

### hvac_system

| 存储值 | 显示文案（EN） | 显示文案（CN） |
|--------|--------------|--------------|
| `none` | No heating or cooling system | 无供暖/制冷系统 |
| `ac` | Air conditioning | 空调 |
| `electric_heating` | Electric heating | 电采暖 |
| `heat_pump` | Heat pump (heating & cooling) | 热泵（冷暖两用） |
| `null` | — | 用户跳过 |

### hvac_usage_level

| 存储值 | 显示文案（EN） | 显示文案（CN） |
|--------|--------------|--------------|
| `low` | Low | 低强度 |
| `medium` | Medium | 中等强度 |
| `high` | High | 高强度 |
| `very_high` | Very high | 很高强度 |
| `null` | — | 用户跳过 |

### ev_annual_mileage_km

| 存储值 | 显示文案（EN） | 显示文案（CN） |
|--------|--------------|--------------|
| `0` | No electric vehicle | 无电动车 |
| `5000` | 5,000 km | 5,000 公里/年 |
| `10000` | 10,000 km | 10,000 公里/年 |
| `15000` | 15,000 km | 15,000 公里/年 |
| `20000` | 20,000 km | 20,000 公里/年 |
| `25000` | 25,000+ km | 25,000+ 公里/年 |
| `null` | — | 用户跳过 |

### ev_charging_pattern

| 存储值 | 显示文案（EN） | 显示文案（CN） |
|--------|--------------|--------------|
| `overnight` | Mostly overnight | 主要夜间充电 |
| `mixed` | Mixed day and night | 白天夜间混合 |
| `daytime` | Mostly daytime | 主要白天充电 |
| `solar_optimized` | Solar-optimized charging | 太阳能优化充电 |
| `null` | — | 用户跳过 |

---

## 附加元数据字段（建议同步存储）

| 字段名 | 数据类型 | 说明 |
|--------|---------|------|
| `country` | string | 国家代码，如 `AU` / `DE` |
| `region` | string | 州/地区，如 `NSW` / `VIC` |
| `base_annual_kwh` | float | 计算使用的基础年电量（kWh） |
| `final_annual_kwh` | float | LoadProfile 计算后的最终年电量（kWh） |
| `load_profile_version` | string | 参数包版本号，如 `AU_MSATS_2021` |
| `created_at` | datetime | 记录创建时间 |
| `source` | string | 数据来源：`user_input` / `default` / `bill_parsed` |

---

## 计算结果字段（建议同步存储，供安装商直接使用）

| 字段名 | 数据类型 | 说明 |
|--------|---------|------|
| `daily_avg_kwh` | float | 日均用电（kWh） |
| `daytime_kwh` | float | 白天用电 H07-H16（kWh） |
| `evening_peak_kwh` | float | 晚高峰用电 H17-H20（kWh） |
| `overnight_kwh` | float | 整夜用电 H17-H06（kWh） |
| `monthly_share` | float[12] | 月度占比数组，合计=1.0 |
| `hourly_share` | float[24] | 24h 占比数组，合计=1.0 |

---

## 示例记录

```json
{
  "country": "AU",
  "region": "NSW",
  "daytime_occupancy": "working_from_home",
  "hvac_system": "heat_pump",
  "hvac_usage_level": "medium",
  "ev_annual_mileage_km": 10000,
  "ev_charging_pattern": "solar_optimized",
  "base_annual_kwh": 7778,
  "final_annual_kwh": 11378,
  "load_profile_version": "AU_MSATS_2021",
  "source": "user_input",
  "created_at": "2026-04-15T10:30:00Z",
  "daily_avg_kwh": 31.17,
  "daytime_kwh": 8.51,
  "evening_peak_kwh": 8.00,
  "overnight_kwh": 25.08,
  "monthly_share": [0.094, 0.087, 0.084, 0.058, 0.067, 0.117, 0.119, 0.107, 0.060, 0.059, 0.060, 0.089],
  "hourly_share": [0.060, 0.055, 0.049, 0.044, 0.043, 0.045, 0.036, 0.041, 0.043, 0.022, 0.022, 0.021, 0.021, 0.021, 0.026, 0.027, 0.030, 0.058, 0.073, 0.070, 0.056, 0.052, 0.063, 0.062]
}
```

---

## 全部跳过时的存储示例

```json
{
  "country": "AU",
  "region": "NSW",
  "daytime_occupancy": null,
  "hvac_system": null,
  "hvac_usage_level": null,
  "ev_annual_mileage_km": null,
  "ev_charging_pattern": null,
  "base_annual_kwh": 7778,
  "final_annual_kwh": 7778,
  "source": "default",
  "daily_avg_kwh": 21.31,
  "daytime_kwh": 9.06,
  "evening_peak_kwh": 6.17,
  "overnight_kwh": 12.25
}
```

> 全部为 null 时，计算结果直接等于 MSATS 基准曲线的预设值，无任何修正。

---

## 简化版字段对照表

| # | 题目（用户看到的） | 存储字段 | 存储值示例 | 跳过时存储 |
|---|-----------------|---------|----------|----------|
| 1 | Daytime Occupancy / 居住占用模式 | `daytime_occupancy` | `"mostly_away"` / `"working_from_home"` / `"always_home"` | `null` |
| 2 | Heating and Cooling System / 供暖/制冷系统 | `hvac_system` | `"none"` / `"ac"` / `"electric_heating"` / `"heat_pump"` | `null` |
| 3 | Heating and Cooling Usage / 冷暖使用强度 | `hvac_usage_level` | `"low"` / `"medium"` / `"high"` / `"very_high"` | `null` |
| 4 | EV Annual Driving / 电动车年里程 | `ev_annual_mileage_km` | `0` / `5000` / `10000` / `15000` / `20000` / `25000` | `null` |
| 5 | EV Charging Pattern / EV充电习惯 | `ev_charging_pattern` | `"overnight"` / `"mixed"` / `"daytime"` / `"solar_optimized"` | `null` |
