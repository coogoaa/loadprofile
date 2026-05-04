# AU_base_annual_kwh 数据修订说明

生成日期：2026-04-15  
作者：Kiro（基于权威数据源搜索整理）

---

## 结论：旧数据整体偏高 20–35%

v1.5 参数汇总中的数值来源不明，与多个权威数据源相比**系统性偏高**，尤其是 NT（+54%）、ACT（+41%）、VIC（+47%）。主要原因推测：

1. **混入了多人大家庭数据**（如 5+ 人户），而非"典型住宅"（2-3 人户）
2. **NT 数据可能包含了原住民社区大家庭**（平均 6-8 人/户）
3. **ACT 数据可能含供暖用气折算为电当量**的错误

---

## 各州修订数据与来源

| 州/领地 | 旧值 (v1.5) | 新值 (修订) | 变化 | 主要数据来源 |
|---------|------------|------------|------|------------|
| ACT | 8,632 | **6,107** | -29% | AER benchmark（EvoEnergy 网络，2024）|
| NSW | 7,778 | **5,600** | -28% | NSW EPA 官方报告 2022-23；AER FY23-24 |
| VIC | 6,778 | **4,600** | -32% | AER / Victorian Default Offer 基准 |
| QLD | 7,270 | **5,600** | -23% | AER benchmark（Energex/SEQ 网络）|
| SA | 7,129 | **5,047** | -29% | AER benchmark（energyse.com.au 2024 分析）|
| TAS | 10,148 | **8,784** | -13% | AER benchmark（Hobart 2人户，energyse.com.au）|
| WA | 7,634 | **6,000** | -21% | AER 全国日均用量推算；Synergy 估算 |
| NT | 10,008 | **6,500** | -35% | Utilities Commission NT；行业估算 |

---

## 数据来源说明

### 权威来源（按可信度排序）

1. **AER（Australian Energy Regulator）**  
   - 发布各州"参考消费量"（Reference Consumption），用于计算参考价格  
   - NSW FY23-24 参考账单 ≈ $1,827/年，对应约 5,600 kWh（按 ~32c/kWh）  
   - SA 2人户基准：5,047 kWh/年（energyse.com.au 直接引用 AER 数据）  
   - ACT 2人户基准：6,107 kWh/年（季节合计：1200+1468+2042+1397）  
   - Hobart 2人户基准：8,784 kWh/年  

2. **NSW EPA State of Environment Report 2024**  
   - 明确指出：NSW 平均住宅用电约 **5.6 MWh/年**（2022-23 数据）  
   - 来源：[NSW SOE 2024](https://www.soe.epa.nsw.gov.au/all-themes/people-and-industry/energy-consumption-2024)

3. **AEMC Residential Electricity Price Trends 2021**  
   - 覆盖 NEM 各州（不含 WA、NT）  
   - 提供了各州典型家庭类型和年用电量  

4. **energyse.com.au（2024年4月分析）**  
   - 基于 AER 公开数据，分析了 7,612 个电力套餐  
   - 直接引用了各州 AER 基准消费量  

---

## 关键背景：为什么 TAS 用电量最高？

塔斯马尼亚是全国用电量最高的州，原因：
- **气候寒冷**：冬季供暖需求大
- **无天然气管网**：几乎所有供暖、热水均依赖电力
- **水电便宜**：历史上电价低，用电习惯较粗放
- AER 数据确认：Hobart 2人户 ≈ 8,784 kWh/年，比全国平均高约 67%

---

## 关于 WA 和 NT 的说明

WA 和 NT **不在 NEM（国家电力市场）体系内**，AER 不发布这两个地区的参考消费量。数据来源：
- **WA**：参考 Synergy（西澳唯一零售商）公开信息及行业估算，约 6,000 kWh/年（Perth 典型 2-3 人户）
- **NT**：参考 Utilities Commission NT 报告及 Jacana Energy 服务区估算，约 6,500 kWh/年（Darwin 典型住宅）

---

## 使用建议

1. **LoadProfile 计算中**，建议使用新修订值作为 `base_annual_kwh` 基准
2. 新值代表**典型 2-3 人户**的年用电量（不含 HVAC、EV 等附加负荷）
3. 如需覆盖更大家庭，可通过 `usage_level_coefficients` 参数进行倍率调整
4. TAS 的高用电量主要来自电热，在 HVAC 模块中需注意避免双重计算

---

## 参考链接

- [NSW State of Environment 2024 - Energy Consumption](https://www.soe.epa.nsw.gov.au/all-themes/people-and-industry/energy-consumption-2024)
- [energyse.com.au - Residential Electricity Prices Apr 2024](https://energyse.com.au/research/electricity-prices-apr-2024)
- [energyse.com.au - Average Electricity Bill Canberra](https://energyse.com.au/utilities/average-electricity-bill/canberra)
- [AEMC - Residential Electricity Price Trends 2024](https://www.aemc.gov.au/market-reviews-advice/residential-electricity-price-trends-2024)
- [AER - Reference Price Information](https://www.aer.gov.au/consumers/your-electricity-bill/reference-price)
