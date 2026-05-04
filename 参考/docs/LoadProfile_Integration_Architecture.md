# LoadProfile 集成架构设计文档

## 1. 背景与目标

### 1.1 现状

**澳洲 (SaleAgent V1.5.0)**：
- 用电量基于各州预设固定值（年电量 + 小时占比），无个性化干预
- 已有完整的方案推荐体系（A/B/C 三套方案）：PV 选型、逆变器匹配、电池容量推荐、投资回报计算
- 用电需求直接影响：白天用电、晚高峰用电、整夜用电 → 进而影响光伏剩余和电池容量

**德国 (Load Profile Simulator)**：
- 已有成熟的 LoadProfile 模拟器：5 大干预因子 → 年电量 + 月度占比 + 24h 占比
- 尚无方案推荐体系（PV/电池/逆变器选型）

### 1.2 目标

引入统一的 LoadProfile 模块，使两国共享同一套干预因子框架，同时保留各国差异化参数：

| 维度 | 澳洲 | 德国 |
|------|------|------|
| LoadProfile 计算 | ✅ 引入，替代原有固定预设 | ✅ 已有，纳入统一框架 |
| 方案推荐 (A/B/C) | ✅ LoadProfile 输出接入现有方案流程 | ❌ 本期不做 |
| 个性化方式 | LoadProfile 因子驱动 | 后续有其他个性化方式 |

---

## 2. 统一 LoadProfile 模块架构

### 2.1 核心思路：三层分离 + 国家参数包

```
┌─────────────────────────────────────────────────────┐
│                   用户输入层                          │
│  5 大干预因子 + 国家/地区选择                         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              LoadProfile 计算引擎                     │
│                                                      │
│  输入：干预因子选项 + 国家参数包                       │
│  输出：                                               │
│    ① Final Annual kWh（最终年电量）                   │
│    ② Monthly Share[12]（月度占比数组）                 │
│    ③ Hourly Share[24]（24h 占比数组）                  │
│                                                      │
│  内部流程：                                           │
│    Base Profile → 季节修正 → 热力叠加 → EV 叠加       │
│    → 占用模式修正 → 峰时段修正 → 归一化               │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐    ┌──────────────────────────┐
│  澳洲方案推荐     │    │  德国（本期不接入方案）    │
│  A / B / C        │    │  仅输出 LoadProfile 结果  │
│                   │    │  供后续个性化使用          │
│  LoadProfile 输出  │    └──────────────────────────┘
│  → 日均用电       │
│  → 白天用电       │
│  → 晚高峰用电     │
│  → 整夜用电       │
│  → 光伏剩余       │
│  → 电池容量       │
└──────────────────┘
```

### 2.2 国家参数包 (Country Profile Pack)

每个国家/地区需要配置一套参数包，LoadProfile 引擎通过参数包实现差异化：

```
CountryProfilePack {
  // ── 基准负荷曲线 ──
  baseMonthlyShare[12]        // 月度基准占比（合计=1.0）
  baseHourlyShare[24]         // 24h 基准占比（合计=1.0）
  baseAnnualKWh               // 默认年电量（可被用户输入覆盖）

  // ── 季节定义 ──
  coolingSeasonMonths[]       // 冷季月份，如 [6,7,8]
  heatingSeasonMonths[]       // 暖季月份，如 [10,11,12,1,2,3,4]

  // ── 峰时段定义 ──
  daytimeHours[]              // 白天时段，如 [9,10,...,16]
  coolingPeakHours[]          // 冷峰时段，如 [14,15,...,18]
  heatingPeakHours[]          // 暖峰时段，如 [6,7,8,18,19,20,21]

  // ── 系数表 ──
  occupancyFactors{}          // 占用模式 → 白天乘数
  usageLevels{}               // 使用强度 → 年电量倍率/月乘数/峰乘数
  systemTypes{}               // 供暖制冷系统 → 基础热负荷
  evEfficiency                // EV 能效 kWh/km
  evChargingProfiles{}        // 充电模式 → 24h 分布

  // ── 澳洲特有：方案参数（德国可为空）──
  solutionConfig {
    planA / planB / planC     // 方案目标、电池策略等
    inverterSpecs             // 逆变器规格
    batterySpecs              // 电池规格
    costParams                // 成本参数
  }
}
```

