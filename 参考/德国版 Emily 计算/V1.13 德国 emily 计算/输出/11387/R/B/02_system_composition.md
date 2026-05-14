# 系统组成报告（R 改造） · case `11387` · tier `B`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcRH() + pickInverter()
> 模式判定：**R-H** — existing < 25.0 且 remaining_capped ≥ 2.0

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `BY` | request.json |
| 既有 PV (existing_input) | 7.00 kWp (已知) | cases.md Q0=5-10 |
| SAM3D 满铺 | 35.25 kWp | auto_from_panel_location |
| 屋顶 2D 面积 (mask2d) | 157.78 m² | detect_building.json data.area |
| 方案档 tier | B (base=10.34, boost=13.16, ratio=0.9) | cases.md |
| 触发上调 | 是 (EV>0 或 热泵/电暖) | LoadProfile Q2/Q4 |

## 2. 屋顶面积估算

```
cos(40°)            = 0.7660
roof_area_m2        = mask2d / cos(40°)         = 157.78 / 0.7660 = 205.96 m²
usable_area_m2      = roof_area_m2 × 0.45        = 205.96 × 0.45 = 92.68 m²
max_panels_area     = floor(92.68 / 2.1580) = 42 块
roof_full_kwp_area  = 42 × 0.47 = 19.74 kWp  (2D 估算)
roof_full_kwp_3d    = SAM3D = 35.25 kWp
```

## 3. 屋顶剩余可铺设容量（分支判定）

**判定结果：分支 1：用户给了既有 PV，SAM3D 满铺至少能多铺 1 块**

```
roof_full_kwp_3d - existing = 35.25 - 7.00 = 28.25 ≥ 0.47
remaining = max(0, roof_full_kwp_3d - existing) = 28.25 kWp
remaining_capped = max(0, min(remaining, 25.0 - existing))
                = max(0, min(28.25, 25.0 - 7.00))
                = 18.00 kWp
```

## 4. R-H / R-B 模式判定

```
if existing >= 25.0:                      # 已达硬上限 → 仅加电池
    mode = "R-B"
elif remaining_capped < 2.0:                    # 增量太小 → 仅加电池
    mode = "R-B"
else:                                       # 增量 + 电池
    mode = "R-H"

→ existing = 7.00 kWp, remaining_capped = 18.00 kWp
→ 判定 = **R-H** (existing < 25.0 且 remaining_capped ≥ 2.0)
```

## 5. 方案目标 + 实装容量

触发条件 trigger = (EV_km > 0) ∨ (hvac ∈ {heat_pump, electric_heat}) → **True**
target_pv_total = 13.16 kWp (boost)

```
target_added  = max(0, target_pv_total - existing)
              = max(0, 13.16 - 7.00) = 6.16 kWp
added_kwp_pre = min(target_added, remaining_capped)
              = min(6.16, 18.00) = 6.16 kWp
added_panels  = floor(6.16 / 0.47) = 13 块
added_kwp     = 13 × 0.47 = 6.11 kWp
PV_total      = existing + added_kwp = 7.00 + 6.11 = 13.11 kWp
assert PV_total ≤ 25.0  → ✅
```

## 6. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15]  (tier B)
target_kw    = PV_total / SCR_TARGET = 13.11 / 1.3 = 10.08 kW
inv_kw       = 12 kW   (ok)
SCR (容配比) = PV_total / inv_kw = 13.11 / 12 = 1.0925 = 109.25%
校验通过（SCR ≤ 150%）
```

## 7. 电池容量

```
storage_ratio (tier B)  = 0.9
bat_target   = actual_pv × ratio  = 13.11 × 0.9 = 11.80 kWh
              (R-B 用 PV_total = existing；以下使用 actual_pv = inv 削减后的实装容量)
bat_kWh      = ceil_to_spec(max(5, bat_target), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50])
             = 13.5 kWh
```

## 8. 选板（按年发电量降序选前 N 块）

- actual_panels = 27 块（容配比削减后）
- 选中面板年发电量合计 = 12,051.4 kWh/年（来自 panel_location.json `monthlyHourlyPowerList`）
- 实装 PV = 13.11 kWp

## 9. 结果摘要

| 项 | 值 |
|---|---|
| 模式 | **R-H** |
| 既有 PV | 7.00 kWp |
| 新增 PV (added) | 6.11 kWp (13 块) |
| 实装 PV (actual) | 13.11 kWp (27 块) |
| 逆变器 | 12 kW · SCR 109.25% · ok |
| 电池 | 13.5 kWh (target 11.80, ratio 0.9) |
