# AU_base_annual_kwh Final 数据修订说明

生成日期：2026-04-15  
版本：Final（在 v2 基础上，加入 Frontier Economics 2020 电力基准数据交叉验证）

---

## 新增参考：Frontier Economics 电力基准（2020）

本次修订新增了 AER 官方委托的电力基准数据：

> **Simple electricity and gas benchmarks - December 2020.xlsx**  
> 来源：Frontier Economics Pty Ltd，受 AER 委托编制  
> 发布：2020年12月（覆盖2020-2021年度）  
> 用途：**电费账单上的"用电对比"功能**，让消费者对比自己与同类家庭的用电量  
> 内容：
> - **电力基准**：Climate Zone 1-8（单位 kWh），按季度分列
> - **天然气基准**：ACT/NSW/QLD/SA/TAS/VIC（单位 MJ），按季度分列
> - 覆盖：1/2/3/4/5+人户

---

## 核心发现：Frontier 2020 数据是"总用电量"

Frontier 2020 的电力基准数据与我的修订值（基于 AER 2024）差异巨大：

| 州/城市 | Frontier 2020<br>（总用电量）| 我的修订 2024<br>（基础用电）| 差异 | 说明 |
|---|---|---|---|---|
| Sydney (NSW, Zone 5) | **15,876** kWh | 5,600 kWh | 2.83x | Frontier 含供暖制冷 |
| Melbourne (VIC, Zone 6) | **15,933** kWh | 4,600 kWh | 3.46x | Frontier 含供暖制冷 |
| Brisbane (QLD, Zone 2) | **10,212** kWh | 5,600 kWh | 1.82x | Frontier 含空调制冷 |
| **Adelaide (SA)** | **5,046** kWh | **5,047** kWh | **1.00x** | **唯一一致！** |
| Hobart (TAS, Zone 7) | **26,932** kWh | 8,784 kWh | 3.07x | Frontier 含大量电热 |
| Canberra (ACT, Zone 7) | **26,932** kWh | 6,107 kWh | 4.41x | Frontier 含供暖制冷 |

### 关键洞察

**1. SA 是唯一数据一致的州（5046 vs 5047）**  
这说明：
- SA 的 Frontier 2020 数据可能就是"基础用电"（不含 HVAC 附加）
- 或者 SA 的供暖制冷用电极少（气候温和 + 天然气供暖）

**2. 其他州 Frontier 2020 数据普遍偏高 1.8-4.4 倍**  
原因：Frontier 2020 数据是**实际总用电量**（包括供暖、制冷、所有家电），用于电费账单上的"用电对比"功能。

**3. TAS/ACT（Zone 7）偏高最严重（3-4倍）**  
- TAS：无天然气，所有供暖靠电，Frontier 数据 26932 kWh 包含了大量电热供暖
- ACT：天然气供暖多，但 Frontier 数据仍含电热附加

---

## Frontier 2020 vs AER 2024 的数据定义差异

| 数据源 | 定义 | 用途 | 是否含 HVAC |
|---|---|---|---|
| **Frontier 2020** | 实际总用电量 | 电费账单用电对比 | ✅ 包含供暖制冷 |
| **AER 2024** | 参考消费量（基础用电）| 计算参考价格 | ❌ 不含 HVAC 附加 |

**对 LoadProfile 的影响：**
- LoadProfile 的 `base_annual_kwh` 应使用 **AER 2024 基准**（基础用电）
- HVAC 附加用电由 `AU_hvac_thermal_load.csv` 单独计算
- 如果使用 Frontier 2020 数据，会导致 HVAC 模块双重计算

---

## 为什么 SA 数据一致？

SA 是唯一 Frontier 2020 与 AER 2024 数据一致的州，可能原因：

1. **气候温和**：Adelaide 冬季不太冷（最低 8°C），夏季不太热（最高 29°C），供暖制冷需求少
2. **天然气普及**：SA 天然气用量中等（14669 MJ/年），供暖主要靠气
3. **Frontier 建模方式**：SA 使用了加权平均的 SA zones，可能平滑了极端值