---

## 3. 干预因子定义（两国统一）

### 3.1 因子列表

| # | 因子 | 影响维度 | 澳洲 | 德国 |
|---|------|---------|------|------|
| 1 | Daytime Occupancy（居住占用模式） | 24h | ✅ | ✅ |
| 2 | Heating & Cooling System（供暖/制冷系统） | Annual + Monthly + 24h | ✅ | ✅ |
| 3 | Heating & Cooling Usage（冷暖使用强度） | Annual + Monthly + 24h | ✅ | ✅ |
| 4 | EV Annual Driving（电动车年里程） | Annual + Monthly | ✅ | ✅ |
| 5 | EV Charging Pattern（EV 充电习惯） | 24h | ✅ | ✅ |

### 3.2 各国差异化参数对比

#### 3.2.1 季节定义

| 参数 | 德国 | 澳洲 NSW/VIC/SA/WA | 澳洲 QLD | 澳洲 NT |
|------|------|-------------------|----------|---------|
| 冷季 | Jun–Aug | Dec–Mar | Oct–Apr | Sep–Apr |
| 暖季 | Oct–Apr | Jun–Aug | Jun–Jul | — |

> 澳洲南半球季节相反，且各州差异大，需按州配置。

#### 3.2.2 基准年电量

| 德国 | 澳洲各州 |
|------|---------|
| 3,500 kWh（统一） | TAS: 7,500 / VIC: 5,200 / NSW: 7,778 / SA: 5,200 / QLD: 6,500 / ACT: 7,778 / NT: 8,000 / WA: 6,000 kWh（按州预设） |

> 澳洲的基准年电量远高于德国，且各州差异显著。

#### 3.2.3 供暖/制冷系统

德国和澳洲的系统选项可以保持一致（None / AC / Electric heating / Heat pump），但基础热负荷数值需要按国家配置：

| 系统 | 德国 Base Thermal Load | 澳洲 Base Thermal Load（建议值） |
|------|----------------------|-------------------------------|
| No system | 0 | 0 |
| Air conditioning | 0 | 0 |
| Electric heating | 3,000 kWh | 2,500 kWh |
| Heat pump | 2,000 kWh | 1,800 kWh |

> 澳洲气候整体温暖，供暖需求低于德国，但制冷需求更高。具体数值需根据实际数据校准。

---

## 4. LoadProfile 计算流程（统一引擎）

### 4.1 Step 1：确定最终年电量

```
Thermal_Extra = BaseThermalLoad[system] × UsageMultiplier[level]
  （仅 Electric heating / Heat pump 时 > 0）

EV_Extra = Mileage[selection] × EV_Efficiency
  （如 10,000 km × 0.18 = 1,800 kWh）

Final_Annual_kWh = Base_Annual + Thermal_Extra + EV_Extra
```

### 4.2 Step 2：计算月度分布

```
对每个月 m (1..12):
  // 季节修正
  SeasonalMult[m] = 1
    + IF(系统含AC或热泵 AND m∈冷季, CoolMonthMult[level] - 1, 0)
    + IF(系统含电采暖或热泵 AND m∈暖季, HeatMonthMult[level] - 1, 0)

  ReshapedBase[m] = BaseMonthlyKWh[m] × SeasonalMult[m]

  // 热力额外按权重分配
  ThermalWeight[m] = 按系统类型和季节标志计算
  ThermalAlloc[m] = Thermal_Extra × ThermalWeight[m] / SUM(ThermalWeight)

  // EV 均匀分摊
  EVAlloc[m] = EV_Extra / 12

  // 合成
  FinalKWh[m] = ReshapedBase[m]/SUM(ReshapedBase) × Base_Annual + ThermalAlloc[m] + EVAlloc[m]
  FinalShare[m] = FinalKWh[m] / Final_Annual_kWh
```

