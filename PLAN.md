# LoadProfile 验证脚本 — 设计计划

> 基于 `[PRD]SalesAgent V1.12.pdf` § 3.1 以及 `参数/` 目录下所有 CSV 文件

---

## 一、背景与目标

V1.12 引入 **LoadProfile 动态计算**，取代原来按州固定预设的三个用电比例。

| 旧版（固定预设）| 新版（LoadProfile 动态计算）|
|---|---|
| 白天用电占比 固定 43.88% | 根据 5 大干预因子动态计算 |
| 晚高峰用电占比 固定 22.1% | Step 1-4 完整推导 |
| 整夜用电占比 固定 59.6% | 输出三大指标替换旧值 |

验证脚本的目标：
1. **端到端复现** PRD 中每一个计算步骤
2. **对齐 PRD 内置示例**（NSW + Heat pump + Medium + EV 10,000km + Mostly away + Mostly overnight）
3. **支持任意参数组合**，方便测算多个场景
4. **详细展示**每个阶段的中间变量，方便排查问题

---

## 二、输入参数（5 大干预因子 + 1 个默认参数）

### 2.1 参数定义

| # | 参数名 | 用户问题 | 可选值 | 默认（跳过）|
|---|---|---|---|---|
| 1 | `state` | 地址→自动识别 | TAS/NT/ACT/SA/NSW/QLD/WA/VIC | NSW |
| 2 | `system` | Heating & Cooling System | No system / Air conditioning / Electric heating / Heat pump | No system |
| 3 | `usage_level` | How heavily do you use H&C? | Low / Medium / High / Very high | Medium |
| 4 | `mileage` | EV Annual Driving Distance (km) | 0 / 5000 / 10000 / 15000 / 20000 / 25000 | 0 |
| 5 | `occupancy` | When are you usually home? | Mostly away / Working from home / Someone always at home | No modification |
| 6 | `ev_charging` | EV Charging Pattern | mostly_overnight / mixed_day_and_night / mostly_daytime / solar_optimized | mostly_overnight |

### 2.2 输入配置方式（三种，均支持）

#### 方式 A：命令行参数（单次测算）

```bash
python validate_loadprofile.py \
  --state NSW \
  --system "Heat pump" \
  --usage Medium \
  --mileage 10000 \
  --occupancy "Mostly away" \
  --ev-charging mostly_overnight
```

| CLI 参数 | 类型 | 说明 |
|---|---|---|
| `--state` | str | 州代码，大小写不敏感 |
| `--system` | str | 设备名称（含空格需加引号）|
| `--usage` | str | 使用强度 |
| `--mileage` | int | EV 年里程，自动对齐最近档位（0/5k/10k/…）|
| `--occupancy` | str | 居住模式（含空格需加引号）|
| `--ev-charging` | str | EV 充电模式（下划线分隔）|

#### 方式 B：JSON 配置文件（批量/自动化）

```bash
python validate_loadprofile.py --config my_case.json
```

`my_case.json` 格式：

```json
{
  "state": "NSW",
  "system": "Heat pump",
  "usage_level": "Medium",
  "mileage": 10000,
  "occupancy": "Mostly away",
  "ev_charging": "mostly_overnight"
}
```

也支持数组，一次运行多个场景：

```json
[
  { "name": "PRD基准", "state": "NSW", "system": "Heat pump", ... },
  { "name": "纯制冷",  "state": "QLD", "system": "Air conditioning", ... }
]
```

#### 方式 C：内置模式（快捷标记）

```bash
python validate_loadprofile.py --validate    # PRD 标准示例，自动对齐期望值
python validate_loadprofile.py --batch       # 运行全部 6 个内置批量场景
python validate_loadprofile.py --skip-all    # 模拟全部题目跳过（旧版行为）
```

---

## 三、完整参数清单（所有 CSV 参数文件）

### 3.1 `AU_base_annual_kwh.csv` — 各州基础年用电量

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | str | 州代码（TAS/NT/ACT/SA/NSW/QLD/WA/VIC）|
| `base_annual_kwh` | float | 该州居民用户基础年用电量（kWh）|

**当前值：**

| state | base_annual_kwh |
|---|---|
| TAS | 10,148 |
| NT | 10,008 |
| ACT | 8,632 |
| SA | 7,129 |
| NSW | 7,778 |
| QLD | 7,270 |
| WA | 7,634 |
| VIC | 6,778 |

---

### 3.2 `AU_hvac_thermal_load.csv` — 暖通空调基础热负荷

