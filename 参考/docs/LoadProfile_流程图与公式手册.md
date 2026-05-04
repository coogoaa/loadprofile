# LoadProfile 计算流程图与公式手册

> 本文档是《LoadProfile 计算过程完整示例手册》的配套文档。
> 每一章对应示例手册的同一章节，补充该章的计算流程图和标准化公式。

---

## 第一章 冷暖季参数转化流程

### 1.1 流程图

```
┌──────────────────────────┐
│  输入：国家 + 州/地区      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  查表：XX_cooling_heating │
│  _season.csv              │
│                           │
│  读取：                    │
│  · cooling_season_months  │
│  · heating_season_months  │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  转化为 0/1 标志位数组     │
│                           │
│  CoolFlag[m] =            │
│    1 if m ∈ cooling_months│
│    0 otherwise            │
│                           │
│  HeatFlag[m] =            │
│    1 if m ∈ heating_months│
│    0 otherwise            │
│                           │
│  m = 1月, 2月, ..., 12月  │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  输出：                    │
│  CoolFlag[12] 冷季标志数组│
│  HeatFlag[12] 暖季标志数组│
│                           │
│  供 Step 2 季节乘数使用    │
└──────────────────────────┘
```

### 1.2 公式

```
CoolFlag[m] = 1   当 m ∈ {cooling_season_months}
              0   其他

HeatFlag[m] = 1   当 m ∈ {heating_season_months}
              0   其他
```

> 同理，24h 的峰时段标志位：

```
DaytimeFlag[h]    = 1   当 h ∈ 白天时段（AU: [07..16] 即 07:00-17:00；DE: [09..16] 即 09:00-17:00）
CoolPeakFlag[h]   = 1   当 h ∈ [14, 15, 16, 17, 18]
HeatPeakFlag[h]   = 1   当 h ∈ [06, 07, 08, 18, 19, 20, 21]
```

---

## 第二章 月度计算流程

### 2.1 总流程图

```
用户输入 5 大因子 + 国家参数包
│
├─ Step 1 ─────────────────────────────────────────────────────────┐
│  计算最终年电量                                                    │
│                                                                    │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐           │
│  │ 基础年电量    │ + │ 热力额外电量  │ + │ EV 额外电量   │ = 最终年电量│
│  │ Base_Annual  │   │ Thermal_Extra│   │ EV_Extra     │           │
│  └─────────────┘   └──────────────┘   └──────────────┘           │
│                                                                    │
│  Thermal_Extra = BaseThermalLoad[system] × UsageMult[level]       │
│  EV_Extra      = Mileage × 0.18                                   │
│  Final_Annual  = Base_Annual + Thermal_Extra + EV_Extra            │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 2 ─────────────────────────────────────────────────────────┐
│  计算季节乘数 SeasonalMult[m]                                      │
│                                                                    │
│  对每个月 m：                                                       │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │ SeasonalMult[m] = 1                                      │      │
│  │   + IF(系统参与冷季 AND CoolFlag[m]=1, CoolMonthMult-1, 0)│      │
│  │   + IF(系统参与暖季 AND HeatFlag[m]=1, HeatMonthMult-1, 0)│      │
│  └─────────────────────────────────────────────────────────┘      │
│                                                                    │
│  "系统参与冷季" = system ∈ {AC, Heat pump}                         │
│  "系统参与暖季" = system ∈ {Electric heating, Heat pump}           │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 3 ─────────────────────────────────────────────────────────┐
│  重塑基准电量                                                      │
│                                                                    │
│  ReshapedBase[m] = Base_Annual × BaseMonthlyShare[m]              │
│                    × SeasonalMult[m]                               │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 4 ─────────────────────────────────────────────────────────┐
│  归一化回基础年电量                                                 │
│                                                                    │
│  NormBase[m] = ReshapedBase[m]                                     │
│                ─────────────────── × Base_Annual                   │
│                SUM(ReshapedBase)                                    │
│                                                                    │
│  保证：SUM(NormBase) = Base_Annual                                 │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 5 ─────────────────────────────────────────────────────────┐
│  热力额外电量按季节权重分配                                         │
│                                                                    │
│  ThermalWeight[m] =                                                │
│    IF(system=Electric heating):                                    │
│      IF(HeatFlag[m]=1): BaseShare[m] × HeatMonthMult              │
│      ELSE: 0                                                       │
│    IF(system=Heat pump):                                           │
│      IF(CoolFlag[m]=1): BaseShare[m] × CoolMonthMult              │
│      + IF(HeatFlag[m]=1): BaseShare[m] × HeatMonthMult            │
│    ELSE: 0                                                         │
│                                                                    │
│  ThermalAlloc[m] = Thermal_Extra × ThermalWeight[m]               │
│                    ─────────────────────────────────               │
│                    SUM(ThermalWeight)                               │
│                                                                    │
│  保证：SUM(ThermalAlloc) = Thermal_Extra                           │
│  若 SUM(ThermalWeight)=0 则 ThermalAlloc[m]=0                     │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 6 ─────────────────────────────────────────────────────────┐
│  EV 额外电量均分                                                   │
│                                                                    │
│  EVAlloc[m] = EV_Extra / 12                                        │
└───────────────────────────────────────────────────────────────────┘
│
└─ Step 7 ─────────────────────────────────────────────────────────┐
   合成最终月电量                                                     │
                                                                     │
   FinalKWh[m]   = NormBase[m] + ThermalAlloc[m] + EVAlloc[m]       │
   FinalShare[m] = FinalKWh[m] / Final_Annual                       │
                                                                     │
   保证：SUM(FinalKWh) = Final_Annual                                │
   保证：SUM(FinalShare) = 1.0                                       │
─────────────────────────────────────────────────────────────────────┘
```

