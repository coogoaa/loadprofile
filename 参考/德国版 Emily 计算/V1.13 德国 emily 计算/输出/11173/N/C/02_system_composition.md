# 系统组成报告（N 全新建） · case `11173` · tier `C`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcN() + pickInverter()

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `BY` | request.json |
| SAM3D 满铺 | 9.40 kWp | auto_from_panel_location |
| 屋顶 2D 面积 | 135.36 m² | detect_building.json |
| 方案档 tier | C (base=13.16, boost=15.04, ratio=1.2) | cases.md |
| 触发上调 | 否 | LoadProfile Q2/Q4 |

## 2. 目标容量 + 屋顶物理约束

```
target_pv_total   = 13.16 kWp (base)
target_pv_capped  = min(target_pv_total, 25.0) = 13.16 kWp
roof_capped       = min(target_pv_capped, SAM3D)
                  = min(13.16, 9.40) = 9.40 kWp
⚠ 屋顶受限：SAM3D (9.40) < target (13.16)

panels_floor = floor(9.40 / 0.470) = 19
panels_ceil  = ceil(9.40 / 0.470)  = 20
  → 取 ceil 时是否破屋顶? ceil×0.470=9.400 ≤ SAM3D(9.40)
  → 选 panels = 20 块
pv_pre      = panels × 0.470 = 9.40 kWp
assert pv_pre ≤ min(25.0, SAM3D=9.40) → ✅
```

## 3. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15, 18, 20, 22]  (tier C)
target_kw    = pv_pre / 1.30 = 9.40 / 1.30 = 7.23 kW
inv_kw       = 8 kW (ok)
SCR          = pv_pre / inv_kw = 9.40 / 8 = 117.50%
```

## 4. 电池容量

```
storage_ratio = 1.2 (tier C)
bat_target    = actual_pv × ratio = 9.40 × 1.2 = 11.28 kWh
bat_kWh       = ceil_to_spec(max(5, 11.28), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50]) = 13.5 kWh
```

## 5. 选板（按年发电量降序选前 N 块）

- actual_panels = 20 块
- 选中面板年发电量合计 = 9,166.3 kWh/年

## 6. 结果摘要

| 项 | 值 |
|---|---|
| 屋顶约束 | ⚠ 屋顶受限 |
| 实装 PV | 9.40 kWp (20 块) |
| 逆变器 | 8 kW · SCR 117.50% · ok |
| 电池 | 13.5 kWh (target 11.28, ratio 1.2) |
