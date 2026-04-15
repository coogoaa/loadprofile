# LoadProfile 验证工具

基于 [PRD] SalesAgent V1.12 § 3.1，用于计算和验证 **B&C Agent** 的 LoadProfile 推算逻辑。

---

## 目录结构

```
.
├── validate_loadprofile.py     # 主脚本（计算 + 验证 + MD 报告生成）
├── build_params_used.py        # 从 参数/ 生成 参数_used/（一次性执行）
├── input_example.txt           # 单个输入示例文件
│
├── inputs/                     # 批量输入目录（每个 .txt / .md 一个案例）
│   ├── case_NSW_heatpump.txt
│   ├── case_QLD_aircon.txt
│   └── case_TAS_heating_ev.txt
│
├── outputs/                    # 自动生成的 MD 报告目录
│   ├── case_NSW_heatpump_report.md
│   └── ...
│
├── 参数_used/                  # 实际参与计算的参数文件（AU-only，已清洗）
│   ├── AU_base_annual_kwh.csv
│   ├── AU_cooling_heating_season_flags.csv
│   ├── AU_ev_charging_profiles.csv
│   ├── AU_hourly_share.csv
│   ├── AU_hvac_thermal_load.csv
│   ├── AU_monthly_share.csv
│   ├── AU_usage_level_coefficients.csv
│   ├── GLOBAL_ev_params.csv
│   ├── GLOBAL_occupancy_factors.csv
│   ├── Q1_occupancy_options.csv   # 题目选项映射表
│   ├── Q2_hvac_options.csv
│   ├── Q3_usage_options.csv
│   ├── Q4_ev_km_options.csv
│   └── Q5_ev_charging_options.csv
│
└── 参数/                       # 原始参数文件（含 DE，历史备份）
```

---

## 快速开始

### 方式一：目录批量（推荐）

将输入文件放入 `inputs/`，一次性处理所有案例，MD 报告自动保存到 `outputs/`：

```bash
python3 validate_loadprofile.py --input-dir inputs --output-dir outputs
```

### 方式二：单文件输入

```bash
python3 validate_loadprofile.py --input input_example.txt
```

同时在终端输出详细步骤，并在 `outputs/` 生成对应的 MD 报告。

### 方式三：PRD 标准示例验证

```bash
python3 validate_loadprofile.py --validate
```

运行 PRD § 3.1 标准示例，并校验 5 项期望值（✅ PASS / ❌ FAIL）。

### 方式四：内置批量场景

```bash
python3 validate_loadprofile.py --batch
```

运行 6 个内置测试场景，输出汇总对比表（不含步骤详情）。

### 方式五：CLI 直接传参

```bash
python3 validate_loadprofile.py \
  --state NSW \
  --system "Heat pump (heating & cooling)" \
  --usage Medium \
  --mileage 10000 \
  --occupancy "Mostly away during the day" \
  --ev-charging mostly_overnight
```

---

## 输入文件格式（TXT / MD）

每个输入文件包含**地址** + **5 道题**的答案，格式为 `key: value`，每行一条：

```
# 注释行（以 # 开头）会被忽略
address: 8/123 George Street, Parramatta NSW 2150
q1: Mostly away during the day
q2: Heat pump (heating & cooling)
q3: Medium
q4: 10,000 km
q5: Mostly overnight
```

- **地址**：支持完整地址、州缩写（如 `NSW`）或邮编（如 `2150`）
- **跳过题目**：将值留空或写 `skip`，系统使用默认值
- **题目逻辑**：Q3 在 Q2 = "No heating or cooling system" 时自动跳过；Q5 在 Q4 = "No electric vehicle" 时自动跳过

---

## 5 道题选项参考

### Q1 — When are you usually home during the day?

| 选项 | 效果 |
|------|------|
| `Mostly away during the day` | 白天用电 × 0.6，夜间偏重 |
| `Working from home` | 白天用电 × 1.4 |
| `Someone always at home` | 白天用电 × 1.2 |
| `skip` / 留空 | 不调整（默认） |

### Q2 — What heating & cooling system do you have?

| 选项 | Thermal_Extra 基准 |
|------|-------------------|
| `No heating or cooling system` | 0 kWh |
| `Air conditioning` | 0 kWh（重分布，不增加年总量） |
| `Electric heating` | 2,500 kWh |
| `Heat pump (heating & cooling)` | 1,800 kWh |
| `skip` / 留空 | = No system |

### Q3 — How heavily do you use heating & cooling?
> **仅在 Q2 ≠ "No heating or cooling system" 时生效**