### 2.2 公式汇总

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1  年电量
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Thermal_Extra = BaseThermalLoad[system] × UsageMult[level]

    其中 BaseThermalLoad:
      No system        = 0
      Air conditioning = 0
      Electric heating = AU: 2500 / DE: 3000
      Heat pump        = AU: 1800 / DE: 2000

    其中 UsageMult:
      Low       = 0.7
      Medium    = 1.0
      High      = 1.3
      Very high = 1.6

  EV_Extra = Mileage × 0.18

  Final_Annual = Base_Annual + Thermal_Extra + EV_Extra

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2  季节乘数
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CoolAdj[m] = IF(系统参与冷季 AND CoolFlag[m]=1,
                  CoolMonthMult - 1,
                  0)

  HeatAdj[m] = IF(系统参与暖季 AND HeatFlag[m]=1,
                  HeatMonthMult - 1,
                  0)

  SeasonalMult[m] = 1 + CoolAdj[m] + HeatAdj[m]

    系统参与冷季: system ∈ {AC, Heat pump}
    系统参与暖季: system ∈ {Electric heating, Heat pump}

    CoolMonthMult / HeatMonthMult 按 usage_level 查表:
      Low:       1.05 / 1.08
      Medium:    1.10 / 1.15
      High:      1.20 / 1.25
      Very high: 1.35 / 1.40

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3  重塑基准
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ReshapedBase[m] = Base_Annual × BaseMonthlyShare[m] × SeasonalMult[m]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 4  归一化
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    ReshapedBase[m]
  NormBase[m] = ─────────────────── × Base_Annual
                 Σ ReshapedBase[i]
                i=1..12

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5  热力额外分配
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ThermalWeight[m]:
    Electric heating:
      HeatFlag[m]=1 → BaseShare[m] × HeatMonthMult
      否则 → 0
    Heat pump:
      CoolFlag[m]=1 → BaseShare[m] × CoolMonthMult
      + HeatFlag[m]=1 → BaseShare[m] × HeatMonthMult
    AC / No system:
      → 0

                         ThermalWeight[m]
  ThermalAlloc[m] = ─────────────────────── × Thermal_Extra
                     Σ ThermalWeight[i]
                    i=1..12

  特殊情况：若 Σ ThermalWeight = 0，则 ThermalAlloc[m] = 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 6  EV 均分
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  EVAlloc[m] = EV_Extra / 12

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 7  合成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  FinalKWh[m]   = NormBase[m] + ThermalAlloc[m] + EVAlloc[m]

                   FinalKWh[m]
  FinalShare[m] = ─────────────
                   Final_Annual
