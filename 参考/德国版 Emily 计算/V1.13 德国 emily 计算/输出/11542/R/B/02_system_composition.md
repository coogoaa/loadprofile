# 系统组成报告（R 改造） · case `11542` · tier `B`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcRH() + pickInverter()
> 模式判定：**R-H** — existing < 25.0 且 remaining_capped ≥ 2.0

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `BY` | request.json |
| 既有 PV (existing_input) | -1.00 kWp (跳过) | 未提供（走 R-H 分支 2 估算） |
| SAM3D 满铺 | 9.40 kWp | auto_from_panel_location |
| 屋顶 2D 面积 (mask2d) | 135.36 m² | detect_building.json data.area |
| 方案档 tier | B (base=10.34, boost=13.16, ratio=0.9) | cases.md |
| 触发上调 | 否 (EV>0 或 热泵/电暖) | LoadProfile Q2/Q4 |

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

**判定结果：分支 2：用户跳过既有 PV，反推 existing = SAM3D × 0.45（封顶 13.16 kWp）**

```
remaining       = SAM3D × 0.55 = 9.40 × 0.55 = 5.17 kWp
existing_raw    = SAM3D × 0.45 = 4.23 kWp
existing (封顶) = min(4.23, 13.16) = 4.23 kWp  （未触发封顶）
remaining_capped = max(0, min(remaining, 25.0 - existing))
                = max(0, min(5.17, 25.0 - 4.23))
                = 5.17 kWp
```

## 4. R-H / R-B 模式判定

```
if existing >= 25.0:                      # 已达硬上限 → 仅加电池
    mode = "R-B"
elif remaining_capped < 2.0:                    # 增量太小 → 仅加电池
    mode = "R-B"
else:                                       # 增量 + 电池
    mode = "R-H"

→ existing = 4.23 kWp, remaining_capped = 5.17 kWp
→ 判定 = **R-H** (existing < 25.0 且 remaining_capped ≥ 2.0)
```

## 5. 方案目标 + 实装容量

触发条件 trigger = (EV_km > 0) ∨ (hvac ∈ {heat_pump, electric_heat}) → **False**
target_pv_total = 10.34 kWp (base)

```
target_added  = max(0, target_pv_total - existing)
              = max(0, 10.34 - 4.23) = 6.11 kWp
added_kwp_pre = min(target_added, remaining_capped)
              = min(6.11, 5.17) = 5.17 kWp
added_panels  = floor(5.17 / 0.47) = 11 块
added_kwp     = 11 × 0.47 = 5.17 kWp
PV_total      = existing + added_kwp = 4.23 + 5.17 = 9.40 kWp
assert PV_total ≤ 25.0  → ✅
```

## 6. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15]  (tier B)
target_kw    = PV_total / SCR_TARGET = 9.40 / 1.3 = 7.23 kW
inv_kw       = 8 kW   (ok)
SCR (容配比) = PV_total / inv_kw = 9.40 / 8 = 1.1750 = 117.50%
校验通过（SCR ≤ 150%）
```

## 7. 电池容量

```
storage_ratio (tier B)  = 0.9
bat_target   = actual_pv × ratio  = 9.40 × 0.9 = 8.46 kWh
              (R-B 用 PV_total = existing；以下使用 actual_pv = inv 削减后的实装容量)
bat_kWh      = ceil_to_spec(max(5, bat_target), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50])
             = 9.6 kWh
```

## 8. 选板（按年发电量降序选前 N 块）

- actual_panels = 19 块（容配比削减后）
- 选中面板年发电量合计 = 8,708.0 kWh/年（来自 panel_location.json `monthlyHourlyPowerList`）
- 实装 PV = 9.40 kWp

## 9. 结果摘要

| 项 | 值 |
|---|---|
| 模式 | **R-H** |
| 既有 PV | 4.23 kWp |
| 新增 PV (added) | 5.17 kWp (11 块) |
| 实装 PV (actual) | 9.40 kWp (19 块) |
| 逆变器 | 8 kW · SCR 117.50% · ok |
| 电池 | 9.6 kWh (target 8.46, ratio 0.9) |