| 选项 | 年倍数 | 冷月倍数 | 暖月倍数 |
|------|--------|---------|---------|
| `Low` | 0.7 | 1.05 | 1.08 |
| `Medium`（默认） | 1.0 | 1.10 | 1.15 |
| `High` | 1.3 | 1.20 | 1.25 |
| `Very high` | 1.6 | 1.35 | 1.40 |

### Q4 — Estimated annual EV driving distance?

| 选项 | km 值 | EV_Extra (kWh) |
|------|-------|---------------|
| `No electric vehicle`（默认） | 0 | 0 |
| `5,000 km` | 5,000 | 900 |
| `10,000 km` | 10,000 | 1,800 |
| `15,000 km` | 15,000 | 2,700 |
| `20,000 km` | 20,000 | 3,600 |
| `25,000+ km` | 25,000 | 4,500 |

### Q5 — When is your EV usually charged?
> **仅在 Q4 ≠ "No electric vehicle" 时生效**

| 选项 | 充电集中时段 |
|------|------------|
| `Mostly overnight`（默认） | H00–H05, H22–H23 |
| `Mixed day and night` | H00–H05, H10–H15, H22–H23 |
| `Mostly daytime` | H10–H15 |
| `Solar-optimized charging` | H09–H16（跟随光伏出力曲线） |

---

## 计算逻辑（4 步）

```
Step 1  年用电量
        Final_Annual = Base_Annual[state] + Thermal_Extra + EV_Extra
        Thermal_Extra = BaseThermalLoad[system] × UsageMult[level]
        EV_Extra = 年里程(km) × 0.18 kWh/km

Step 2  月度分布（12 个月）
        SeasonalMult[m] = 1 + CoolAdj[m] + HeatAdj[m]
        ReshapedBase[m] = Base_Annual × BaseShare[m] × SeasonalMult[m]
        NormBase[m] = 归一化回 Base_Annual
        FinalKWh[m] = NormBase[m] + ThermalAlloc[m] + EVAlloc[m]

Step 3  24 小时分布
        AdjShare[h] = BaseHourlyShare[h] × OccMult[h] × PeakMult[h]
        NormShare[h] = AdjShare[h] / Σ(AdjShare)
        FinalHourlyShare[h] = (NonEV_kWh[h] + EV_kWh[h]) / (Final_Annual/365)

Step 4  最终输出（输入电池推荐公式）
        日均用电   = Final_Annual / 365
        白天用电   = 日均 × Σ FinalHourlyShare[H07–H16]
        晚高峰用电 = 日均 × Σ FinalHourlyShare[H17–H20]
        整夜用电   = 日均 × Σ FinalHourlyShare[H17–H06]
```

---

## 参数文件说明（`参数_used/`）

| 文件 | 说明 | 键 |
|------|------|----|
| `AU_base_annual_kwh.csv` | 各州基础年用电量 | `state` |
| `AU_cooling_heating_season_flags.csv` | 各州每月冷暖季标志（0/1） | `state` |
| `AU_hourly_share.csv` | 各州 24h 基准用电分布（AEMO MSATS） | `state` |
| `AU_hvac_thermal_load.csv` | 各暖通系统热负荷基准 kWh | `system` |
| `AU_monthly_share.csv` | 各州月度基准份额 | `state` |
| `AU_usage_level_coefficients.csv` | 各强度等级倍数系数 | `usage_level` |
| `AU_ev_charging_profiles.csv` | 4 种 EV 充电模式的 24h 分布 | `hour` |
| `GLOBAL_ev_params.csv` | EV 能效（0.18 kWh/km）及里程映射 | `parameter` |
| `GLOBAL_occupancy_factors.csv` | 居住模式白天用电倍数 | `occupancy` |
| `Q1–Q5_*_options.csv` | UI 题目标签 → 内部参数映射 | `ui_label` |

> **重新生成参数目录：** `python3 build_params_used.py`

---

## 输出 MD 报告结构

每个案例生成一个 `<文件名>_report.md`，包含：

1. **输入摘要表** — 州、系统、强度、EV、充电模式、居住模式
2. **Step 1** — 年用电量明细（Base / Thermal / EV / Final）
3. **Step 2** — 月度分布表（含季节倍数、月电量、份额、冷暖标记）
4. **Step 3** — 24 小时分布表（NormShare、FinalHourlyShare、标记）
5. **Step 4** — 最终三指标（白天 / 晚高峰 / 整夜 kWh 及占比）

---

## 依赖

- Python 3.8+，无第三方依赖（仅标准库）

```bash
python3 --version   # 确认 3.8+
python3 validate_loadprofile.py --validate   # 快速验证
```