```


---

## 第三章 24 小时计算流程

### 3.1 总流程图

```
LoadProfile 输出的年电量 + 热力额外 + EV额外
│
├─ Step 1 ─────────────────────────────────────────────────────────┐
│  占用模式修正                                                      │
│                                                                    │
│  对每个小时 h：                                                     │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │ OccMult[h] = IF(DaytimeFlag[h]=1,                       │      │
│  │                 DaytimeFactor[occupancy],                 │      │
│  │                 1.0)                                      │      │
│  └─────────────────────────────────────────────────────────┘      │
│                                                                    │
│  DaytimeFactor:                                                    │
│    Mostly away        = 0.6                                        │
│    Working from home  = 1.4                                        │
│    Always at home     = 1.2                                        │
│                                                                    │
│  DaytimeHours 按国家定义：                                          │
│    AU: H07-H16 (07:00-17:00)                                      │
│    DE: H09-H16 (09:00-17:00)                                      │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 2 ─────────────────────────────────────────────────────────┐
│  峰时段修正                                                        │
│                                                                    │
│  对每个小时 h：                                                     │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │ CoolPeak[h] = IF(系统参与冷峰 AND CoolPeakFlag[h]=1,    │      │
│  │                  CoolPeakMult[level],                     │      │
│  │                  1.0)                                     │      │
│  │                                                           │      │
│  │ HeatPeak[h] = IF(系统参与暖峰 AND HeatPeakFlag[h]=1,    │      │
│  │                  HeatPeakMult[level],                     │      │
│  │                  1.0)                                     │      │
│  │                                                           │      │
│  │ PeakMult[h] = CoolPeak[h] × HeatPeak[h]                 │      │
│  └─────────────────────────────────────────────────────────┘      │
│                                                                    │
│  系统参与冷峰: system ∈ {AC, Heat pump}                            │
│  系统参与暖峰: system ∈ {Electric heating, Heat pump}              │
│                                                                    │
│  CoolPeakMult / HeatPeakMult 按 usage_level 查表:                 │
│    Low:       1.10 / 1.08                                          │
│    Medium:    1.20 / 1.15                                          │
│    High:      1.35 / 1.25                                          │
│    Very high: 1.50 / 1.40                                          │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 3 ─────────────────────────────────────────────────────────┐
│  调整 & 归一化                                                     │
│                                                                    │
│  AdjShare[h]  = BaseHourlyShare[h] × OccMult[h] × PeakMult[h]    │
│                                                                    │
│                   AdjShare[h]                                      │
│  NormShare[h] = ───────────────                                    │
│                  Σ AdjShare[i]                                     │
│                 i=0..23                                             │
│                                                                    │
│  保证：Σ NormShare = 1.0                                           │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 4 ─────────────────────────────────────────────────────────┐
│  计算非 EV 日均电量                                                 │
│                                                                    │
│  NonEV_Annual = Base_Annual + Thermal_Extra                        │
│  NonEV_Daily  = NonEV_Annual / 365                                 │
│                                                                    │
│  NonEV_kWh[h] = NonEV_Daily × NormShare[h]                        │
└───────────────────────────────────────────────────────────────────┘
│
├─ Step 5 ─────────────────────────────────────────────────────────┐
│  叠加 EV 充电                                                      │
│                                                                    │
│  EV_Daily = EV_Extra / 365                                         │
│                                                                    │
│  EV_kWh[h] = EV_Daily × EVChargingDist[h][pattern]                │
│                                                                    │
│  EVChargingDist 按充电模式查表:                                     │
│    Mostly overnight:   H00-H05 各 0.125, H22-H23 各 0.125         │
│    Mixed:              白天+夜间混合分布                             │
│    Mostly daytime:     H10-H15 各 0.167                            │
│    Solar-optimized:    80% 按 PV proxy, 20% 回落夜间               │
└───────────────────────────────────────────────────────────────────┘
│
└─ Step 6 ─────────────────────────────────────────────────────────┐
   合成 & 派生指标                                                    │
                                                                     │
   FinalKWhPerDay[h] = NonEV_kWh[h] + EV_kWh[h]                     │
                                                                     │
                        FinalKWhPerDay[h]                             │
   FinalHourlyShare[h] = ─────────────────                            │
                          Final_Annual / 365                          │
                                                                     │
   ── 派生指标 ──                                                     │
   日均用电     = Final_Annual / 365                                  │
   白天用电     = 日均 × Σ FinalHourlyShare[h=7..16]  (07:00-17:00) │
   晚高峰用电   = 日均 × Σ FinalHourlyShare[h=17..20] (17:00-21:00)│
   整夜用电     = 日均 × Σ FinalHourlyShare[h=17..23, h=0..6]       │
   │              (17:00-07:00)                                       │