### 4.3 Step 3：计算 24h 分布

```
对每个小时 h (0..23):
  // 占用模式修正
  OccMult[h] = IF(h ∈ daytimeHours, DaytimeFactor[occupancy], 1.0)

  // 峰时段修正
  CoolPeakMult[h] = IF(系统含AC或热泵 AND h∈coolingPeakHours, CoolPeakMult[level], 1.0)
  HeatPeakMult[h] = IF(系统含电采暖或热泵 AND h∈heatingPeakHours, HeatPeakMult[level], 1.0)
  PeakMult[h] = CoolPeakMult[h] × HeatPeakMult[h]

  // 调整 & 归一化
  AdjShare[h] = BaseHourlyShare[h] × OccMult[h] × PeakMult[h]
  NormShare[h] = AdjShare[h] / SUM(AdjShare)

  // 非 EV 日均电量
  NonEV_kWh[h] = (Base_Annual + Thermal_Extra) / 365 × NormShare[h]

  // EV 日均电量
  EV_kWh[h] = (EV_Extra / 365) × EVChargingDist[h][pattern]

  // 合成
  FinalKWhPerDay[h] = NonEV_kWh[h] + EV_kWh[h]
  FinalHourlyShare[h] = FinalKWhPerDay[h] / (Final_Annual_kWh / 365)
```

---

## 5. 澳洲方案接入：LoadProfile → 方案推荐

### 5.1 现有方案流程中的用电量依赖点

当前 V1.5.0 中，方案推荐依赖以下用电量数据（全部来自州预设固定值）：

| 数据项 | 当前来源 | 用途 |
|--------|---------|------|
| 日均用电 | 州年均用电 / 365 | 光伏剩余计算 |
| 白天用电 (07:00–17:00) | 日均用电 × 白天占比 | 光伏剩余 = 日均发电 - 白天用电 |
| 晚高峰用电 (17:00–21:00) | 日均用电 × 晚高峰占比 | B/C 方案电池容量 |
| 整夜用电 (17:00–07:00) | 日均用电 × 夜间占比 | A 方案电池容量 |

### 5.2 LoadProfile 输出如何替代

引入 LoadProfile 后，上述数据不再使用固定占比，而是从 LoadProfile 的 24h 分布动态计算：

```
// LoadProfile 输出
Final_Annual_kWh          // 个性化年电量
FinalHourlyShare[0..23]   // 个性化 24h 占比

// 派生用电需求（替代原有固定值）
日均用电 = Final_Annual_kWh / 365

白天用电 = 日均用电 × SUM(FinalHourlyShare[7..16])
  // 即 07:00–17:00 的占比之和

晚高峰用电 = 日均用电 × SUM(FinalHourlyShare[17..20])
  // 即 17:00–21:00 的占比之和

整夜用电 = 日均用电 × SUM(FinalHourlyShare[17..23] + FinalHourlyShare[0..6])
  // 即 17:00–07:00 的占比之和
```

### 5.3 方案级别的 LoadProfile 影响

LoadProfile 的变化会**逐级传导**到方案推荐的每个环节：

```
LoadProfile 因子变化
  │
  ├─→ Final_Annual_kWh 变化
  │     └─→ 日均用电变化
  │
  ├─→ 24h 分布变化
  │     ├─→ 白天用电占比变化 → 光伏剩余变化
  │     ├─→ 晚高峰用电变化 → B/C 方案电池容量变化
  │     └─→ 整夜用电变化 → A 方案电池容量变化
  │
  └─→ 最终影响
        ├─→ 电池容量推荐（三套方案各自变化）
        ├─→ 投资回报计算（用电量和自用率变化）
        └─→ 光伏剩余（影响电池策略选择）
```

### 5.4 具体改动点（澳洲 V1.5.0 → V1.6.0）

