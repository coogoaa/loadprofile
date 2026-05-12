# 系统组成报告（N 全新建） · case `11194` · tier `B`

> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcN() + pickInverter()

## 1. 输入

| 项 | 值 | 来源 |
|---|---|---|
| 州 | `BY` | request.json |
| SAM3D 满铺 | 20.68 kWp | auto_from_panel_location |
| 屋顶 2D 面积 | 162.15 m² | detect_building.json |
| 方案档 tier | B (base=10.34, boost=13.16, ratio=0.9) | cases.md |
| 触发上调 | 是 | LoadProfile Q2/Q4 |

## 2. 目标容量 + 屋顶物理约束

```
target_pv_total   = 13.16 kWp (boost)
target_pv_capped  = min(target_pv_total, 25.0) = 13.16 kWp
roof_capped       = min(target_pv_capped, SAM3D)
                  = min(13.16, 20.68) = 13.16 kWp
✓ 屋顶足够

panels = floor(13.16 / 0.470) = 28 块
pv_pre = panels × 0.470 = 13.16 kWp
assert pv_pre ≤ min(25.0, SAM3D=20.68) → ✅
```

## 3. 逆变器选型（容配比校验）

```
specs        = [5, 6, 8, 10, 12, 15]  (tier B)
target_kw    = pv_pre / 1.30 = 13.16 / 1.30 = 10.12 kW
inv_kw       = 12 kW (ok)
SCR          = pv_pre / inv_kw = 13.16 / 12 = 109.67%
```

## 4. 电池容量

```
storage_ratio = 0.9 (tier B)
bat_target    = actual_pv × ratio = 13.16 × 0.9 = 11.84 kWh
bat_kWh       = ceil_to_spec(max(5, 11.84), [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50]) = 13.5 kWh
```

## 5. 选板（按年发电量降序选前 N 块）

- actual_panels = 28 块
- 选中面板年发电量合计 = 11,341.4 kWh/年

## 6. 结果摘要

| 项 | 值 |
|---|---|
| 屋顶约束 | ✓ 屋顶足够 |
| 实装 PV | 13.16 kWp (28 块) |
| 逆变器 | 12 kW · SCR 109.67% · ok |
| 电池 | 13.5 kWh (target 11.84, ratio 0.9) |