| 字段 | 类型 | 说明 |
|---|---|---|
| `system` | str | 设备类型名称（4种，与用户问题选项一致）|
| `base_thermal_load_kwh` | float | 该设备带来的年额外热负荷基准值（kWh）|

**当前值：**

| system | base_thermal_load_kwh |
|---|---|
| No heating or cooling system | 0 |
| Air conditioning | 0（仅重分布，不增加年电量）|
| Electric heating | 2,500 |
| Heat pump (heating & cooling) | 1,800 |

---

### 3.3 `AU_usage_level_coefficients.csv` — 用电强度系数

| 字段 | 类型 | 说明 |
|---|---|---|
| `usage_level` | str | 强度档位（Low/Medium/High/Very high）|
| `annual_mult` | float | Step 1 年电量倍率（直接作用于 BaseThermalLoad）|
| `cool_month_mult` | float | Step 2 制冷月季节乘数 |
| `heat_month_mult` | float | Step 2 制热月季节乘数 |
| `cool_peak_mult` | float | Step 3 制冷尖峰小时倍数 |
| `heat_peak_mult` | float | Step 3 制热尖峰小时倍数 |

**当前值：**

| level | annual_mult | cool_month_mult | heat_month_mult | cool_peak_mult | heat_peak_mult |
|---|---|---|---|---|---|
| Low | 0.7 | 1.05 | 1.08 | 1.10 | 1.08 |
| Medium | 1.0 | 1.10 | 1.15 | 1.20 | 1.15 |
| High | 1.3 | 1.20 | 1.25 | 1.35 | 1.25 |
| Very high | 1.6 | 1.35 | 1.40 | 1.50 | 1.40 |

---

### 3.4 `GLOBAL_ev_params.csv` — 电动汽车参数

| 字段 | 类型 | 说明 |
|---|---|---|
| `ev_efficiency_kwh_per_km` | float | EV 能效（kWh/km），固定 0.18 |
| `mileage_option_N` | int | 题目档位 0-5（0/5k/10k/15k/20k/25k km）|

---

### 3.5 `AU_monthly_share.csv` — 各州月度基准用电占比

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | str | 州代码 |
| `Jan` ~ `Dec` | float | 各月占全年用电量的比例，sum = 1.0 |

---

### 3.6 `AU_cooling_heating_season_flags.csv` — 各州冷暖季月份标志位

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | str | 州代码 |
| `Jan_cool` ~ `Dec_cool` | 0/1 | 该月是否为制冷月 |
| `Jan_heat` ~ `Dec_heat` | 0/1 | 该月是否为制热月 |

> **注意：** 同一个月不会同时是冷季和暖季。

---

### 3.7 `AU_hourly_share.csv` — 各州24小时基准分布比例

| 字段 | 类型 | 说明 |
|---|---|---|
| `state` | str | 州代码 |
| `H00` ~ `H23` | float | 各小时占全天用电量的比例，sum = 1.0 |
| `daytime_share_07_17` | float | H07-H16 合计（校验用）|
| `evening_peak_share_17_21` | float | H17-H20 合计（校验用）|
| `overnight_share_17_07` | float | H17-H06 合计（校验用）|

> 数据来源：AEMO MSATS NSLP 2021 年 10 月版（V1.12 更新）

---

### 3.8 `GLOBAL_occupancy_factors.csv` — 居住占用模式系数

| 字段 | 类型 | 说明 |
|---|---|---|
| `occupancy` | str | 居住模式名称（4种）|
| `daytime_mult` | float | 白天时段（AU: H07-H16）的修正倍数 |
| `daytime_hours_AU` | str | 澳洲白天时段定义 07-17 |

**当前值：**

| occupancy | daytime_mult |
|---|---|
| No modification (default/skip) | 1.0 |
| Mostly away during the day | 0.6 |
| Working from home | 1.4 |
| Someone always at home | 1.2 |

---

### 3.9 `AU_ev_charging_profiles.csv` — EV 充电小时分布

| 字段 | 类型 | 说明 |
|---|---|---|
| `hour` | int | 小时（0-23）|
| `mostly_overnight` | float | 夜间充电模式下该小时的比例 |
| `mixed_day_and_night` | float | 日夜混合模式 |
| `mostly_daytime` | float | 日间充电模式 |
| `solar_optimized` | float | 光伏优化模式（10:00-16:00 集中）|

**mostly_overnight 分布：** H00-H05 各 0.125，H22-H23 各 0.125，其他 0

---

### 3.10 标志位（运行时计算，不在CSV中，由代码生成）