─────────────────────────────────────────────────────────────────────┘
```

> **⚠️ 关于 `Final_Annual / 365` 的简化说明**
>
> 此处 `Final_Annual / 365` 为**全年平均日**的简化估算，**未按月展开为 12 个标准日**。具体含义：
> - 24h 小时占比 `FinalHourlyShare[h]` 对应"一个平均日"的形状，非任何具体月份
> - 冷峰、暖峰乘数为**无条件叠加**（不区分当前月份是否为冷/暖季），属刻意近似
>
> **已知误差范围**：
> - 单月日均与全年日均可能相差 ±10%~±30%（冷暖季月份偏高、过渡月偏低）
> - 峰值小时占比被轻微高估 2~5 个百分点
>
> **设计依据**：本模型源自原始 Excel 简化模型（`副本_简化版Germany_Load_Profile_Simulator.xlsx`），其设计目标明示为 _"keep Annual kWh + Monthly share + 24h share. No 8,760 hourly expansion"_、_"average-day shape, not a dispatch model"_。下游方案推荐（电池容量、光伏选型）使用"典型日"粒度已足够，误差对推荐结果的影响 < 电池档位精度。
>
> **如需按月标准日估算（月度账单对账场景）**，需升级为 12 × 24 矩阵模型：每月各自构建 24h 形状（冷/暖峰乘数按月份条件性启用），以 `FinalKWh[m] / DaysInMonth[m]` 作该月日均，按各月实际天数加权聚合回年指标。

### 3.2 公式汇总

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 1  占用模式修正
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  OccMult[h] = DaytimeFactor[occupancy]   当 h ∈ DaytimeHours（AU: [07..16]；DE: [09..16]）
               1.0                         其他

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 2  峰时段修正
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CoolPeak[h] = CoolPeakMult[level]   当 系统参与冷峰 AND h ∈ [14..18]
                1.0                     其他

  HeatPeak[h] = HeatPeakMult[level]   当 系统参与暖峰 AND h ∈ [06..08, 18..21]
                1.0                     其他

  PeakMult[h] = CoolPeak[h] × HeatPeak[h]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 3  调整 & 归一化
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  AdjShare[h]  = BaseHourlyShare[h] × OccMult[h] × PeakMult[h]

                    AdjShare[h]
  NormShare[h] = ─────────────────
                  Σ AdjShare[i]
                 i=0..23

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 4  非 EV 日均电量
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  NonEV_kWh[h] = (Base_Annual + Thermal_Extra) / 365 × NormShare[h]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 5  EV 充电叠加
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  EV_kWh[h] = (EV_Extra / 365) × EVChargingDist[h][pattern]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Step 6  合成 & 派生
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  FinalKWhPerDay[h]   = NonEV_kWh[h] + EV_kWh[h]

                          FinalKWhPerDay[h]
  FinalHourlyShare[h] = ───────────────────
                          Final_Annual / 365

  日均用电   = Final_Annual / 365
  白天用电   = 日均 × Σ(h=7..16) FinalHourlyShare[h]     // 07:00-17:00
  晚高峰用电 = 日均 × Σ(h=17..20) FinalHourlyShare[h]   // 17:00-21:00
  整夜用电   = 日均 × Σ(h=17..23,0..6) FinalHourlyShare[h] // 17:00-07:00
```

---

## 第四章 各场景计算路径速查

### 4.1 场景决策流程图

