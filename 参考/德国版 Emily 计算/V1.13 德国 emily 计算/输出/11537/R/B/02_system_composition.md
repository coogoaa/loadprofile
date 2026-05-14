# 系统组成报告（R 改造） · case `11537` · tier `B`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcRH() + pickInverter()
> 模式判定：**R-B** — remaining_capped (0.00) < REMAIN_MIN_RH (2.0)

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `BY` | request.json |
| 既有 PV (existing_input) | 22.00 kWp (已知) | cases.md Q0=20+ |
| SAM3D 满铺 | 9.40 kWp | auto_from_panel_location |
| 屋顶 2D 面积 (mask2d) | 135.36 m² | detect_building.json data.area |
| 方案档 tier | B (base=10.34, boost=13.16, ratio=0.9) | cases.md |
| 触发上调 | 是 (EV>0 或 热泵/电暖) | LoadProfile Q2/Q4 |

## 2. 屋顶面积估算

```
cos(40°)            = 0.7660
roof_area_m2        = mask2d / cos(40°)         = 135.36 / 0.7660 = 176.71 m²
usable_area_m2      = roof_area_m2 × 0.45        = 176.71 × 0.45 = 79.52 m²
max_panels_area     = floor(79.52 / 2.1580) = 36 块
roof_full_kwp_area  = 36 × 0.47 = 16.92 kWp  (2D 估算)
roof_full_kwp_3d    = SAM3D = 9.40 kWp
```

## 3. 屋顶剩余可铺设容量（分支判定）

**判定结果：分支 1.5：用户给了既有 PV，但 SAM3D 满铺 < existing → 用 2D 估算兜底**

```
roof_full_kwp_3d - existing < 0 → SAM3D 已被既有 PV 占满，回退到 2D 估算
remaining = max(0, roof_full_kwp_area - existing) = max(0, 16.92 - 22.00) = 0.00 kWp
remaining_capped = max(0, min(remaining, 25.0 - existing))
                = max(0, min(0.00, 25.0 - 22.00))
                = 0.00 kWp
```

## 4. R-H / R-B 模式判定

```
if existing >= 25.0:                      # 已达硬上限 → 仅加电池
    mode = "R-B"
elif remaining_capped < 2.0:                    # 增量太小 → 仅加电池
    mode = "R-B"
else:                                       # 增量 + 电池
    mode = "R-H"

→ existing = 22.00 kWp, remaining_capped = 0.00 kWp
→ 判定 = **R-B** (remaining_capped (0.00) < REMAIN_MIN_RH (2.0))
```

## 5. 方案目标 + 实装容量

触发条件 trigger = (EV_km > 0) ∨ (hvac ∈ {heat_pump, electric_heat}) → **True**
target_pv_total = 13.16 kWp (boost)

```
R-B 仅加电池：added_kwp = 0, PV_total = existing = 22.00 kWp
```

## 6. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15]  (tier B)
target_kw    = PV_total / SCR_TARGET = 22.00 / 1.3 = 16.92 kW
inv_kw       = 15 kW   (maxed-but-ok)
SCR (容配比) = PV_total / inv_kw = 22.00 / 15 = 1.4667 = 146.67%
校验通过（SCR ≤ 150%）
```

## 7. 电池容量

```
storage_ratio (tier B)  = 0.9
bat_target   = actual_pv × ratio  = 22.00 × 0.9 = 19.80 kWh
              (R-B 用 PV_total = existing；以下使用 actual_pv = inv 削减后的实装容量)
bat_kWh      = ceil_to_spec(max(5, bat_target), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50])
             = 20 kWh
```

## 8. 选板（按年发电量降序选前 N 块）

- actual_panels = 46 块（容配比削减后）
- 选中面板年发电量合计 = 9,166.3 kWh/年（来自 panel_location.json `monthlyHourlyPowerList`）
- 实装 PV = 22.00 kWp

## 9. 结果摘要

| 项 | 值 |
|---|---|
| 模式 | **R-B** |
| 既有 PV | 22.00 kWp |
| 新增 PV (added) | 0.00 kWp (0 块) |
| 实装 PV (actual) | 22.00 kWp (46 块) |
| 逆变器 | 15 kW · SCR 146.67% · maxed-but-ok |
| 电池 | 20 kWh (target 19.80, ratio 0.9) |
