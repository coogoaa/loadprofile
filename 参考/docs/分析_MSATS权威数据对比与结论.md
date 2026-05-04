# MSATS 权威数据对比分析与结论

> 数据来源：AEMO MSATS NSLP (Net System Load Profile), October 2021
> 文档来源：参考/understanding-load-profiles-published-from-msats.pdf
> 对比图表：参考/docs/AU_hourly_profile_3way_comparison.png

---

## 一、MSATS 数据说明

### 1.1 什么是 NSLP

NSLP（Net System Load Profile，净系统负荷曲线）是 AEMO 用于电力市场结算的标准负荷曲线。

**关键限制：NSLP = 总负荷 - 受控负荷（Controlled Load）**

受控负荷主要是**分时热水器（off-peak hot water）**，在深夜低谷电价时段集中运行。

- NSW、SA、QLD(Energex)：NSLP 已剥离受控负荷（Peel-Off 方法）
- VIC、ACT、TAS、QLD(Ergon)：NSLP 使用基础方法，但 VIC/ACT 的受控负荷比例较低

### 1.2 对我们的影响

我们的 LoadProfile 目标是**家庭总用电量**（包含热水器），而 NSLP 排除了受控负荷。

因此：
- **NSLP 不能直接作为我们的基准曲线**
- 但 NSLP 提供了非受控负荷的精确形态，是重要参考

---

## 二、各州数据提取结果

从 MSATS PDF 中提取的各网络 NSLP 数据，聚合为州级曲线：

| 州 | 数据来源 | 峰谷比 | 晚高峰占比(H17-H20) | 白天占比(H07-H16) | 峰值时段 |
|----|---------|--------|-------------------|-----------------|---------|
| NSW | COUNTRYENERGY + ENERGYAUST + INTEGRAL | 5.11x | 29.0% | 42.5% | H17 |
| VIC | CITIPOWER + POWERCOR + TXU + UNITED + VICAGL | 2.87x | 22.5% | 42.0% | H18 |
| QLD | ENERGEX + ERGON1 | 4.08x | 23.8% | 43.6% | H18 |
| SA | UMPLP | 5.85x | 25.0% | 45.7% | H18 |
| TAS | AURORA | 4.34x | 22.4% | 40.8% | H18 |
| ACT | ACTEWAGL | 4.21x | 22.7% | 47.4% | H17 |
| WA | 代理：SA（WA 不在 NEM） | — | — | — | — |
| NT | 代理：QLD（NT 不在 NEM） | — | — | — | — |

---

## 三、三版数据对比结论

### 3.1 v1.5 原始数据的问题（已知）

- VIC/TAS：峰谷比仅 1.20x，完全平坦，明显错误
- NSW/QLD 等：缺少早高峰，形态不完整

### 3.2 v2 Proposed（文献重建）vs MSATS 的差异

| 州 | 主要差异 | 原因分析 |
|----|---------|---------|
| NSW | 晚高峰基本一致(29% vs 29%)，但白天占比偏低(38% vs 43%) | v2 白天压缩过多 |
| VIC | v2 晚高峰明显偏高(29% vs 23%)，白天偏低(38% vs 42%) | NSLP 排除了受控负荷，VIC 受控负荷少，NSLP 接近总负荷 |
| QLD | v2 晚高峰明显偏高(33% vs 24%)，白天偏低(38% vs 44%) | NSLP 排除了 Energex 受控负荷 |
| SA | v2 晚高峰偏高(31% vs 25%)，白天偏低(38% vs 46%) | NSLP 排除了 SACLOAD |
| TAS | v2 晚高峰偏高(29% vs 22%)，白天偏低(37% vs 41%) | TAS 无受控负荷剥离，NSLP 接近总负荷 |
| ACT | v2 晚高峰偏高(30% vs 23%)，白天偏低(37% vs 47%) | ACT 无受控负荷剥离 |

### 3.3 核心发现

**v2 Proposed 系统性地高估了晚高峰、低估了白天用电。**

MSATS 数据显示：
- 白天（H07-H16）占比普遍在 40-47%，远高于 v2 的 37-38%
- 晚高峰（H17-H20）占比在 22-29%，低于 v2 的 29-33%

这说明 v2 的"双峰"形态过于夸张，实际曲线的白天用电比预想的更高。

---

## 四、最终建议

### 4.1 直接使用 MSATS 数据（推荐）

对于 NSW、VIC、QLD、SA、TAS、ACT，**直接使用 MSATS NSLP 数据**作为基准曲线。

理由：
1. 这是 AEMO 官方数据，来自真实智能电表聚合
2. 虽然排除了受控负荷，但受控负荷（热水器）的影响可以通过 LoadProfile 的 HVAC 因子来体现
3. 比 v2 文献重建更准确，比 v1.5 平坦曲线更真实

### 4.2 WA 和 NT 的处理

WA 和 NT 不在 NEM，没有 MSATS 数据：
- **WA**：使用 SA 数据作为代理（地中海气候相似）
- **NT**：使用 QLD 数据作为代理（热带气候相似）

### 4.3 是否需要更新 v2 Proposed CSV？

**是的，建议用 MSATS 权威数据替换 v2 Proposed。**

已生成权威数据文件：`参考/docs/presets/AU_hourly_share_MSATS_authoritative.csv`

该文件应作为新的 `AU_hourly_share.csv` 使用。

---

## 五、数据文件说明

| 文件 | 内容 | 建议用途 |
|------|------|---------|
| `AU_hourly_share.csv` | v1.5 原始数据（VIC/TAS 平坦，有问题） | 废弃 |
| `AU_hourly_share_v2_proposed.csv` | 文献重建（形态合理但白天偏低） | 参考 |
| `AU_hourly_share_MSATS_authoritative.csv` | AEMO MSATS NSLP 权威数据 | **采用** |
