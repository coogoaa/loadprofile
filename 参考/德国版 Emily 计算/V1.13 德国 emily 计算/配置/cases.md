# DE V1.13 计算输入清单

> 每行 1 个 case。**只编辑下面的 TSV 代码块**（其它内容是规范说明）。
> `-` 或 空字符串 = 跳过 → 走 `de_v3.js` 的默认值。
> 在 Excel/Numbers 里编辑后，整片复制（连表头）替换代码块中的内容；TAB 分隔自然保留。

---

## 字段规范

| 列 | 必填 | 取值 | 说明 |
|---|---|---|---|
| `case_id` | ✅ | 数字 ID，如 `11075` | 驱动 `download_data.py` 下载和 `request.json` 定位 |
| `mode` | ✅ | `R` / `N` / `RN` | R=改造（自动判 R-H 或 R-B）<br>N=全新建<br>RN=两份都出（双方案对比） |
| `tier` | ✅ | `A` / `B` / `C` | 方案档：A 经济 / B 标准 / C 高端 |
| `Q1_existing_pv` | ❎ | `under5` / `5-10` / `10-15` / `15-20` / `20+` / `-` | 既有 PV 容量区间，映射为 4/7/12/17/22 kWp；`-` 走 R-H 分支 2 估算（反推 SAM3D×0.45，封顶 13.16） |
| `Q2_hvac` | ❎ | `no_system` / `air_con` / `heat_pump` / `electric_heat` / `-` | 冷暖系统；`-` 视为 no_system（无暖通负荷） |
| `Q3_usage` | ❎ | `low` / `medium` / `high` / `very_high` / `-` | 使用强度；`-` 默认 `medium`（am=1.0） |
| `Q4_ev_km` | ❎ | `0` / `5000` / `10000` / `15000` / `20000` / `25000` / `-` | EV 年里程；`-` 默认 0 |
| `Q5_ev_time` | ❎ | `mostly_overnight` / `mixed_day_and_night` / `mostly_daytime` / `solar_optimized` / `-` | EV 充电时段；`-` 默认 `mostly_overnight` |
| `sam3d_kwp` | ❎ | 数字（kWp）/ `-` | **可选覆盖** SAM3D 满铺容量；`-` 自动用 `len(panel_location.json) × 0.470`（推荐留空） |
| `备注` | ❎ | 自由文本 | 不参与计算 |

### 触发上调条件（与 `de_v3.js` 一致）
当 `Q4_ev_km > 0` 或 `Q2_hvac ∈ {heat_pump, electric_heat}` 时，`tier B` 目标 10.34→13.16，`tier C` 目标 13.16→15.04。

---

## 输入清单（TSV）

> ⚠ 不要改动这片 ```tsv 代码块外的内容。只编辑代码块内表格。

```tsv
case_id	mode	tier	Q1_existing_pv	Q2_hvac	Q3_usage	Q4_ev_km	Q5_ev_time	sam3d_kwp	备注
11075	RN	B	5-10	heat_pump	medium	10000	mostly_overnight	-	BY 巴伐利亚含既有 PV，触发条件命中
5421	N	B	-	heat_pump	medium	0	-	-	纯新建测试
6219	R	A	20+	air_con	high	15000	mixed_day_and_night	-	大屋顶老系统
```

---

## 解析与执行

```bash
cd 脚本
# 端到端：下载 → LoadProfile → 系统组成 → 能量流 → ROI
./run_all_de.sh ../配置/cases.md
```

每个 case 输出到 `输出/{case_id}/`：

```
输出/11075/
├── R/                              # 改造场景
│   ├── 01_load_profile.json
│   ├── 01_load_profile.md          # 详细公式 + 中间变量
│   ├── 02_system_composition.json
│   ├── 02_system_composition.md
│   ├── 03_energy_flow.json
│   ├── 03_energy_flow.md
│   ├── 04_roi.json
│   └── 04_roi.md
└── N/                              # 新建场景（mode=RN 才会有）
    └── ... 同上
```