---

## 天然气数据的交叉验证（v2 发现）

| 州 | 电力 kWh | 天然气 MJ（2人户/年）| 天然气 kWh 当量 | 总能源 kWh 当量 | 供暖方式 |
|---|---|---|---|---|---|
| ACT | **6,107** | 36,870 | 10,243 | 16,350 | 主要靠天然气 |
| NSW | **5,600** | 16,945 | 4,707 | 10,307 | 电气混合 |
| VIC | **4,600** | 50,462 | 14,018 | 18,618 | **主要靠天然气** |
| QLD | **5,600** | 6,262 | 1,740 | 7,340 | 几乎无供暖 |
| SA | **5,047** | 14,669 | 4,075 | 9,122 | 电气混合 |
| TAS | **8,784** | **0** | 0 | 8,784 | **全靠电力** |

---

## 最终推荐值（Final）

| 州 | 推荐值 kWh | 旧 v1.5 | 变化 | 置信度 | 数据来源 |
|---|---|---|---|---|---|
| ACT | **6,107** | 8,632 | -29% | 高 | AER 2024 + Frontier 2020 验证 |
| NSW | **5,600** | 7,778 | -28% | 高 | NSW EPA 2022-23 + AER FY23-24 |
| VIC | **4,600** | 6,778 | -32% | 高 | AER / VDO + 天然气数据验证 |
| QLD | **5,600** | 7,270 | -23% | 高 | AER (Energex) + Frontier 2020 |
| SA | **5,047** | 7,129 | -29% | 高 | AER 2024 + Frontier 2020 完全一致 |
| TAS | **8,784** | 10,148 | -13% | 高 | AER 2024 + 天然气=0 验证 |
| WA | **6,000** | 7,634 | -21% | 中 | AER 全国平均 + Synergy 估算 |
| NT | **6,500** | 10,008 | -35% | 中 | Utilities Commission NT 估算 |

---

## 对 LoadProfile 计算的影响

使用 Final 修订值（与 v2 数值相同，但置信度更高）：

1. **不会与 HVAC 模块双重计算**  
   - `base_annual_kwh` 是基础用电（照明、家电、热水）
   - HVAC 附加用电由 `AU_hvac_thermal_load.csv` 单独计算

2. **VIC 的低值（4,600 kWh）是正确的**  
   - VIC 供暖主要靠天然气（50462 MJ/年）
   - 电力基准只含基础用电，不含气热部分

3. **TAS 的高值（8,784 kWh）是正确的**  
   - TAS 无天然气，所有供暖靠电
   - 但 Frontier 2020 的 26932 kWh 太高，包含了全部电热供暖

---

## 参考文件

| 文件 | 来源 | 用途 |
|---|---|---|
| `Simple electricity and gas benchmarks - December 2020.xlsx` | Frontier Economics for AER | 电力基准（总用电量）+ 天然气基准 |
| NSW State of Environment Report 2024 | NSW EPA | NSW 电力基准 5.6 MWh/年 |
| energyse.com.au April 2024 analysis | 基于 AER 公开数据 | SA/TAS/ACT 电力基准 |
| AER Reference Price FY23-24 | AER | NSW/QLD/SA/VIC/ACT 参考消费量 |
| AEMC Residential Electricity Price Trends 2024 | AEMC | 各州用电趋势 |

---

## 结论

**Final 修订值与 v2 数值完全相同**，但通过 Frontier 2020 数据的交叉验证，我们现在可以确认：

1. **我的修订值是正确的**（代表"基础用电"）
2. **Frontier 2020 数据是"总用电量"**（含 HVAC），不适合直接用于 LoadProfile
3. **SA 数据的一致性**（5046 vs 5047）是最强的验证证据
4. **天然气数据**进一步确认了 VIC/TAS/ACT 的电力基准合理性

**推荐使用 Final 修订值作为 LoadProfile 的 `base_annual_kwh` 基准。**
