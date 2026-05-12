# 系统组成报告（N 全新建） · case `11173` · tier `A`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcN() + pickInverter()

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `BY` | request.json |
| SAM3D 满铺 | 9.40 kWp | auto_from_panel_location |
| 屋顶 2D 面积 | 135.36 m² | detect_building.json |
| 方案档 tier | A (base=7.05, boost=7.05, ratio=0.7) | cases.md |
| 触发上调 | 否 | LoadProfile Q2/Q4 |

## 2. 目标容量 + 屋顶物理约束

```
target_pv_total   = 7.05 kWp (base)
target_pv_capped  = min(target_pv_total, 25.0) = 7.05 kWp
roof_capped       = min(target_pv_capped, SAM3D)
                  = min(7.05, 9.40) = 7.05 kWp
✓ 屋顶足够

panels_floor = floor(7.05 / 0.470) = 15
panels_ceil  = ceil(7.05 / 0.470)  = 15
  → 取 ceil 时是否破屋顶? ceil×0.470=7.050 ≤ SAM3D(9.40)
  → 选 panels = 15 块
pv_pre      = panels × 0.470 = 7.05 kWp
assert pv_pre ≤ min(25.0, SAM3D=9.40) → ✅
```

## 3. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15]  (tier A)
target_kw    = pv_pre / 1.30 = 7.05 / 1.30 = 5.42 kW
inv_kw       = 6 kW (ok)
SCR          = pv_pre / inv_kw = 7.05 / 6 = 117.50%
```

## 4. 电池容量

```
storage_ratio = 0.7 (tier A)
bat_target    = actual_pv × ratio = 7.05 × 0.7 = 4.93 kWh
bat_kWh       = ceil_to_spec(max(5, 4.93), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50]) = 5 kWh
```

## 5. 选板（按年发电量降序选前 N 块）

- actual_panels = 15 块
- 选中面板年发电量合计 = 6,874.7 kWh/年

## 6. 结果摘要

| 项 | 值 |
|---|---|
| 屋顶约束 | ✓ 屋顶足够 |
| 实装 PV | 7.05 kWp (15 块) |
| 逆变器 | 6 kW · SCR 117.50% · ok |
| 电池 | 5 kWh (target 4.93, ratio 0.7) |