| 标志位 | 定义 |
|---|---|
| `CoolFlag[m]` | = 1 当 m ∈ 制冷月，否则 0 |
| `HeatFlag[m]` | = 1 当 m ∈ 制热月，否则 0 |
| `DaytimeFlag[h]` | = 1 当 h ∈ [7..16]（AU: 07:00–17:00），否则 0 |
| `CoolPeakFlag[h]` | = 1 当 h ∈ [14..18]（14:00–19:00）|
| `HeatPeakFlag[h]` | = 1 当 h ∈ [6..8, 18..21]（06:00–09:00 & 18:00–22:00）|
| 系统参与冷季 | system ∈ {Air conditioning, Heat pump} |
| 系统参与暖季 | system ∈ {Electric heating, Heat pump} |

---

## 四、计算流程总览（4 个 Step）

```
输入: state + 5大干预因子
       ↓
[Step 1] 确定最终年用电量
  ├── Base_Annual（按州预设）
  ├── Thermal_Extra = BaseThermalLoad × UsageMult
  ├── EV_Extra = Mileage × 0.18
  └── Final_Annual = Base + Thermal + EV
       ↓
[Step 2] 月度分布（12个月）
  ├── 2.1 SeasonalMult[m]（冷暖季节乘数）
  ├── 2.2 ReshapedBase[m] → NormBase[m]（归一化）
  ├── 2.3 ThermalWeight[m] → ThermalAlloc[m]
  ├── 2.4 EVAlloc[m] = EV_Extra / 12
  └── 2.5 FinalKWh[m] = NormBase + ThermalAlloc + EVAlloc
           FinalShare[m] = FinalKWh[m] / Final_Annual
       ↓
[Step 3] 24小时分布
  ├── 3.1 OccMult[h]（居住占用模式修正）
  ├── 3.2 CoolPeak[h] × HeatPeak[h] = PeakMult[h]
  ├── 3.3 AdjShare[h] → NormShare[h]（归一化）
  ├── 3.4 NonEV_kWh[h] + EV_kWh[h] = FinalKWhPerDay[h]
  └── 3.5 FinalHourlyShare[h] = FinalKWhPerDay[h] / (Final_Annual/365)
       ↓
[Step 4] 派生三大用电需求（最终输出）
  ├── 日均用电 = Final_Annual / 365
  ├── 白天用电（H07-H16）= 日均 × Σ FinalHourlyShare[7..16]
  ├── 晚高峰用电（H17-H20）= 日均 × Σ FinalHourlyShare[17..20]
  └── 整夜用电（H17-H23, H00-H06）= 日均 × Σ FinalHourlyShare[17..23, 0..6]
```

---

## 五、验证点与 PRD 内置示例对齐

### 验证用例（PRD 标准示例）

```
State:        NSW
System:       Heat pump (heating & cooling)
Usage level:  Medium
EV mileage:   10,000 km
Occupancy:    Mostly away during the day
EV charging:  Mostly overnight
```

### Phase 1 验证点

| 变量 | 期望值（PRD）|
|---|---|
| `Base_Annual` | 7,778 kWh |
| `BaseThermalLoad[Heat pump]` | 1,800 kWh |
| `UsageMult[Medium]` | 1.0 |
| `Thermal_Extra` | 1,800 kWh |
| `EV_Extra` | 1,800 kWh（10,000 × 0.18）|
| `Final_Annual` | 11,378 kWh |

### Phase 2 验证点

| 变量 | 期望值（PRD）|
|---|---|
| `SeasonalMult[Jun]`（NSW 暖季）| 1.15 |
| `SeasonalMult[Jan]`（NSW 冷季）| 1.10 |
| `SeasonalMult[Apr]`（平季）| 1.00 |
| `sum(ReshapedBase)` | ≈ 8,383.67 kWh（PRD 提到）|
| `sum(NormBase)` | = 7,778 kWh（Base_Annual）|
| `ThermalAlloc` 示例月 | 按权重分配，各月不同 |
| `EVAlloc[每月]` | 150.0 kWh（1800/12）|
| `sum(FinalKWh)` | = 11,378 kWh = Final_Annual |

### Phase 3 验证点