| 模块 | 改动 | 说明 |
|------|------|------|
| 用电需求计算 (3.1.1.5) | **替换** | 原"基于预设的用电量需求计算"改为"基于 LoadProfile 的用电量需求计算" |
| 电池容量推荐 (3.1.1.7) | **无需改动** | 公式不变，输入的用电需求数据来源变了 |
| 逆变器选型 (3.1.1.6) | **无需改动** | 不依赖用电量 |
| PV 方案生成 (3.1.1.2) | **无需改动** | 不依赖用电量 |
| 投资回报计算 (3.1.3) | **需适配** | 自用率计算需要使用新的 24h 分布 |
| 储能扩容 (3.1.2) | **替换用电需求来源** | 同上，用电需求改为 LoadProfile 输出 |

### 5.5 澳洲 LoadProfile 用户输入方式

澳洲的 LoadProfile 输入可以在方案级别生效，建议分两层：

```
全局层（影响所有方案）：
  ├─ 居住占用模式（Daytime Occupancy）
  ├─ 供暖/制冷系统（Heating & Cooling System）
  ├─ 冷暖使用强度（Heating & Cooling Usage）
  ├─ 电动车年里程（EV Annual Driving）
  └─ EV 充电习惯（EV Charging Pattern）

方案层（可选覆盖，按方案差异化）：
  └─ 未来可支持：不同方案使用不同的 LoadProfile 预设
     例如：方案 A（大系统）假设有 EV + 热泵
           方案 C（入门）假设无 EV、无热泵
```

> 本期建议先实现全局层，三套方案共享同一个 LoadProfile 输出。方案层差异化作为后续迭代。

---

## 6. 德国部分：本期范围

### 6.1 本期交付

- LoadProfile 计算引擎（已有，纳入统一框架）
- 德国国家参数包配置
- 输出：Final Annual kWh + Monthly Share[12] + Hourly Share[24]

### 6.2 不做的部分

- 方案推荐（PV/电池/逆变器选型）
- 投资回报计算
- 德国会有其他个性化方式（如用户上传电费账单、智能电表数据等），LoadProfile 作为其中一种输入源

---

## 7. 数据模型设计

### 7.1 LoadProfile 输入

```typescript
interface LoadProfileInput {
  country: 'AU' | 'DE';
  region?: string;                    // 澳洲: 'NSW'|'VIC'|... 德国: 可选城市
  baseAnnualKWh?: number;             // 用户自定义年电量（可选，覆盖预设）

  occupancy: 'mostly_away' | 'wfh' | 'always_home';
  hvacSystem: 'none' | 'ac' | 'electric_heating' | 'heat_pump';
  hvacUsage: 'low' | 'medium' | 'high' | 'very_high';
  evMileage: 0 | 5000 | 10000 | 15000 | 20000 | 25000;
  evCharging: 'overnight' | 'mixed' | 'daytime' | 'solar_optimized';
}
```

### 7.2 LoadProfile 输出

```typescript
interface LoadProfileOutput {
  finalAnnualKWh: number;
  thermalExtraKWh: number;
  evExtraKWh: number;

  monthlyShare: number[12];           // 月度占比，合计 = 1.0
  monthlyKWh: number[12];             // 月度电量

  hourlyShare: number[24];            // 24h 占比，合计 = 1.0
  hourlyKWhPerDay: number[24];        // 日均每小时电量

  // 派生指标（供方案推荐使用）
  dailyAvgKWh: number;                // 日均用电
  daytimeKWh: number;                 // 白天用电 (07:00–17:00)
  eveningPeakKWh: number;             // 晚高峰用电 (17:00–21:00)
  overnightKWh: number;               // 整夜用电 (17:00–07:00)
}
```

### 7.3 国家参数包