```
用户选择供暖/制冷系统
│
├─ No system ──────────────────────────────────────────────────────┐
│  · 年电量：不变                                                    │
│  · 月度：不变（SeasonalMult 全部 = 1.0）                          │
│  · 24h：仅占用模式生效                                             │
│  · 热力额外 = 0，ThermalAlloc = 0                                 │
└──────────────────────────────────────────────────────────────────┘
│
├─ Air conditioning ───────────────────────────────────────────────┐
│  · 年电量：不变（BaseThermalLoad = 0）                             │
│  · 月度：冷季月份放大（CoolMonthMult）                             │
│  · 24h：冷峰时段放大（CoolPeakMult）                              │
│  · 热力额外 = 0，ThermalAlloc = 0                                 │
│  · 注意：AC 不增加年电量，只改变分布形状                            │
└──────────────────────────────────────────────────────────────────┘
│
├─ Electric heating ───────────────────────────────────────────────┐
│  · 年电量：增加（BaseThermalLoad × UsageMult）                     │
│  · 月度：暖季月份放大 + 热力额外按暖季权重分配                      │
│  · 24h：暖峰时段放大（HeatPeakMult）                              │
└──────────────────────────────────────────────────────────────────┘
│
└─ Heat pump ──────────────────────────────────────────────────────┐
   · 年电量：增加（BaseThermalLoad × UsageMult）                     │
   · 月度：冷季+暖季月份都放大 + 热力额外按冷暖季权重分配             │
   · 24h：冷峰+暖峰时段都放大                                       │
   · 影响最全面的系统                                                │
───────────────────────────────────────────────────────────────────┘


用户选择 EV
│
├─ No EV ──────────────────────────────────────────────────────────┐
│  · 年电量：不变                                                    │
│  · 月度：不变                                                      │
│  · 24h：不变                                                       │
└──────────────────────────────────────────────────────────────────┘
│
└─ 有 EV ──────────────────────────────────────────────────────────┐
   · 年电量：增加 Mileage × 0.18                                    │
   · 月度：EV_Extra / 12 均匀叠加（轻微拉平月度分布）               │
   · 24h：按充电模式叠加到对应时段                                   │
   │                                                                 │
   ├─ Overnight:  H00-H05, H22-H23 各 1/8                          │
   ├─ Mixed:      白天+夜间混合                                     │
   ├─ Daytime:    H10-H15 各 1/6                                    │
   └─ Solar:      80% PV proxy + 20% 夜间                          │
───────────────────────────────────────────────────────────────────┘


用户选择占用模式
│
├─ Mostly away ────── 白天 × 0.6 ── 夜间占比相对上升
├─ WFH ────────────── 白天 × 1.4 ── 白天占比上升
└─ Always home ────── 白天 × 1.2 ── 白天占比适度上升

  白天时段按国家定义：AU = H07-H16 (07:00-17:00)；DE = H09-H16 (09:00-17:00)
```

### 4.2 各场景公式路径速查表

| 场景 | 年电量公式 | 月度特殊处理 | 24h 特殊处理 |
|------|-----------|-------------|-------------|
| 1. 全默认 | Base_Annual | 无修正 | 仅 OccMult |
| 2. AC only | Base_Annual (不变) | 冷季 ×CoolMonthMult | 冷峰 ×CoolPeakMult + OccMult |
| 3. Electric heating | +ThermalLoad×UsageMult | 暖季 ×HeatMonthMult + ThermalAlloc | 暖峰 ×HeatPeakMult + OccMult |
| 4. Heat pump | +ThermalLoad×UsageMult | 冷暖季都修正 + ThermalAlloc | 冷暖峰都修正 + OccMult |
| 5. EV only | +Mileage×0.18 | +EVAlloc均分 | +EVChargingDist + OccMult |
| 6. 德国默认 | 3500 | 无修正 | 仅 OccMult |
| 7. 全拉满 | +EV_Extra (AC不加) | 冷季 ×CoolMonthMult + EVAlloc | 冷峰×1.50 + OccMult×1.4 + EV Solar |

---

## 第五章 系统类型行为判定公式

### 5.1 判定流程图

```
输入：system 类型
│
├─ 是否增加年电量？
│   system ∈ {Electric heating, Heat pump} → YES
│   system ∈ {No system, AC}               → NO
│
├─ 是否参与冷季月度修正？
│   system ∈ {AC, Heat pump}               → YES
│   system ∈ {No system, Electric heating} → NO
│
├─ 是否参与暖季月度修正？
│   system ∈ {Electric heating, Heat pump} → YES
│   system ∈ {No system, AC}               → NO
│
├─ 是否参与冷峰 24h 修正？
│   system ∈ {AC, Heat pump}               → YES
│   system ∈ {No system, Electric heating} → NO
│
└─ 是否参与暖峰 24h 修正？
    system ∈ {Electric heating, Heat pump} → YES
    system ∈ {No system, AC}               → NO
```

### 5.2 判定公式