| 变量 | 期望值（PRD）|
|---|---|
| `OccMult[H07]`（白天，Mostly away）| 0.6 |
| `OccMult[H00]`（夜间）| 1.0 |
| `CoolPeakMult[Medium]` | 1.20 |
| `HeatPeakMult[Medium]` | 1.15 |
| `PeakMult[H14]`（冷峰时段，Heat pump）| 1.20 |
| `PeakMult[H06]`（暖峰时段，Heat pump）| 1.15 |
| `sum(NormShare)` | = 1.0 |
| `EV_kWh[H00-H05]`（mostly_overnight）| = 日均 EV × 0.125 各小时 |

### Phase 4 验证点

| 变量 | 期望对照 | 说明 |
|---|---|---|
| `daytime_kwh` | 与旧版 43.88% 比较 | 应有所不同（动态结果）|
| `evening_peak_kwh` | 与旧版 22.1% 比较 | 体现 Mostly away 的晚间偏重 |
| `overnight_kwh` | 与旧版 59.6% 比较 | 含 EV 充电分布 |
| `sum check` | 日均 = daytime_share + evening_share 验证 | 数值一致性检查 |

---

## 六、脚本设计规格

### 文件结构

```
validate_loadprofile.py
├── 参数加载层:  load_params(params_dir)
├── 计算核心层:  LoadProfileCalculator(class)
│   ├── step1_annual_kwh()
│   ├── step2_monthly_distribution()
│   ├── step3_hourly_distribution()
│   └── step4_derive_metrics()
├── 打印展示层:  print_phase_result() / print_table()
├── 验证层:      validate_against_prd_example()
└── CLI 入口:    argparse → run_calculation()
```

### 命令行接口（三种运行模式）

```bash
# 模式1：PRD 标准示例验证（自动对齐期望值，标记 ✅/❌）
python validate_loadprofile.py --validate

# 模式2：自定义参数单次测算
python validate_loadprofile.py \
  --state NSW \
  --system "Heat pump" \
  --usage Medium \
  --mileage 10000 \
  --occupancy "Mostly away" \
  --ev-charging mostly_overnight

# 模式3：JSON 配置文件（支持单对象或对象数组）
python validate_loadprofile.py --config my_cases.json

# 模式4：全部跳过（模拟旧版行为）
python validate_loadprofile.py --skip-all --state NSW

# 模式5：运行全部 6 个内置批量场景
python validate_loadprofile.py --batch
```

| 参数 | 类型 | 枚举值 | 说明 |
|---|---|---|---|
| `--state` | str | TAS/NT/ACT/SA/NSW/QLD/WA/VIC | 州，大小写不敏感 |
| `--system` | str | 见 3.2 | 设备类型，含空格需加引号 |
| `--usage` | str | Low/Medium/High/Very high | 使用强度 |
| `--mileage` | int | 0/5000/10000/15000/20000/25000 | EV 年里程，自动取最近档 |
| `--occupancy` | str | 见 3.8 | 居住模式，含空格需加引号 |
| `--ev-charging` | str | mostly_overnight/mixed_day_and_night/mostly_daytime/solar_optimized | EV 充电模式 |
| `--config` | path | - | JSON 配置文件路径 |
| `--params-dir` | path | 默认 `参数/` | CSV 参数文件目录 |
| `--verbose` | flag | - | 输出完整中间变量表格 |

---

## 七、默认测试样例（内置输入数据）

脚本包含以下可直接运行的默认样例，无需任何参数即可触发。

### 样例 T-01：PRD 标准验证案例（`--validate` 默认触发）

```json
{
  "name": "PRD标准示例",
  "state": "NSW",
  "system": "Heat pump (heating & cooling)",
  "usage_level": "Medium",
  "mileage": 10000,
  "occupancy": "Mostly away during the day",
  "ev_charging": "mostly_overnight"
}
```

**期望验证点：**
- `Final_Annual` = 11,378 kWh
- `sum(ReshapedBase)` ≈ 8,383.67 kWh
- `EVAlloc[月]` = 150.0 kWh
- `sum(FinalShare)` = 1.0
- `sum(FinalHourlyShare)` = 1.0

---

### 样例 T-02：全部跳过（旧版行为复现，`--skip-all`）

```json
{
  "name": "全跳过/旧版基准",
  "state": "NSW",
  "system": "No heating or cooling system",
  "usage_level": "Medium",
  "mileage": 0,
  "occupancy": "No modification",
  "ev_charging": "mostly_overnight"
}
```

**期望验证点：**
- `Thermal_Extra` = 0，`EV_Extra` = 0
- `Final_Annual` = Base_Annual = 7,778 kWh
- 白天占比 ≈ 42.54%（直接来自 AU_hourly_share H07-H16 之和，NSW）
- 晚高峰占比 ≈ 28.97%
- 整夜占比 ≈ 57.46%

