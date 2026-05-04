# LoadProfile 计算规则

> 本章定义 LoadProfile 模块的完整计算逻辑，适用于澳洲（AU）和德国（DE）。
> 计算引擎统一，通过国家参数包实现差异化。

---

## 1. 整体流程

```
用户输入：地址 + 5 大干预因子
         │
         ▼
  ┌──────────────────────────────────────────────────────┐
  │                  LoadProfile 计算引擎                  │
  │                                                        │
  │  Step 1  确定最终年电量                                │
  │          基础年电量 + 热力额外 + EV 额外               │
  │                  │                                     │
  │  Step 2  月度分布（12 个月）                           │
  │          2a 季节乘数修正基准电量                        │
  │          2b 热力额外按冷暖季权重分配到各月              │
  │          2c EV 额外均分到各月                          │
  │          2d 合成 → FinalKWh[m] / FinalShare[m]        │
  │                  │                                     │
  │  Step 3  24h 分布（24 小时）                           │
  │          3a 占用模式修正                               │
  │          3b 峰时段修正                                 │
  │          3c 归一化                                     │
  │          3d 叠加 EV 充电分布                           │
  │          3e 合成 → FinalHourlyShare[h]                 │
  │                  │                                     │
  │  Step 4  派生三大用电需求（从 Step 3 结果计算）         │
  │          白天用电 / 晚高峰用电 / 整夜用电               │
  └──────────────────────────────────────────────────────┘
         │
         ▼
  方案 A/B/C 计算（公式不变，输入数据来自 Step 4）
```

---

## 2. 前置：标志位定义

计算开始前，根据国家参数包生成以下标志位数组，供后续各步骤使用。

### 2.1 月度标志位

```
CoolFlag[m] = 1   当 m ∈ 冷季月份（制冷季）
              0   其他

HeatFlag[m] = 1   当 m ∈ 暖季月份（供暖季）
              0   其他
```

各国冷暖季定义：

| 国家/州 | 冷季（制冷） | 暖季（供暖） |
|---------|------------|------------|
| AU NSW/VIC/SA/WA | Dec–Mar | Jun–Aug |
| AU QLD | Oct–Apr | Jun–Jul |
| AU NT | Sep–Apr | — |
| AU TAS | Jan–Feb | May–Sep |
| AU ACT | Dec–Feb | May–Sep |
| DE | Jun–Aug | Oct–Apr |

### 2.2 小时标志位

```
DaytimeFlag[h]  = 1   AU: h ∈ [07..16]（07:00–17:00）
                       DE: h ∈ [09..16]（09:00–17:00）

CoolPeakFlag[h] = 1   h ∈ [14..18]（14:00–19:00）

HeatPeakFlag[h] = 1   h ∈ [06..08, 18..21]（06:00–09:00 & 18:00–22:00）
```

---

## 3. Step 1：确定最终年电量

```
Thermal_Extra = BaseThermalLoad[system] × UsageMult[level]

EV_Extra = Mileage × 0.18

Final_Annual = Base_Annual + Thermal_Extra + EV_Extra
```

**参数表：**

| 系统 | BaseThermalLoad (AU) | BaseThermalLoad (DE) | 增加年电量? |
|------|---------------------|---------------------|-----------|
| No system | 0 | 0 | ❌ |
| Air conditioning | 0 | 0 | ❌ |
| Electric heating | 2,500 kWh | 3,000 kWh | ✅ |
| Heat pump | 1,800 kWh | 2,000 kWh | ✅ |

| 使用强度 | UsageMult |
|---------|----------|
| Low | 0.7 |
| Medium | 1.0 |
| High | 1.3 |
| Very high | 1.6 |

---

## 4. Step 2：月度分布

### 4.1 季节乘数

```
SeasonalMult[m] = 1
  + IF(ParticipatesCool AND CoolFlag[m]=1,  CoolMonthMult - 1,  0)
  + IF(ParticipatesHeat AND HeatFlag[m]=1,  HeatMonthMult - 1,  0)
```