```
HasThermalExtra(system)  = system ∈ {Electric heating, Heat pump}
ParticipatesCool(system) = system ∈ {AC, Heat pump}
ParticipatesHeat(system) = system ∈ {Electric heating, Heat pump}

// 月度
SeasonalMult[m] = 1
  + IF(ParticipatesCool(system) AND CoolFlag[m], CoolMonthMult - 1, 0)
  + IF(ParticipatesHeat(system) AND HeatFlag[m], HeatMonthMult - 1, 0)

// 24h
PeakMult[h] = IF(ParticipatesCool(system) AND CoolPeakFlag[h], CoolPeakMult, 1)
            × IF(ParticipatesHeat(system) AND HeatPeakFlag[h], HeatPeakMult, 1)
```

---

## 第六章 占用模式归一化公式

### 6.1 流程图

```
BaseHourlyShare[24]（基准 24h 占比，合计=1.0）
│
├─ 乘以占用模式系数
│   AdjShare[h] = BaseShare[h] × OccMult[h]
│   （白天时段被放大或压缩，其他不变）
│
├─ 此时 Σ AdjShare ≠ 1.0
│   · Mostly away:  Σ < 1.0（白天被压缩）
│   · WFH:          Σ > 1.0（白天被放大）
│   · Always home:  Σ > 1.0（白天被放大）
│
└─ 归一化
    NormShare[h] = AdjShare[h] / Σ AdjShare
    保证 Σ NormShare = 1.0
```

### 6.2 归一化效应公式

```
设 D = Σ(h∈daytime) BaseShare[h]     // 白天基准占比之和（AU: H07-H16；DE: H09-H16）
设 N = Σ(h∉daytime) BaseShare[h]     // 非白天基准占比之和
设 f = DaytimeFactor                   // 占用模式系数

归一化分母 = D × f + N × 1.0 = D × f + N

白天归一化后占比 = D × f / (D × f + N)
非白天归一化后占比 = N / (D × f + N)

当 f < 1（Mostly away）：白天占比 ↓，非白天占比 ↑
当 f > 1（WFH / Always home）：白天占比 ↑，非白天占比 ↓
```

---

## 第七章 参数文件加载流程

### 7.1 流程图

```
输入：country + region
│
├─ Step 1：加载基准曲线
│   ├─ XX_base_annual_kwh.csv     → Base_Annual
│   ├─ XX_monthly_share.csv       → BaseMonthlyShare[12]
│   └─ XX_hourly_share.csv        → BaseHourlyShare[24]
│
├─ Step 2：加载季节定义
│   ├─ XX_cooling_heating_season.csv → CoolFlag[12], HeatFlag[12]
│   └─ 固定定义                       → DaytimeFlag[24], CoolPeakFlag[24], HeatPeakFlag[24]
│
├─ Step 3：加载干预因子系数
│   ├─ XX_hvac_thermal_load.csv        → BaseThermalLoad[system]
│   ├─ XX_usage_level_coefficients.csv → UsageMult, CoolMonthMult, HeatMonthMult,
│   │                                     CoolPeakMult, HeatPeakMult
│   ├─ GLOBAL_occupancy_factors.csv    → DaytimeFactor[occupancy]
│   └─ GLOBAL_ev_params.csv            → EV_Efficiency, MileageOptions
│
├─ Step 4：加载 EV 充电分布
│   └─ XX_ev_charging_profiles.csv → EVChargingDist[24][pattern]
│
└─ Step 5：加载税务/方案规则（如适用）
    ├─ XX_tax_subsidy_rules.csv
    └─ 方案参数（澳洲 A/B/C）
```

### 7.2 新增国家检查清单

```
□ 基准年电量          XX_base_annual_kwh.csv
□ 月度基准占比        XX_monthly_share.csv
□ 24h 基准占比        XX_hourly_share.csv
□ 冷暖季定义          XX_cooling_heating_season.csv
□ 系统热负荷          XX_hvac_thermal_load.csv        （可复用）
□ 使用强度系数        XX_usage_level_coefficients.csv  （可复用）
□ EV 充电分布         XX_ev_charging_profiles.csv      （可复用）
□ 税务规则            XX_tax_rules.csv
□ 占用模式系数        GLOBAL_occupancy_factors.csv     （已有，通用）
□ EV 参数             GLOBAL_ev_params.csv             （已有，通用）
```
