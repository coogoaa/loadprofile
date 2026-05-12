# 系统组成报告（R 改造） · case `6219` · tier `A`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcRH() + pickInverter()
> 模式判定：**R-H** — existing < 25.0 且 remaining_capped ≥ 2.0

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `BY` | request.json |
| 既有 PV (existing_input) | 22.00 kWp (已知) | cases.md Q1=20+ |
| SAM3D 满铺 | 22.09 kWp | auto_from_panel_location |
| 屋顶 2D 面积 (mask2d) | 313.68 m² | detect_building.json data.area |
| 方案档 tier | A (base=7.05, boost=7.05, ratio=0.7) | cases.md |
| 触发上调 | 是 (EV>0 或 热泵/电暖) | LoadProfile Q2/Q4 |

## 2. 屋顶面积估算

```
cos(40°)            = 0.7660
roof_area_m2        = mask2d / cos(40°)         = 313.68 / 0.7660 = 409.49 m²
usable_area_m2      = roof_area_m2 × 0.45        = 409.49 × 0.45 = 184.27 m²
max_panels_area     = floor(184.27 / 2.1580) = 85 块
roof_full_kwp_area  = 85 × 0.47 = 39.95 kWp  (2D 估算)
roof_full_kwp_3d    = SAM3D = 22.09 kWp
```

## 3. 屋顶剩余可铺设容量（分支判定）

**判定结果：分支 3：用户给了既有 PV，SAM3D 与 existing 差 < 1 块 → 用 2D 估算**

```
roof_full_kwp_3d - existing < 0.47（差 < 1 块）→ SAM3D 估算不准，回退 2D
remaining = max(0, roof_full_kwp_area - existing) = 17.95 kWp
remaining_capped = max(0, min(remaining, 25.0 - existing))
                = max(0, min(17.95, 25.0 - 22.00))
                = 3.00 kWp
```

## 4. R-H / R-B 模式判定

```
if existing >= 25.0:                      # 已达硬上限 → 仅加电池
    mode = "R-B"
elif remaining_capped < 2.0:                    # 增量太小 → 仅加电池
    mode = "R-B"
else:                                       # 增量 + 电池
    mode = "R-H"

→ existing = 22.00 kWp, remaining_capped = 3.00 kWp
→ 判定 = **R-H** (existing < 25.0 且 remaining_capped ≥ 2.0)
```

## 5. 方案目标 + 实装容量

触发条件 trigger = (EV_km > 0) ∨ (hvac ∈ {heat_pump, electric_heat}) → **True**
target_pv_total = 7.05 kWp (boost)

```
target_added  = max(0, target_pv_total - existing)
              = max(0, 7.05 - 22.00) = 0.00 kWp
added_kwp_pre = min(target_added, remaining_capped)
              = min(0.00, 3.00) = 0.00 kWp
added_panels  = floor(0.00 / 0.47) = 0 块
added_kwp     = 0 × 0.47 = 0.00 kWp
PV_total      = existing + added_kwp = 22.00 + 0.00 = 22.00 kWp
assert PV_total ≤ 25.0  → ✅
```

## 6. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15]  (tier A)
target_kw    = PV_total / SCR_TARGET = 22.00 / 1.3 = 16.92 kW
inv_kw       = 15 kW   (maxed-but-ok)
SCR (容配比) = PV_total / inv_kw = 22.00 / 15 = 1.4667 = 146.67%
校验通过（SCR ≤ 150%）
```

## 7. 电池容量

```
storage_ratio (tier A)  = 0.7
bat_target   = actual_pv × ratio  = 22.00 × 0.7 = 15.40 kWh
              (R-B 用 PV_total = existing；以下使用 actual_pv = inv 削减后的实装容量)
bat_kWh      = ceil_to_spec(max(5, bat_target), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50])
             = 16 kWh
```

## 8. 选板（按年发电量降序选前 N 块）

- actual_panels = 47 块（容配比削减后）
- 选中面板年发电量合计 = 24,648.0 kWh/年（来自 panel_location.json `monthlyHourlyPowerList`）
- 实装 PV = 22.00 kWp

## 9. 结果摘要

| 项 | 值 |
|---|---|
| 模式 | **R-H** |
| 既有 PV | 22.00 kWp |
| 新增 PV (added) | 0.00 kWp (0 块) |
| 实装 PV (actual) | 22.00 kWp (47 块) |
| 逆变器 | 15 kW · SCR 146.67% · maxed-but-ok |
| 电池 | 16 kWh (target 15.40, ratio 0.7) |
