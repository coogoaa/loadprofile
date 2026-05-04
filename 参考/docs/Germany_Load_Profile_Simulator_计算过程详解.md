# Germany Load Profile Simulator — 完整计算过程详解

## 1. 文档概述

本文档对 `副本_简化版Germany_Load_Profile_Simulator.xlsx` 工作簿中所有工作表的计算逻辑进行逐步拆解。

该模拟器的核心设计理念是：**年总电量 (Annual kWh) + 月度占比 (Monthly Share) + 24小时占比 (24h Share)**，不展开为 8,760 小时的逐时数据。

数据来源：[BDEW 德国标准负荷曲线](https://www.bdew.de/energie/standardlastprofile-strom/)

---

## 2. 工作表总览（10 个 Sheet）

| 序号 | Sheet 名称 | 功能 |
|------|-----------|------|
| 1 | 说明&简化逻辑 | 说明文档：5 大干预因子的定义、选项、影响维度和简化系数表 |
| 2 | DE_Base_Profile | 德国基准负荷曲线：12 个月占比 + 24 小时占比 + 各类标志位 |
| 3 | DE_Simulator | 主模拟器：用户输入 → 月度结果 + 24h 结果 |
| 4 | DE_Option_Monthly | 预设场景的月度对比输出（引用 DE_Calc_Compare） |
| 5 | DE_Option_Hourly | 预设场景的 24h 对比输出（引用 DE_Calc_Compare） |
| 6 | DE_Lookups | 所有查找表：占用系数、使用强度系数、系统热负荷、EV 里程等 |
| 7 | DE_Calc_Compare | 批量场景计算引擎（每 45 行一个场景，月度 + 24h 完整计算） |
| 8 | 基于2025最新数据结果 | 2025 版 H0 家庭负载数据的月占比和小时占比原始数据 |
| 9 | 最终提炼主干因素 | 产品化设计文档：UI 标签、选项、干预逻辑的完整定义 |
| 10 | Cooling-Heating-Month | 全球各国/地区的冷暖季节月份定义参考表 |

---

## 3. 五大干预因子详解

### 3.1 居住占用模式 (Daytime Occupancy)

- **影响维度**：仅 24h 分布
- **选项与系数**：

| 选项 | 09:00–17:00 乘数 | 说明 |
|------|-----------------|------|
| Mostly away during the day | ×0.6 | 白天离家，夜间用电偏重 |
| Working from home | ×1.4 | 居家办公，白天用电偏重 |
| Someone always at home | ×1.2 | 始终有人在家，白天适度偏重 |

- **计算逻辑**：09–17 时段乘以对应系数，其余时段保持 ×1.0，然后对全天 24 小时重新归一化（Normalize）

### 3.2 供暖/制冷系统 (Heating & Cooling System)

- **影响维度**：年电量 + 月度占比 + 24h 分布
- **选项**：

| 选项 | 基础热负荷 (kWh) | 说明 |
|------|-----------------|------|
| No heating or cooling system | 0 | 无额外电量 |
| Air conditioning | 0 | 仅重分配冷季月份和下午峰值，不增加年电量 |
| Electric heating | 3,000 | 增加年电量，启用供暖季修正 |
| Heat pump (heating & cooling) | 2,000 | 增加年电量，同时启用冷暖季修正 |

- **季节定义（德国）**：
  - 制冷季 (Cooling Season)：6月–8月
  - 供暖季 (Heating Season)：10月–4月

### 3.3 冷暖使用强度 (Heating & Cooling Usage)

- **影响维度**：年电量 + 月度占比 + 24h 分布
- **系数表**：

| 强度 | 年电量倍率 | 冷季月乘数 | 暖季月乘数 | 冷峰时段乘数 | 暖峰时段乘数 |
|------|-----------|-----------|-----------|-------------|-------------|
| Low | 0.7 | 1.05 | 1.08 | 1.10 | 1.08 |
| Medium | 1.0 | 1.10 | 1.15 | 1.20 | 1.15 |
| High | 1.3 | 1.20 | 1.25 | 1.35 | 1.25 |
| Very high | 1.6 | 1.35 | 1.40 | 1.50 | 1.40 |

- **峰时段定义**：
  - 制冷峰：14:00–19:00
  - 供暖峰：06:00–09:00 & 18:00–22:00

### 3.4 电动车年里程 (EV Annual Driving)

- **影响维度**：年电量 + 月度占比
- **选项**：0 / 5,000 / 10,000 / 15,000 / 20,000 / 25,000+ km
- **计算**：`EV 年电量 = 里程 × 0.18 kWh/km`
- **月度处理**：EV 新增电量平均分摊到 12 个月（`EV_extra / 12`）

### 3.5 EV 充电习惯 (EV Charging Pattern)

- **影响维度**：仅 24h 分布
- **选项与时段**：

| 选项 | 充电时段 | 说明 |
|------|---------|------|
| Mostly overnight | 22:00–05:00 | 每小时均分 1/8 |
| Mixed day and night | 白天 + 夜间混合 | 按混合比例分配 |
| Mostly daytime | 10:00–15:00 | 每小时均分 1/6 |
| Solar-optimized | 80% 光伏代理曲线 + 20% 夜间 | 简化太阳能优化 |

---

## 4. DE_Base_Profile — 基准负荷曲线

### 4.1 月度基准数据（B6:F17）


| 月份 | Base Monthly Share | 冷季标志 | 暖季标志 | 说明 |
|------|-------------------|---------|---------|------|
| 1月 | 0.0789 | 0 | 1 | Heating season |
| 2月 | 0.0791 | 0 | 1 | Heating season |
| 3月 | 0.0773 | 0 | 1 | Heating season |
| 4月 | 0.0822 | 0 | 1 | Heating season |
| 5月 | 0.0839 | 0 | 0 | Shoulder month |
| 6月 | 0.0876 | 1 | 0 | Cooling season |
| 7月 | 0.0917 | 1 | 0 | Cooling season |
| 8月 | 0.0887 | 1 | 0 | Cooling season |
| 9月 | 0.0853 | 0 | 0 | Shoulder month |
| 10月 | 0.0838 | 0 | 1 | Heating season |
| 11月 | 0.0819 | 0 | 1 | Heating season |
| 12月 | 0.0796 | 0 | 1 | Heating season |

- **C 列公式**：`Base kWh = 3500 × Base Monthly Share`（例如 C6 = `3500 * B6`）
- **合计校验**：`SUM(B6:B17) = 1.0`

### 4.2 24 小时基准数据（I6:I29）

| 小时 | Base 24h Share | 白天标志(09-17) | 冷峰标志(14-19) | 暖峰标志(06-09 & 18-22) |
|------|---------------|----------------|----------------|----------------------|
| 0 | 0.0301 | 0 | 0 | 0 |
| 1 | 0.0258 | 0 | 0 | 0 |
| 2 | 0.0239 | 0 | 0 | 0 |
| 3 | 0.0232 | 0 | 0 | 0 |
| 4 | 0.0236 | 0 | 0 | 0 |
| 5 | 0.0252 | 0 | 0 | 0 |
| 6 | 0.0300 | 0 | 0 | 1 |
| 7 | 0.0358 | 0 | 0 | 1 |
| 8 | 0.0410 | 0 | 0 | 1 |
| 9 | 0.0446 | 1 | 0 | 1 |
| 10 | 0.0474 | 1 | 0 | 0 |
| 11 | 0.0518 | 1 | 0 | 0 |
| 12 | 0.0513 | 1 | 0 | 0 |
| 13 | 0.0481 | 1 | 0 | 0 |
| 14 | 0.0459 | 1 | 1 | 0 |
| 15 | 0.0454 | 1 | 1 | 0 |
| 16 | 0.0475 | 1 | 1 | 0 |
| 17 | 0.0535 | 1 | 1 | 0 |
| 18 | 0.0587 | 0 | 1 | 1 |
| 19 | 0.0591 | 0 | 1 | 1 |
| 20 | 0.0556 | 0 | 0 | 1 |
| 21 | 0.0508 | 0 | 0 | 1 |
| 22 | 0.0451 | 0 | 0 | 1 |
| 23 | 0.0366 | 0 | 0 | 0 |

- **合计校验**：`SUM(I6:I29) = 1.0`

### 4.3 EV 充电分布曲线（N–Q 列）

Solar PV Proxy（M 列）和四种充电模式的小时分配权重：

| 小时 | Solar PV Proxy | Mostly overnight | Mixed | Mostly daytime | Solar-optimized |
|------|---------------|-----------------|-------|---------------|----------------|
| 0 | 0 | 0.125 | 0.075 | 0 | 0.025 |
| 1 | 0 | 0.125 | 0.075 | 0 | 0.025 |
| 2 | 0 | 0.125 | 0.075 | 0 | 0.025 |
| 3 | 0 | 0.125 | 0.075 | 0 | 0.025 |
| 4 | 0 | 0.125 | 0.075 | 0 | 0.025 |
| 5 | 0 | 0.125 | 0.075 | 0 | 0.025 |
| 6–9 | 0–0.05 | 0 | 0 | 0 | 0–0.04 |
| 10–15 | 0.09–0.17 | 0 | 0.067 | 0.167 | 0.072–0.136 |
| 16–17 | 0.11–0 | 0 | 0 | 0 | 0.088–0 |
| 18–21 | 0 | 0 | 0 | 0 | 0 |
| 22 | 0 | 0.125 | 0.075 | 0 | 0.025 |
| 23 | 0 | 0.125 | 0.075 | 0 | 0.025 |

- 每种充电模式的合计 = 1.0

---

## 5. DE_Lookups — 查找表

所有参数集中存放在此表，供 DE_Simulator 和 DE_Calc_Compare 通过 `INDEX/MATCH` 查询。

### 5.1 占用模式查找（A–B 列）

| 选项 | Daytime Mult |
|------|-------------|
| Mostly away during the day | 0.6 |
| Working from home | 1.4 |
| Someone always at home | 1.2 |

### 5.2 使用强度查找（D–I 列）

| Usage | Annual Mult | Cool Month Mult | Heat Month Mult | Cool Peak Mult | Heat Peak Mult |
|-------|------------|----------------|----------------|---------------|---------------|
| Low | 0.7 | 1.05 | 1.08 | 1.10 | 1.08 |
| Medium | 1.0 | 1.10 | 1.15 | 1.20 | 1.15 |
| High | 1.3 | 1.20 | 1.25 | 1.35 | 1.25 |
| Very high | 1.6 | 1.35 | 1.40 | 1.50 | 1.40 |

### 5.3 供暖/制冷系统查找（K–L 列）

| System | Base Thermal Load (kWh) |
|--------|------------------------|
| No heating or cooling system | 0 |
| Air conditioning | 0 |
| Electric heating | 3,000 |
| Heat pump (heating & cooling) | 2,000 |

### 5.4 EV 里程查找（N–O 列）

| 选项 | 里程 (km) |
|------|----------|
| No electric vehicle | 0 |
| 5,000 km | 5,000 |
| 10,000 km | 10,000 |
| 15,000 km | 15,000 |
| 20,000 km | 20,000 |
| 25,000+ km | 25,000 |

---

## 6. DE_Simulator — 主模拟器（核心计算）

### 6.1 用户输入（B4:B9）

| 单元格 | 参数 | 默认值 |
|--------|------|--------|
| B4 | 年总用电量 (kWh) | 3500 |
| B5 | 居住占用模式 | Mostly away during the day |
| B6 | 供暖/制冷系统 | No heating or cooling system |
| B7 | 冷暖使用强度 | Medium |
| B8 | 电动车年里程 | No electric vehicle |
| B9 | EV 充电习惯 | Mostly overnight |

### 6.2 中间参数计算（G4:G11）

#### G4 — 使用强度倍率 (Usage Multiplier)
```
= INDEX(DE_Lookups!E2:E5, MATCH(B7, DE_Lookups!D2:D5, 0))
```
根据用户选择的使用强度，从查找表获取年电量倍率。例如 Medium → 1.0。

#### G5 — 热力额外年电量 (Thermal Extra Annual kWh)
```
= IF(OR(B6="Electric heating", B6="Heat pump (heating & cooling)"),
    INDEX(DE_Lookups!L2:L5, MATCH(B6, DE_Lookups!K2:K5, 0)) * G4,
    0)
```
- 仅当选择 Electric heating 或 Heat pump 时才有额外电量
- 计算：`基础热负荷 × 使用强度倍率`
- 例如：Electric heating + Medium → 3000 × 1.0 = 3000 kWh
- Air conditioning 和 No system → 0

#### G6 — EV 额外年电量 (EV Extra Annual kWh)
```
= INDEX(DE_Lookups!O2:O7, MATCH(B8, DE_Lookups!N2:N7, 0)) × 0.18
```
- 从查找表获取里程数，乘以 0.18 kWh/km
- 例如：10,000 km → 10000 × 0.18 = 1800 kWh

#### G7 — 最终年电量 (Final Annual kWh)
```
= B4 + G5 + G6
```
- `基础年电量 + 热力额外 + EV 额外`

#### G8 — 冷季月乘数 (Cooling Month Multiplier)
```
= INDEX(DE_Lookups!F2:F5, MATCH(B7, DE_Lookups!D2:D5, 0))
```

#### G9 — 暖季月乘数 (Heating Month Multiplier)
```
= INDEX(DE_Lookups!G2:G5, MATCH(B7, DE_Lookups!D2:D5, 0))
```

#### G10 — 冷峰时段乘数 (Cooling Peak Multiplier)
```
= INDEX(DE_Lookups!H2:H5, MATCH(B7, DE_Lookups!D2:D5, 0))
```

#### G11 — 暖峰时段乘数 (Heating Peak Multiplier)
```
= INDEX(DE_Lookups!I2:I5, MATCH(B7, DE_Lookups!D2:D5, 0))
```

### 6.3 月度计算（A14:K25，共 12 行 = 12 个月）

以第 1 行（1月，Row 14）为例：

#### B14 — 基准月占比
```
= DE_Base_Profile!B6    → 0.0789
```

#### C14 — 基准月电量
```
= B4 × B14    → 3500 × 0.0789 = 276.15 kWh
```

#### D14 — 季节乘数 (Seasonal Multiplier)
```
= 1
  + IF(系统含空调或热泵, IF(该月是冷季, G8-1, 0), 0)
  + IF(系统含电采暖或热泵, IF(该月是暖季, G9-1, 0), 0)
```
完整公式：
```
= 1
  + IF(OR(B6="Air conditioning", B6="Heat pump"), IF(CoolingFlag=1, CoolMonthMult-1, 0), 0)
  + IF(OR(B6="Electric heating", B6="Heat pump"), IF(HeatingFlag=1, HeatMonthMult-1, 0), 0)
```
- 1月是暖季（HeatingFlag=1），不是冷季（CoolingFlag=0）
- 若选 Heat pump + Medium：D14 = 1 + 0 + (1.15 - 1) = 1.15
- 若选 No system：D14 = 1（无修正）

#### E14 — 重塑后基准电量 (Reshaped Base kWh)
```
= C14 × D14
```
- 基准月电量 × 季节乘数

#### F14 — 热力权重 (Thermal Weight)
```
= IF(B6="Electric heating",
    IF(HeatingFlag=1, B14 × G9, 0),
    IF(B6="Heat pump",
      IF(CoolingFlag=1, B14 × G8, 0) + IF(HeatingFlag=1, B14 × G9, 0),
      0))
```
- 用于将热力额外电量按季节性权重分配到各月
- Electric heating：仅暖季月份有权重
- Heat pump：冷暖季月份都有权重
- 其他系统：权重为 0

#### G14 — 热力额外电量分配 (Thermal Extra kWh per month)
```
= IF(SUM(F14:F25)=0, 0, G5 × F14 / SUM(F14:F25))
```
- 将总热力额外电量 (G5) 按各月权重比例分配
- 若无热力系统，所有权重为 0，结果为 0

#### H14 — EV 额外电量分配 (EV Extra kWh per month)
```
= G6 / 12
```
- EV 额外电量平均分摊到 12 个月

#### I14 — 最终月电量 (Final Monthly kWh)
```
= E14 / SUM(E14:E25) × B4 + G14 + H14
```
**关键逻辑**：
1. 先将重塑后的基准电量归一化回基础年电量：`E14/SUM(E) × 3500`
2. 再加上热力额外分配和 EV 额外分配
3. 这确保了基础电量的月度分布被季节性修正改变，但总量仍为 B4

#### J14 — 最终月占比 (Final Monthly Share)
```
= I14 / G7
```
- 最终月电量 / 最终年电量

#### K14 — 占比变化 (Δ vs Base Share)
```
= J14 - B14
```
- 最终占比与基准占比的差值

### 6.4 24 小时计算（M14:X37，共 24 行 = 24 小时）

以 Hour 0（Row 14）为例：

#### N14 — 基准小时占比
```
= DE_Base_Profile!I6    → 0.0301
```

#### O14 — 占用模式乘数 (Occupancy Multiplier)
```
= IF(DaytimeFlag=1,
    INDEX(DE_Lookups!B2:B4, MATCH(B5, DE_Lookups!A2:A4, 0)),
    1)
```
- Hour 0 的 DaytimeFlag = 0，所以 O14 = 1
- Hour 10 的 DaytimeFlag = 1，若选 "Mostly away" → O = 0.6

#### P14 — 峰时段乘数 (Peak Multiplier)
```
= IF(系统含空调或热泵, IF(CoolingPeakFlag=1, G10, 1), 1)
  × IF(系统含电采暖或热泵, IF(HeatingPeakFlag=1, G11, 1), 1)
```
- 冷峰和暖峰乘数相乘（可叠加）
- Hour 0 无任何峰标志 → P14 = 1 × 1 = 1

#### Q14 — 调整后非 EV 占比 (Adjusted Non-EV Share)
```
= N14 × O14 × P14
```
- 基准占比 × 占用乘数 × 峰乘数

#### R14 — 归一化非 EV 占比 (Normalized Non-EV Share)
```
= Q14 / SUM(Q14:Q37)
```
- 对 24 小时重新归一化，确保总和 = 1.0

#### S14 — 非 EV 日均电量 (Non-EV kWh/day)
```
= ((B4 + G5) / 365) × R14
```
- (基础年电量 + 热力额外) / 365 天 × 该小时归一化占比

#### T14 — EV 充电占比 (EV Charging Share)
```
= INDEX(DE_Base_Profile!N6:Q29, ROW()-13, MATCH(B9, DE_Base_Profile!N5:Q5, 0))
```
- 根据用户选择的充电模式，从 Base Profile 的 EV 充电分布表中查找

#### U14 — EV 日均电量 (EV kWh/day)
```
= (G6 / 365) × T14
```
- EV 年电量 / 365 × 该小时的 EV 充电占比

#### V14 — 最终日均电量 (Final kWh/day)
```
= S14 + U14
```
- 非 EV 部分 + EV 部分

#### W14 — 最终小时占比 (Final Hourly Share)
```
= IF(G7=0, 0, V14 / (G7/365))
```
- 最终日均电量 / 日均总电量

#### X14 — 占比变化 (Δ vs Base Share)
```
= W14 - N14
```

---

## 7. DE_Calc_Compare — 批量场景计算引擎

此表是 DE_Option_Monthly 和 DE_Option_Hourly 的计算后端。每个场景占用约 45 行，结构如下：

### 7.1 场景参数区（每场景第 1–2 行）

```
Row 1: Occupancy | System | Usage | EV mileage | EV charging | BaseAnnual
Row 2: UsageMult | ThermalExtra | EVExtra | AnnualTotal | CoolMonth | HeatMonth | CoolPeak | HeatPeak
```

参数计算公式与 DE_Simulator 完全一致：
- `UsageMult = INDEX(DE_Lookups!E, MATCH(Usage, DE_Lookups!D, 0))`
- `ThermalExtra = IF(系统需要, BaseThermalLoad × UsageMult, 0)`
- `EVExtra = Mileage × 0.18`
- `AnnualTotal = BaseAnnual + ThermalExtra + EVExtra`

### 7.2 月度计算区（每场景第 4–15 行，共 12 行）

每行对应一个月，列结构：

| 列 | 内容 | 公式 |
|----|------|------|
| A | 月份名 | 引用 DE_Base_Profile |
| B | Base Share | 引用 DE_Base_Profile |
| C | Base kWh | `BaseAnnual × BaseShare` |
| D | Seasonal Mult | 与 DE_Simulator 相同的季节乘数逻辑 |
| E | Reshaped kWh | `C × D` |
| F | Thermal Weight | 与 DE_Simulator 相同的热力权重逻辑 |
| G | Thermal Extra | `ThermalExtra × F / SUM(F)` |
| H | EV Extra | `EVExtra / 12` |
| I | Final kWh | `E/SUM(E) × BaseAnnual + G + H` |
| J | Final Share | `I / AnnualTotal` |

### 7.3 24 小时计算区（每场景第 18–41 行，共 24 行）

| 列 | 内容 | 公式 |
|----|------|------|
| A | 小时 | 引用 DE_Base_Profile |
| B | Base 24h Share | 引用 DE_Base_Profile |
| C | Occupancy Mult | 白天标志 → 查找占用系数 |
| D | Peak Mult | 冷峰/暖峰标志 → 查找峰乘数 |
| E | Adjusted Share | `B × C × D` |
| F | Normalized Share | `E / SUM(E)` |
| G | Non-EV kWh/day | `(BaseAnnual + ThermalExtra) / 365 × F` |
| H | EV Charging Share | 从 Base Profile 查找充电模式分布 |
| I | EV kWh/day | `EVExtra / 365 × H` |
| J | Final Share | `(G + I) / (AnnualTotal / 365)` |

---

## 8. DE_Option_Monthly / DE_Option_Hourly — 场景对比输出

### 8.1 DE_Option_Monthly

- 每行代表一个预设场景（如 "Mostly away + No HVAC + No EV"）
- 列 C–G：场景参数定义
- 列 H：年总电量（引用 DE_Calc_Compare 的 AnnualTotal）
- 列 I–T：12 个月的 Final Share（引用 DE_Calc_Compare 的 J 列）
- 列 U–AF：12 个月的 Final kWh（引用 DE_Calc_Compare 的 I 列）

### 8.2 DE_Option_Hourly

- 结构与 Monthly 类似，但输出 24 小时的 Final Share
- 列 I–AF：Hour 0 到 Hour 23 的最终占比（引用 DE_Calc_Compare 的 24h 计算区 J 列）

---

## 9. 辅助参考表

### 9.1 基于2025最新数据结果

- 存放 2025 版 BDEW H0 家庭负载数据
- 月占比（B 列）和 24 小时占比（E 列）的原始数据
- 这些数据被 DE_Base_Profile 引用作为基准

### 9.2 最终提炼主干因素

- 产品化设计文档，定义了每个干预因子的：
  - UI 标签（中英文）
  - 选项列表
  - 默认选项
  - 显示规则（如"冷暖使用强度"仅在选择了供暖/制冷系统时显示）
  - Annual kWh / Monthly Share / 24h Shape 的干预逻辑详细描述

### 9.3 Cooling-Heating-Month

- 全球各国/地区的冷暖季节月份定义
- 包含：澳大利亚各州、德国、荷兰、比利时、卢森堡、波兰、罗马尼亚、法国、菲律宾、美国各区域、日本、韩国、英国、意大利、西班牙等
- 用于将模拟器扩展到其他国家时的季节参数配置

---

## 10. 完整计算流程总结

```
用户输入 5 个参数
    │
    ├─→ ① 计算最终年电量
    │     Final_Annual = Base_Annual + Thermal_Extra + EV_Extra
    │     其中：
    │       Thermal_Extra = BaseThermalLoad[system] × UsageMult[level]
    │       EV_Extra = Mileage[selection] × 0.18
    │
    ├─→ ② 计算月度分布（12 个月）
    │     对每个月 m：
    │       a. SeasonalMult[m] = 1 + (冷季修正) + (暖季修正)
    │       b. ReshapedBase[m] = BaseKWh[m] × SeasonalMult[m]
    │       c. 归一化：NormBase[m] = ReshapedBase[m] / SUM(ReshapedBase) × Base_Annual
    │       d. ThermalAlloc[m] = Thermal_Extra × ThermalWeight[m] / SUM(ThermalWeight)
    │       e. EVAlloc[m] = EV_Extra / 12
    │       f. FinalKWh[m] = NormBase[m] + ThermalAlloc[m] + EVAlloc[m]
    │       g. FinalShare[m] = FinalKWh[m] / Final_Annual
    │
    └─→ ③ 计算 24h 分布（24 小时）
          对每个小时 h：
            a. OccMult[h] = IF(白天时段, DaytimeFactor[occupancy], 1)
            b. PeakMult[h] = CoolPeakMult × HeatPeakMult（按标志位）
            c. AdjShare[h] = BaseShare[h] × OccMult[h] × PeakMult[h]
            d. NormShare[h] = AdjShare[h] / SUM(AdjShare)
            e. NonEV_kWh[h] = (Base_Annual + Thermal_Extra) / 365 × NormShare[h]
            f. EV_kWh[h] = EV_Extra / 365 × EVChargingDist[h][pattern]
            g. FinalKWh[h] = NonEV_kWh[h] + EV_kWh[h]
            h. FinalShare[h] = FinalKWh[h] / (Final_Annual / 365)
```

---

## 11. 关键设计特点

1. **三层分离架构**：年电量、月度占比、24h 占比独立计算，互不干扰后再合成
2. **归一化保证一致性**：每次乘以修正系数后都重新归一化，确保占比总和 = 100%
3. **叠加式设计**：基础负荷 + 热力负荷 + EV 负荷分别计算后叠加
4. **查找表驱动**：所有参数集中在 DE_Lookups，便于维护和扩展到其他国家
5. **不展开 8,760 小时**：用"平均日"代替全年逐时数据，大幅降低复杂度