```typescript
interface CountryProfilePack {
  country: string;
  region: string;

  baseProfile: {
    annualKWh: number;
    monthlyShare: number[12];
    hourlyShare: number[24];
    coolingSeasonFlags: boolean[12];
    heatingSeasonFlags: boolean[12];
    daytimeFlags: boolean[24];
    coolingPeakFlags: boolean[24];
    heatingPeakFlags: boolean[24];
    evChargingProfiles: Record<string, number[24]>;
    solarPVProxy: number[24];
  };

  lookups: {
    occupancyFactors: Record<string, number>;
    usageLevels: Record<string, {
      annualMult: number;
      coolMonthMult: number;
      heatMonthMult: number;
      coolPeakMult: number;
      heatPeakMult: number;
    }>;
    systemTypes: Record<string, { baseThermalLoad: number }>;
    evEfficiency: number;
    evMileageOptions: Record<string, number>;
  };

  // 澳洲特有
  solutionConfig?: AustraliaSolutionConfig;
}
```

---

## 8. 澳洲接入改动详细说明

### 8.1 改动前（V1.5.0）

```
用电需求计算：
  日均用电 = 州年均用电 / 365                    ← 固定值
  白天用电 = 日均用电 × 43.88%                   ← 固定占比
  晚高峰用电 = 日均用电 × 22.1%                  ← 固定占比
  整夜用电 = 日均用电 × 59.6%                    ← 固定占比
```

### 8.2 改动后（V1.6.0）

```
LoadProfile 计算：
  用户选择 5 大因子 → LoadProfile 引擎 → 输出 24h 分布

用电需求计算（从 LoadProfile 派生）：
  日均用电 = Final_Annual_kWh / 365              ← 动态值
  白天用电 = 日均用电 × SUM(hourlyShare[7..16])  ← 动态占比
  晚高峰用电 = 日均用电 × SUM(hourlyShare[17..20]) ← 动态占比
  整夜用电 = 日均用电 × SUM(hourlyShare[17..23]+hourlyShare[0..6]) ← 动态占比
```

### 8.3 兼容性设计

- 如果用户**不选择任何 LoadProfile 因子**（全部使用默认值），输出应与当前 V1.5.0 的固定预设值一致
- 建议：将当前各州的固定占比作为 LoadProfile 的默认基准曲线，确保向后兼容
- LoadProfile 因子的默认选项应设为：
  - Occupancy: Mostly away（与当前白天占比 ~40% 吻合）
  - HVAC: No system（不增加额外电量）
  - Usage: Medium
  - EV: No electric vehicle
  - Charging: Mostly overnight

---

## 9. 实施路线建议

### Phase 1：LoadProfile 引擎（两国共用）
- 实现统一计算引擎
- 配置德国参数包（已有数据）
- 配置澳洲参数包（需补充：各州基准 24h 曲线、季节定义、冷暖系数）

### Phase 2：澳洲方案接入
- 替换用电需求计算模块
- 验证方案 A/B/C 的电池容量推荐结果
- 回归测试：默认因子下结果与 V1.5.0 一致

### Phase 3：德国方案推荐（后续）
- 待德国市场确定方案策略后接入
- LoadProfile 输出已就绪，方案模块可独立开发

---

## 10. 待确认事项

| # | 问题 | 影响 |
|---|------|------|
| 1 | 澳洲各州的基准 24h 曲线数据来源？当前 PRD 中有"各州小时用电比例"但未在 PDF 中展示具体数值 | 需要获取各州 hourlyShare[24] 数据 |
| 2 | 澳洲的供暖/制冷系统基础热负荷数值需要校准 | 本文档中的建议值需与业务确认 |
| 3 | 澳洲各州的冷暖季节定义是否采用 Cooling-Heating-Month 表中的数据？ | 已有参考数据，需确认 |
| 4 | LoadProfile 因子的默认值是否需要按州差异化？（如 QLD 默认有 AC） | 影响用户体验 |
| 5 | 方案层差异化（不同方案不同 LoadProfile）是否纳入本期？ | 建议本期先做全局层 |
| 6 | 德国的"其他个性化方式"与 LoadProfile 的关系？是替代还是叠加？ | 影响架构设计 |