---

### 样例 T-03：批量场景（`--batch` 触发所有6个）

| ID | state | system | usage_level | mileage | occupancy | ev_charging | 验证目的 |
|---|---|---|---|---|---|---|---|
| T-01 | NSW | Heat pump | Medium | 10,000 | Mostly away | mostly_overnight | PRD 基准 |
| T-02 | NSW | No system | Medium | 0 | No modification | mostly_overnight | 旧版行为复现 |
| T-03 | QLD | Air conditioning | High | 0 | Someone always at home | mostly_overnight | 纯制冷重度，夏季高峰 |
| T-04 | TAS | Electric heating | Very high | 0 | Working from home | mostly_overnight | 纯制热极重，冬季高峰 |
| T-05 | NSW | Heat pump | Medium | 25000 | Working from home | solar_optimized | 大EV+居家办公 |
| T-06 | VIC | Heat pump | Low | 10,000 | Mostly away | mixed_day_and_night | 低强度+混合充电 |

---

### 样例 T-04：JSON 文件输入示例（`--config`）

文件名建议：`test_case_custom.json`

```json
[
  {
    "name": "我的场景A",
    "state": "SA",
    "system": "Air conditioning",
    "usage_level": "High",
    "mileage": 15000,
    "occupancy": "Working from home",
    "ev_charging": "solar_optimized"
  },
  {
    "name": "我的场景B",
    "state": "ACT",
    "system": "Heat pump (heating & cooling)",
    "usage_level": "Very high",
    "mileage": 5000,
    "occupancy": "Someone always at home",
    "ev_charging": "mixed_day_and_night"
  }
]
```

---

## 八、输出格式规格

### 8.1 单场景完整输出（`--validate` 或单次运行）

```
╔══════════════════════════════════════════════════════════════╗
║  LoadProfile 验证  NSW · Heat pump (heating & cooling)      ║
║  Usage: Medium  |  EV: 10,000km (mostly_overnight)          ║
║  Occupancy: Mostly away during the day                      ║
╚══════════════════════════════════════════════════════════════╝

┌─ STEP 1  最终年用电量 ──────────────────────────────────────┐
│  Base_Annual     (NSW)        :   7,778.00  kWh             │
│  BaseThermalLoad (Heat pump)  :   1,800.00  kWh             │
│  UsageMult       (Medium)     :       1.000                 │
│  Thermal_Extra                :   1,800.00  kWh             │
│  EV_Extra   (10,000km×0.18)   :   1,800.00  kWh             │
│  ─────────────────────────────────────────────────         │
│  Final_Annual                 :  11,378.00  kWh  ✅ PRD一致 │
└────────────────────────────────────────────────────────────┘

┌─ STEP 2  月度分布 ──────────────────────────────────────────┐
│  月    BaseShare  SsnMult  ReshBase   NormBase  ThrmAlloc  EVAlloc  FinalKWh  FinalShr │
│  Jan   0.08548   1.100    731.4      677.5     XXX.X      150.0    XXXX.X    0.XXXX   │
│  Feb   0.07781   1.100    666.4      617.0     XXX.X      150.0    XXXX.X    0.XXXX   │
│  ...（12行）                                                                           │
│  ───────────────────────────────────────────────────────────────────────────────────  │
│  合计  1.00000   -        8,383.7    7,778.0   1,800.0    1,800.0  11,378.0  1.0000   │
│  校验: sum(FinalKWh)=11,378.00 ✅   sum(FinalShare)=1.0000 ✅                          │
└────────────────────────────────────────────────────────────┘

┌─ STEP 3  24小时分布 ────────────────────────────────────────┐
│  小时  BaseShr   OccMult  CoolPk  HeatPk  PeakMult  AdjShr   NormShr   NonEV_kWh  EV_kWh  FinalShr │
│  H00   0.03064  1.000    1.00    1.00    1.000     0.03064  0.03XXX   X.XXX      0.617   0.XXXX   │
│  H07   0.03884  0.600    1.00    1.00    1.000     0.02330  0.02XXX   X.XXX      0.000   0.XXXX   │
│  H14   0.04096  0.600    1.20    1.00    1.200     0.02949  0.03XXX   X.XXX      0.000   0.XXXX   │
│  H18   0.07603  1.000    1.00    1.15    1.150     0.08743  0.09XXX   X.XXX      0.000   0.XXXX   │
│  ...（24行完整展示）                                                                              │
│  ──────────────────────────────────────────────────────────────────────────────────────────────   │
│  合计   1.00000  -        -       -       -         X.XXXXX  1.00000   31.16      4.93    1.00000  │
│  校验: sum(NormShare)=1.0000 ✅   sum(FinalHourlyShare)=1.0000 ✅                                  │
└────────────────────────────────────────────────────────────┘

┌─ STEP 4  三大用电需求（输出给方案A/B/C）────────────────────┐
│  日均用电          =  Final_Annual / 365  =   31.17 kWh/天  │
│                                                             │
│  白天用电   H07-H16 :  XX.XX kWh  占比 XX.X%  [旧版 43.88%]│
│  晚高峰用电 H17-H20 :  XX.XX kWh  占比 XX.X%  [旧版 22.10%]│
│  整夜用电   H17-H06 :  XX.XX kWh  占比 XX.X%  [旧版 59.60%]│
│                                                             │
│  差异说明:                                                  │
│    白天: Mostly away → OccMult=0.6 → 白天用电被压缩        │
│    夜间: EV mostly_overnight → 夜间充电叠加                │
└────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════╗
║  验证结果: ✅ PASS  6/6 校验点全部通过                       ║
╚══════════════════════════════════════════════════════════════╝
```

