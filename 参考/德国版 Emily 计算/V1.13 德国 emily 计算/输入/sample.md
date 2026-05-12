# DE V1.13 计算输入样例

> 本文档为输入模板样例，包含多个典型场景。
> 复制整个 TSV 代码块到 `配置/cases.md` 中使用。

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

## 输入样例（TSV）

```tsv
case_id	mode	tier	Q1_existing_pv	Q2_hvac	Q3_usage	Q4_ev_km	Q5_ev_time	sam3d_kwp	备注
11075	RN	B	5-10	heat_pump	medium	10000	mostly_overnight	-	BY 巴伐利亚含既有 PV，热泵+EV，触发条件命中
5421	N	B	-	heat_pump	medium	0	-	-	纯新建测试，无既有 PV，热泵无 EV
6219	R	A	20+	air_con	high	15000	mixed_day_and_night	-	大屋顶老系统，既有 PV 20+ kWp，空调+EV
10001	R	C	10-15	no_system	medium	0	-	-	无暖通无 EV，C 档高端方案
10002	RN	B	under5	heat_pump	high	25000	solar_optimized	-	小屋顶热泵，高用电，大里程，光伏优化充电
10003	N	A	-	air_con	low	5000	mostly_overnight	-	新建小系统，空调，低用电，小里程
10004	R	B	15-20	electric_heat	very_high	20000	mixed_day_and_night	-	电暖，高用电，大里程
10005	N	C	-	no_system	medium	0	-	-	纯新建 C 档，无暖通无 EV
```

---

## 场景说明

### 场景 1：11075 - 巴伐利亚改造 + 热泵 + EV
- **模式**：RN（双方案对比）
- **既有 PV**：5-10 kWp（映射为 7 kWp）
- **HVAC**：热泵（触发条件）
- **用电强度**：中等
- **EV**：10000 km/年，夜间充电
- **预期**：触发 tier B 上调（10.34→13.16 kWp）

### 场景 2：5421 - 纯新建 + 热泵
- **模式**：N（全新建）
- **既有 PV**：无（`-`）
- **HVAC**：热泵（触发条件）
- **用电强度**：中等
- **EV**：无
- **预期**：触发 tier B 上调

### 场景 3：6219 - 大屋顶老系统
- **模式**：R（改造）
- **既有 PV**：20+ kWp（映射为 22 kWp）
- **HVAC**：空调
- **用电强度**：高
- **EV**：15000 km/年，混合充电
- **预期**：A 档经济方案，大容量系统

### 场景 4：10001 - 无暖通无 EV
- **模式**：R（改造）
- **既有 PV**：10-15 kWp（映射为 12 kWp）
- **HVAC**：无
- **用电强度**：中等
- **EV**：无
- **预期**：C 档高端方案，无触发条件

### 场景 5：10002 - 小屋顶热泵 + 高用电 + 大里程
- **模式**：RN（双方案对比）
- **既有 PV**：under5 kWp（映射为 4 kWp）
- **HVAC**：热泵（触发条件）
- **用电强度**：高
- **EV**：25000 km/年，光伏优化充电
- **预期**：触发 tier B 上调，高用电负荷

### 场景 6：10003 - 新建小系统
- **模式**：N（全新建）
- **既有 PV**：无
- **HVAC**：空调
- **用电强度**：低
- **EV**：5000 km/年，夜间充电
- **预期**：A 档经济方案

### 场景 7：10004 - 电暖 + 高用电
- **模式**：R（改造）
- **既有 PV**：15-20 kWp（映射为 17 kWp）
- **HVAC**：电暖（触发条件）
- **用电强度**：极高
- **EV**：20000 km/年，混合充电
- **预期**：触发 tier B 上调，极高用电负荷

### 场景 8：10005 - 纯新建 C 档
- **模式**：N（全新建）
- **既有 PV**：无
- **HVAC**：无
- **用电强度**：中等
- **EV**：无
- **预期**：C 档高端方案，无触发条件

---

## 使用方法

1. 复制上述 TSV 代码块
2. 打开 `配置/cases.md`
3. 找到 ```tsv 代码块
4. 粘贴替换内容
5. 运行 `./run_all_de.sh`

---

## 注意事项

1. **Tab 分隔**：列之间必须用 Tab 键分隔，不能用空格
2. **必填字段**：`case_id`、`mode`、`tier` 必须填写
3. **可选字段**：`-` 或空字符串表示跳过（走默认值）
4. **触发条件**：热泵/电暖 + EV 会触发 tier B/C 目标容量上调
5. **SAM3D 覆盖**：`sam3d_kwp` 留空则自动从 `panel_location.json` 计算
