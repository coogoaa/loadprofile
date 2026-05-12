# DE V1.13 德国 Emily 计算

德国光伏 + 电池系统投资回报计算工具，对齐 `de_v3.js` 计算逻辑与德国参数。

---

## 目录结构

```
V1.13 德国 emily 计算/
├── 配置/
│   └── cases.md                   # 输入清单（TSV 区块）
├── 脚本/
│   ├── download_data.py           # GIS 数据下载（复用 V1.7）
│   ├── de_params.py               # DE 全部参数（16 州 / HVAC / 方案档 / 经济）
│   ├── parse_cases.py             # 解析 cases.md
│   ├── de_load_profile.py         # 步骤 1：Load Profile（Q1-Q5 → 年/月/小时用电）
│   ├── de_system_composition.py   # 步骤 2：系统组成（R-H/R-B/N + 容配比 + 电池）
│   ├── de_energy_flow.py          # 步骤 3：能量流（12×24 矩阵 + 电池模拟 → SCR/SSR）
│   ├── de_roi_calculation.py      # 步骤 4：ROI（IRR/NPV/Payback）
│   └── run_all_de.sh              # 一键运行脚本
├── 输出/
│   └── {case_id}/
│       ├── 01_load_profile.json / .md
│       ├── R/ 或 N/
│       │   ├── 02_system_composition.json / .md
│       │   ├── 03_energy_flow.json / .md
│       │   └── 04_roi.json / .md
└── README.md
```

---

## 快速开始

### 1. 编辑输入清单

打开 `配置/cases.md`，编辑 TSV 代码块：

| case_id | mode | tier | Q1_existing_pv | Q2_hvac | Q3_usage | Q4_ev_km | Q5_ev_time | sam3d_kwp | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| 11075 | RN | B | 5-10 | heat_pump | medium | 10000 | mostly_overnight | - | BY 测试 |

- `mode`: `R` 改造 / `N` 全新建 / `RN` 两份都出
- `tier`: `A` 经济 / `B` 标准 / `C` 高端
- `Q1-Q5`: 对应 LoadProfile 问题；`-` 或空 = 跳过（走默认值）
- `sam3d_kwp`: 可选覆盖 SAM3D 满铺 kWp；`-` 自动从 `panel_location.json` 计算

从 Excel/Numbers 复制整片表格（含表头）替换代码块内容即可。

### 2. 一键运行

```bash
cd 脚本
chmod +x run_all_de.sh
./run_all_de.sh ../配置/cases.md [数据目录] [输出目录]
```

示例：

```bash
./run_all_de.sh ../配置/cases.md ../../../V1.7 测试/测试数据 ../输出
```

### 3. 查看结果

每个 case 输出到 `输出/{case_id}/`：

```
输出/11075/
├── 01_load_profile.json          # 机器读：年/月/小时用电
├── 01_load_profile.md            # 人读：公式 + 中间变量
├── R/                            # 改造场景
│   ├── 02_system_composition.json / .md
│   ├── 03_energy_flow.json / .md
│   └── 04_roi.json / .md
└── N/                            # 新建场景（mode=RN 才会有）
    └── ...
```

---

## 计算流程

### 步骤 0：解析输入

`parse_cases.py` → 从 `cases.md` 提取 TSV 区块 → 校验 → 结构化 case 列表

### 步骤 1：Load Profile（用电曲线）

`de_load_profile.py` → 对齐 `de_v3.js calcLoad()`

**输入**：`state`（来自 request.json）+ Q2（HVAC）+ Q3（使用强度）+ Q4（EV 里程）+ Q5（EV 充电时段）

**输出**：
- 年用电 `final` = `BASE[state] + t_ext + ev_ext`
- 月度分布 `fkm[12]`（含 HVAC 月度乘子 `cmm`/`hmm`）
- 小时分布 `fkd[24]`（含占空比 `occ_v` + 峰乘子 `cpm`/`hpm`）
- 时段聚合：白天 / 傍晚高峰 / 整夜

**报告**：`01_load_profile.md`（含完整公式推导 + 中间变量表 + 自检）

### 步骤 2：系统组成

`de_system_composition.py` → 对齐 `de_v3.js calcRH()` / `calcN()` / `pickInverter()`

**R 改造模式**：
- 分支判定（4 分支）：用户已知 PV / 用户跳过（分支 2 反推）+ SAM3D vs 2D 兜底
- R-H vs R-B 判定：`existing >= 25` 或 `remaining_capped < 2` → R-B
- 容配比校验：目标 130%，最大 150%，超限削减面板
- 电池选型：`PV_total × ratio` → `ceil_to_spec([5,6.5,9.6,10,13.5,16,20,25,30,35,40,45,50])`

**N 全新建模式**：
- 目标容量：`tier.base` 或 `tier.boost`（触发条件：EV>0 或 热泵/电暖）
- 屋顶物理约束：`min(target, SAM3D)`，向下取整到整块面板
- 容配比 + 电池同 R