### 8.2 批量场景汇总输出（`--batch`）

```
╔═══ 批量测算结果汇总 ══════════════════════════════════════════════════════════════════════╗
║  ID    场景名            Final_kWh  白天kWh  白天%   晚高峰kWh  晚高峰%  整夜kWh  整夜%  ║
║  T-01  PRD标准示例       11,378     XX.XX    XX.X%   XX.XX      XX.X%    XX.XX    XX.X% ║
║  T-02  全跳过/旧版基准    7,778     XX.XX    XX.X%   XX.XX      XX.X%    XX.XX    XX.X% ║
║  T-03  QLD纯制冷高度      7,270     XX.XX    XX.X%   XX.XX      XX.X%    XX.XX    XX.X% ║
║  T-04  TAS制热极重       10,148+    XX.XX    XX.X%   XX.XX      XX.X%    XX.XX    XX.X% ║
║  T-05  大EV+居家办公     12,278     XX.XX    XX.X%   XX.XX      XX.X%    XX.XX    XX.X% ║
║  T-06  VIC低强度混充     10,378     XX.XX    XX.X%   XX.XX      XX.X%    XX.XX    XX.X% ║
╚═══════════════════════════════════════════════════════════════════════════════════════════╝
```

### 8.3 输出字段说明

| 字段 | 单位 | 说明 |
|---|---|---|
| `Final_Annual` | kWh/年 | 最终年总用电量（方案A/B/C计算基础）|
| `daytime_kwh` | kWh/天 | 白天用电（H07-H16），输入电池自给计算 |
| `daytime_pct` | % | 白天用电占日均比例 |
| `evening_peak_kwh` | kWh/天 | 晚高峰用电（H17-H20），影响电池放电推荐 |
| `evening_peak_pct` | % | 晚高峰占比 |
| `overnight_kwh` | kWh/天 | 整夜用电（H17-H06），影响电池容量推荐 |
| `overnight_pct` | % | 整夜占比 |

> **旧版固定值对照：** 白天 43.88% · 晚高峰 22.10% · 整夜 59.60%

---

## 九、参数文件依赖映射

| 计算步骤 | 依赖参数文件 |
|---|---|
| Step 1 | `AU_base_annual_kwh.csv`, `AU_hvac_thermal_load.csv`, `AU_usage_level_coefficients.csv`, `GLOBAL_ev_params.csv` |
| Step 2 月度 | `AU_monthly_share.csv`, `AU_cooling_heating_season_flags.csv`, `AU_usage_level_coefficients.csv` |
| Step 3 小时 | `AU_hourly_share.csv`, `GLOBAL_occupancy_factors.csv`, `AU_usage_level_coefficients.csv`, `AU_ev_charging_profiles.csv` |
| 标志位 | `AU_cooling_heating_season_flags.csv` |

---

## 十、实施计划

```
Phase 0: 参数加载与验证（load_params + 数据完整性校验）
Phase 1: Step 1 实现 + PRD 示例验证
Phase 2: Step 2 实现 + 月度分布验证（含表格打印）
Phase 3: Step 3 实现 + 24h 分布验证（含表格打印）
Phase 4: Step 4 实现 + 三大指标对比旧版
Phase 5: CLI 封装 + 批量场景测算
```

---

*计划版本: v1.0 | 日期: 2026-04-15*
