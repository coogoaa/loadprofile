# 系统组成报告（R 改造） · case `11271` · tier `B`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcRH() + pickInverter()
> 模式判定：**R-H** — existing < 25.0 且 remaining_capped ≥ 2.0

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `HH` | request.json |
| 既有 PV (existing_input) | 4.00 kWp (已知) | cases.md Q0=under5 |
| SAM3D 满铺 | 53.11 kWp | auto_from_panel_location |
| 屋顶 2D 面积 (mask2d) | 266.34 m² | detect_building.json data.area |
| 方案档 tier | B (base=10.34, boost=13.16, ratio=0.9) | cases.md |
| 触发上调 | 是 (EV>0 或 热泵/电暖) | LoadProfile Q2/Q4 |

## 2. 屋顶面积估算

```
cos(40°)            = 0.7660
roof_area_m2        = mask2d / cos(40°)         = 266.34 / 0.7660 = 347.69 m²
usable_area_m2      = roof_area_m2 × 0.45        = 347.69 × 0.45 = 156.46 m²
max_panels_area     = floor(156.46 / 2.1580) = 72 块
roof_full_kwp_area  = 72 × 0.47 = 33.84 kWp  (2D 估算)
roof_full_kwp_3d    = SAM3D = 53.11 kWp
```

## 3. 屋顶剩余可铺设容量（分支判定）

**判定结果：分支 1：用户给了既有 PV，SAM3D 满铺至少能多铺 1 块**

```
roof_full_kwp_3d - existing = 53.11 - 4.00 = 49.11 ≥ 0.47
remaining = max(0, roof_full_kwp_3d - existing) = 49.11 kWp
remaining_capped = max(0, min(remaining, 25.0 - existing))
                = max(0, min(49.11, 25.0 - 4.00))
                = 21.00 kWp
```

## 4. R-H / R-B 模式判定

```
if existing >= 25.0:                      # 已达硬上限 → 仅加电池
    mode = "R-B"
elif remaining_capped < 2.0:                    # 增量太小 → 仅加电池
    mode = "R-B"
else:                                       # 增量 + 电池
    mode = "R-H"

→ existing = 4.00 kWp, remaining_capped = 21.00 kWp
→ 判定 = **R-H** (existing < 25.0 且 remaining_capped ≥ 2.0)
```

## 5. 方案目标 + 实装容量

触发条件 trigger = (EV_km > 0) ∨ (hvac ∈ {heat_pump, electric_heat}) → **True**
target_pv_total = 13.16 kWp (boost)

```
target_added  = max(0, target_pv_total - existing)
              = max(0, 13.16 - 4.00) = 9.16 kWp
added_kwp_pre = min(target_added, remaining_capped)
              = min(9.16, 21.00) = 9.16 kWp
added_panels  = floor(9.16 / 0.47) = 19 块
added_kwp     = 19 × 0.47 = 8.93 kWp
PV_total      = existing + added_kwp = 4.00 + 8.93 = 12.93 kWp
assert PV_total ≤ 25.0  → ✅
```

## 6. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15]  (tier B)
target_kw    = PV_total / SCR_TARGET = 12.93 / 1.3 = 9.95 kW
inv_kw       = 10 kW   (ok)
SCR (容配比) = PV_total / inv_kw = 12.93 / 10 = 1.2930 = 129.30%
校验通过（SCR ≤ 150%）
```

## 7. 电池容量

```
storage_ratio (tier B)  = 0.9
bat_target   = actual_pv × ratio  = 12.93 × 0.9 = 11.64 kWh
              (R-B 用 PV_total = existing；以下使用 actual_pv = inv 削减后的实装容量)
bat_kWh      = ceil_to_spec(max(5, bat_target), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50])
             = 13.5 kWh
```

## 8. 选板（按年发电量降序选前 N 块）

- actual_panels = 27 块（容配比削减后）
- 选中面板年发电量合计 = 11,574.8 kWh/年（来自 panel_location.json `monthlyHourlyPowerList`）
- 实装 PV = 12.93 kWp

## 9. 结果摘要

| 项 | 值 |
|---|---|
| 模式 | **R-H** |
| 既有 PV | 4.00 kWp |
| 新增 PV (added) | 8.93 kWp (19 块) |
| 实装 PV (actual) | 12.93 kWp (27 块) |
| 逆变器 | 10 kW · SCR 129.30% · ok |
| 电池 | 13.5 kWh (target 11.64, ratio 0.9) |