**输出**：`PV_total` / `inv_kw` / `bat_kWh` / 选板列表（按年发电量降序）

**报告**：`02_system_composition.md`（分支推导 + 容配比削减 + 选板）

### 步骤 3：能量流

`de_energy_flow.py` → 12×24 月度小时矩阵 + 电池模拟

**发电矩阵**：`gen[m][h] = Σ_selected_panel.monthlyHourlyPowerList[m][h]`

**用电矩阵**：`load[m][h] = fkm[m]/days[m] × (fkd[h] / davg)`

**电池模拟（日循环）**：
- `usable_capacity = bat × DoD = 0.9`
- `RTE = 0.95`
- 逐小时：`direct = min(gen, load)` / `charge = min(surplus, usable - soc)` / `discharge = min(deficit, soc × RTE)`

**输出**：`SCR`（自用率）/ `SSR`（自给率）/ 馈网 / 购电

**报告**：`03_energy_flow.md`（12×24 矩阵表 + 月度汇总 + 自检）

### 步骤 4：ROI

`de_roi_calculation.py` → DE €参数 + 现金流模型

**成本**（R 模式仅算 `added_kwp`）：
- PV：`550 €/kWp`
- 逆变器：`330 €/kW`
- 电池：`400 €/kWh`
- GST：0%

**现金流（20 年）**：
```
baseline_cost[t] = load_total × 0.35 × (1+0.02)^(t-1) + 0.7×365
remain_cost[t]   = import × 0.35 × (1+0.02)^(t-1) + 0.7×365
export_income[t] = export × 0.07
saving[t]        = baseline_cost - remain_cost + export_income
cf[0]            = -sysCost
cf[t]            = saving[t]
```

**指标**：
- IRR（Newton 迭代 + 二分 fallback）
- NPV @ 3.5%
- Payback（线性插值）

**报告**：`04_roi.md`（成本明细 + 年现金流表 + 指标）

---

## 参数来源

所有 DE 参数在 `de_params.py` 中集中管理，来源：

- `参考/德国版 Emily 计算/德国参数/DE_基础参数.md`
- `参考/德国版 Emily 计算/德国参数/DE_预设各州年用电量.md`
- `参考/德国版 Emily 计算/德国参数/DE_兜底年发电系数.md`
- `参考/德国版 Emily 计算/德国参数/DE_月度比例.md`
- `参考/德国版 Emily 计算/德国参数/DE_小时比例.md`
- `参考/德国版 Emily 计算/德国参数/DE_暖通空调热负荷.md`
- `参考/德国版 Emily 计算/德国参数/DE_用电强度系数.md`
- `参考/德国版 Emily 计算/德国参数/GLOBAL_occupancy_factors.md`
- `参考/德国版 Emily 计算/德国参数/GLOBAL_ev_params.md`
- `参考/20260415-LoadProfile 验证/tools/de_v3.js`

---

## 单步运行

如需单独运行某一步：

```bash
# 步骤 1
python3 de_load_profile.py --cases ../配置/cases.md --data-dir [数据目录] --output-dir [输出目录]

# 步骤 2
python3 de_system_composition.py --cases ../配置/cases.md --data-dir [数据目录] --output-dir [输出目录]

# 步骤 3
python3 de_energy_flow.py --cases ../配置/cases.md --data-dir [数据目录] --output-dir [输出目录]

# 步骤 4
python3 de_roi_calculation.py --cases ../配置/cases.md --output-dir [输出目录] --years 20
```

---

## 测试案例

`配置/cases.md` 默认包含 3 个测试案例：

| case_id | mode | tier | 说明 |
|---|---|---|---|
| 11075 | RN | B | BY 巴伐利亚，含既有 PV，热泵 + EV，触发条件命中 |
| 5421 | N | B | 纯新建测试（无既有 PV） |
| 6219 | R | A | 大屋顶老系统（既有 PV 20+ kWp） |

运行结果（示例）：

```
11075/R: cost=€12,720 IRR=21.25% NPV=€29,445 payback=4.80年
11075/N: cost=€16,856 IRR=16.05% NPV=€25,962 payback=6.19年
```

---

## 注意事项

1. **数据依赖**：`download_data.py` 需要访问 GIS 后端，确保网络通畅
2. **SAM3D 满铺**：推荐在 `cases.md` 中留空 `sam3d_kwp`，脚本会自动从 `panel_location.json` 计算
3. **Q1 映射**：`under5` → 4 kWp / `5-10` → 7 / `10-15` → 12 / `15-20` → 17 / `20+` → 22
4. **分支 2 封顶**：R-H 分支 2 反推 `existing = SAM3D × 0.45`，封顶 `13.16 kWp`（v3 新增）
5. **PV 硬上限**：户用 PV 必须 ≤ 25 kWp
6. **容配比**：目标 130%，最大 150%，超限削减面板（保留逆变器）