其中：
- `ParticipatesCool`：system ∈ {AC, Heat pump}
- `ParticipatesHeat`：system ∈ {Electric heating, Heat pump}

| 使用强度 | CoolMonthMult | HeatMonthMult |
|---------|--------------|--------------|
| Low | 1.05 | 1.08 |
| Medium | 1.10 | 1.15 |
| High | 1.20 | 1.25 |
| Very high | 1.35 | 1.40 |

### 4.2 重塑基准 & 归一化

```
ReshapedBase[m] = Base_Annual × BaseMonthlyShare[m] × SeasonalMult[m]

                    ReshapedBase[m]
NormBase[m]     = ─────────────────── × Base_Annual
                   Σ ReshapedBase[i]
                  i=1..12
```

> 归一化保证：Σ NormBase = Base_Annual（总量不变，分布形状改变）

### 4.3 热力额外分配

```
ThermalWeight[m]:
  Electric heating → HeatFlag[m]=1 时：BaseShare[m] × HeatMonthMult，否则 0
  Heat pump        → CoolFlag[m]=1 时：BaseShare[m] × CoolMonthMult
                   + HeatFlag[m]=1 时：BaseShare[m] × HeatMonthMult
  AC / No system   → 0

                       ThermalWeight[m]
ThermalAlloc[m] = ─────────────────────── × Thermal_Extra
                   Σ ThermalWeight[i]
                  i=1..12

特殊：若 Σ ThermalWeight = 0，则 ThermalAlloc[m] = 0
```

### 4.4 EV 额外均分

```
EVAlloc[m] = EV_Extra / 12
```

### 4.5 合成

```
FinalKWh[m]   = NormBase[m] + ThermalAlloc[m] + EVAlloc[m]

FinalShare[m] = FinalKWh[m] / Final_Annual
```

> 保证：Σ FinalKWh = Final_Annual，Σ FinalShare = 1.0

---

## 5. Step 3：24h 分布

### 5.1 占用模式修正

```
OccMult[h] = DaytimeFactor[occupancy]   当 DaytimeFlag[h] = 1
             1.0                         其他
```

| 占用模式 | DaytimeFactor | 说明 |
|---------|--------------|------|
| **不修正（默认/跳过）** | **1.0** | **直接使用基准曲线，不做任何调整** |
| Mostly away | 0.6 | 白天压缩，夜间占比相对上升 |
| Working from home | 1.4 | 白天放大，夜间占比相对下降 |
| Someone always at home | 1.2 | 白天适度放大 |

> **设计说明：** AU 基准曲线（MSATS NSLP）是真实家庭统计平均，白天占比约 41-47%，
> 本身接近"有人在家"的形态。用户跳过此题时默认不修正（OccMult=1.0），
> 直接输出基准曲线。三个选项均在基准曲线基础上做个性化调整。

### 5.2 峰时段修正

```
CoolPeak[h] = CoolPeakMult[level]   当 ParticipatesCool AND CoolPeakFlag[h]=1
              1.0                     其他

HeatPeak[h] = HeatPeakMult[level]   当 ParticipatesHeat AND HeatPeakFlag[h]=1
              1.0                     其他

PeakMult[h] = CoolPeak[h] × HeatPeak[h]
```

| 使用强度 | CoolPeakMult | HeatPeakMult |
|---------|-------------|-------------|
| Low | 1.10 | 1.08 |
| Medium | 1.20 | 1.15 |
| High | 1.35 | 1.25 |
| Very high | 1.50 | 1.40 |

### 5.3 调整 & 归一化

```
AdjShare[h]  = BaseHourlyShare[h] × OccMult[h] × PeakMult[h]

                  AdjShare[h]
NormShare[h] = ─────────────────
                Σ AdjShare[i]
               i=0..23
```

### 5.4 叠加 EV 充电

