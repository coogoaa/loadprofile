
R-H 计算流程

# 步骤 0 ：用户输入的既有 PV  容量的选项映射

| 前端选项 | 映射 existing_pv_kwp | 取值理由 |
| --- | --- | --- |
| Under 5 kWp | 4 | 区间中位偏下；DE 早期老系统多在 3–5 |
| 5–10 kWp | 7 | DE 老系统主流段中位 |
| 10–15 kWp | 12 | 中位 |
| 15–20 kWp | 17 | 中位 |
| 20+ kWp | 22 | 因 25 kWp 硬约束，取保守值；避免直接顶到 25 触发 R-B |
| Not sure / 跳过 | null | 走估算逻辑 |

# 步骤 1 ：Load Profile的修正计算

- 涉及的问题和 AU 版相同，计算逻辑也相同，对应参数使用 德国版

# 步骤 2 ：屋顶剩余空间域方案分支
## 屋顶面积估算
1. 2D的面积转为坡面面积估算
- 本次版本使用上游 提供的 3D 数据做估算
数据来源：上游 SAM3 提供的 3D 面积数据。
- 使用到的参数：
德国预设坡度 40°
预设的组件单块面积为：长：1903mm,宽：1134mm,面积 = 1.903 × 1.134 ≈ 2.158，
屋顶面积利用率参数是 0.45
预设组件功率是 0.47kW
- 计算：
roof_area_m2       = mask_2d_area_m2 / cos(40°) ≈ mask_2d_area_m2 × 1.305
usable_area_m2     = roof_area_m2 × 0.45
max_panels_area    = floor(usable_area_m2 / 2.158)
roof_full_kwp_area = max_panels_area × 0.470

2. SAM 3D 估算
这一步的数据来源，也是上游提供的。表示使用 SAM3D 的模型把屋顶铺满 PV 面板后的的估算方式。
roof_full_kwp_3d   = SAM3D 给出的物理满铺 kWp

3. 屋顶剩余可铺设容量
这一步是计算屋顶剩余可铺设的容量，有如下分支:
- 分支 1：用户给了既有 PV，SAM 3D 满铺 至少能铺 1 块

remaining = max(0, roof_full_kwp_3d - existing_pv_kwp)

如果 差值 < 0，使用 2D 面积兜底计算

remaining = max(0, roof_full_kwp_area - existing_pv_kwp)

- 分支 2：用户没填/不知道 既有 PV
remaining = roof_full_kwp_3d × 0.55，
并反推 existing_pv_kwp ≈ roof_full_kwp_3d × 0.45

- 分支 3：用户给了既有 PV，但是 SAM 3D 铺不上去
remaining = max(0, roof_full_kwp_area - existing_pv_kwp)


###  确定走 R-H 还是 R-B 的模式：
- 业务逻辑：
若存量光伏装机容量≥25kWp：
    判定为纯储能升级模式（仅加装电池）
若剩余可新增装机容量＜2.0kWp：
    判定为纯储能升级模式（仅加装电池）
其余场景：
    判定为光储混合扩容模式（新增光伏组件+配套电池）

- 计算公式：

if existing_pv_kwp >= 25:
    mode = "R-B"                       # 已达硬上限，仅加电池
elif remaining_capped < 2.0:
    mode = "R-B"                       # 剩余太小，加板边际收益小
else:
    mode = "R-H"                       # 加板 + 加电池（混合）

### 步骤 R-H 方案  （屋顶剩余 ≥ 2 kWp 且 Existing < 25）

档  默认 target_pv_total    EV / 热泵 / 电取暖任一命中时
A   7.05 kWp    7 kWp（不变）
B   10.34 kWp   13.16 kWp
C   13.16 kWp   15.04 kWp
----
2. 计算公式

```
# 目标增量
target_added = max(0, target_pv_total - existing_pv_kwp)

# 实际增量（受剩余屋顶 + 25 kWp 硬约束限制）
added_kwp_pre = min(target_added, remaining_capped)
remaining_capped = 25 kwp

# 取整到面板数（向下取整保证不超额）
added_panels  = floor(added_kwp_pre / 0.470)
added_kwp     = added_panels × 0.470

# 总容量
PV_total      = existing_pv_kwp + added_kwp
assert PV_total ≤ 25
```
### 步骤 R-B 方案  （屋顶剩余 < 2 kWp 或 Existing ≥ 25 或 R-H 降级）

1. 计算公式
```
Added_kWp = 0
PV_total  = existing_pv_kwp

# 电池目标（A/B/C 三档）
storage_ratio = {A: 0.7, B: 0.9, C: 1.2}[level]
Bat_target_kWh = PV_total × storage_ratio
Bat_kWh        = ceil_to_spec(Bat_target_kWh, spec_battery_kwh, min=5)

-----
新增光伏装机容量 = 0
光伏总装机容量 = 存量光伏装机容量

# 三档方案电池配置目标（经济/标准/高端）
根据所选方案等级，匹配对应储能配比系数：
A档系数0.7、B档系数0.9、C档系数1.2

目标电池容量 = 光伏总装机容量 × 储能配比系数
实际配置电池容量 = 将目标容量按电池标准规格向上取整选型，最低配置容量不低于5kWh
```