```
NonEV_kWh[h] = (Base_Annual + Thermal_Extra) / 365 × NormShare[h]

EV_kWh[h]    = (EV_Extra / 365) × EVChargingDist[h][pattern]
```

| 充电模式 | 分布 |
|---------|------|
| Mostly overnight | H00–H05 各 1/8，H22–H23 各 1/8 |
| Mixed | 60% 夜间 + 40% 白天混合 |
| Mostly daytime | H10–H15 各 1/6 |
| Solar-optimized | 80% 按 PV proxy 曲线，20% 回落夜间 |

### 5.5 合成

```
FinalKWhPerDay[h]   = NonEV_kWh[h] + EV_kWh[h]

                        FinalKWhPerDay[h]
FinalHourlyShare[h] = ───────────────────
                        Final_Annual / 365
```

---

## 6. Step 4：派生三大用电需求

```
日均用电   = Final_Annual / 365

白天用电   = 日均 × Σ FinalHourlyShare[h=7..16]      // 07:00–17:00
晚高峰用电 = 日均 × Σ FinalHourlyShare[h=17..20]     // 17:00–21:00
整夜用电   = 日均 × Σ FinalHourlyShare[h=17..23,0..6] // 17:00–07:00
```

> 这三个指标直接输入方案 A/B/C 的电池容量推荐公式，替代原有固定预设值。

> **⚠️ `Final_Annual / 365` 简化说明**
>
> 此处 `Final_Annual / 365` 为**全年平均日**的简化估算，**未按月展开为 12 个标准日**：
> - 24h 占比 `FinalHourlyShare[h]` 对应"一个平均日"的形状，非任何具体月份
> - 冷峰/暖峰乘数**全年无条件叠加**，不区分当前月份是否为冷/暖季
> - 单月日均与全年日均实际偏差约 ±10%~±30%（冷暖季偏高、过渡月偏低）
>
> **设计依据**：源自原始 Excel 简化模型（`副本_简化版Germany_Load_Profile_Simulator.xlsx`），明示设计目标为 _"average-day shape, not a dispatch model, no 8,760 hourly expansion"_。方案推荐（电池容量、光伏选型）使用"典型日"粒度已足够，误差 < 电池档位精度。
>
> **如需按月标准日估算**（月度账单对账场景），需升级为 12 × 24 矩阵模型。

---

## 7. 系统类型行为速查

| 系统 | 增加年电量 | 冷季月度修正 | 暖季月度修正 | 冷峰24h修正 | 暖峰24h修正 |
|------|----------|------------|------------|-----------|-----------|
| No system | ❌ | ❌ | ❌ | ❌ | ❌ |
| Air conditioning | ❌ | ✅ | ❌ | ✅ | ❌ |
| Electric heating | ✅ | ❌ | ✅ | ❌ | ✅ |
| Heat pump | ✅ | ✅ | ✅ | ✅ | ✅ |

> AC 最特殊：不增加年电量，只改变分布形状。
> Heat pump 影响最全面：年电量、月度、24h 全部受影响。

---

## 8. 与方案推荐的衔接

LoadProfile 计算完成后，Step 4 输出的三大用电需求直接替代 V1.5.0 中的固定预设值：

| 数据项 | V1.5.0（固定） | V2.0（LoadProfile 动态输出） |
|--------|--------------|---------------------------|
| 日均用电 | 州年均用电 / 365 | Final_Annual / 365 |
| 白天用电 | 日均 × 固定占比 | 日均 × Σ FinalHourlyShare[H07–H16] |
| 晚高峰用电 | 日均 × 固定占比 | 日均 × Σ FinalHourlyShare[H17–H20] |
| 整夜用电 | 日均 × 固定占比 | 日均 × Σ FinalHourlyShare[H17–H23,H00–H06] |

方案 A/B/C 的电池容量公式、逆变器选型、报价计算逻辑**均不变**，只是输入数据来源变了。
