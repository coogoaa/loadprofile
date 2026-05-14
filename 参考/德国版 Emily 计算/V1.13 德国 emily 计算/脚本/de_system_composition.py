"""
DE V1.13 · 步骤 2：系统组成
─────────────────────────────────────────────────────────────────
对齐 de_v3.js 的 calcRH() / calcN() / pickInverter()。
输入：cases + 步骤 1 的 LoadProfile 结果 + GIS（panel_location.json + detect_building.json + request.json）
输出：
  - 02_system_composition.json
  - 02_system_composition.md   含 R-H/R-B 4 分支推导 + 容配比削减 + 电池选型 + 选板列表
"""
import argparse
import json
import math
from pathlib import Path

import de_params as P


# ────────────────────────────────────────────────
# 辅助：读取 GIS 数据 + 估算 SAM3D 满铺
# ────────────────────────────────────────────────
def load_gis(case_dir):
    """读取 request / panel_location / detect_building"""
    req = json.loads((case_dir / 'request.json').read_text(encoding='utf-8')) \
        if (case_dir / 'request.json').exists() else {}
    pan = json.loads((case_dir / 'panel_location.json').read_text(encoding='utf-8')) \
        if (case_dir / 'panel_location.json').exists() else []
    det = json.loads((case_dir / 'detect_building.json').read_text(encoding='utf-8')) \
        if (case_dir / 'detect_building.json').exists() else {}
    return req, pan, det


def estimate_sam3d(panels, override=None):
    """SAM3D 满铺 kWp：优先用户覆盖，否则 len(panels) × 0.470。"""
    if override is not None and override > 0:
        return float(override), 'user_override'
    return float(len(panels) * P.PANEL_KW), 'auto_from_panel_location'


def get_existing_pv(case, request_data):
    """获取既有 PV：优先 case.Q0（若不为 -），否则用 request.existingPvKwp，否则 -1（走分支2）"""
    q0 = case.get('Q0_existing_pv')
    if q0 and q0 != '-':
        return P.q0_to_existing_kwp(q0), f'cases.md Q0={q0}'
    e = (request_data.get('project') or {}).get('existingPvKwp')
    if e is not None and float(e) > 0:
        return float(e), 'request.json project.existingPvKwp'
    return -1.0, '未提供（走 R-H 分支 2 估算）'


# ────────────────────────────────────────────────
# R-H / R-B 计算（移植自 de_v3.js calcRH）
# ────────────────────────────────────────────────
def calc_rh(existing_input, sam3d, mask2d, tier, hvac, ev_km):
    cos40 = math.cos(math.radians(P.ROOF_TILT_DEG))
    roof_area_m2     = mask2d / cos40 if mask2d else 0.0
    usable_area_m2   = roof_area_m2 * P.ROOF_USE_RATIO
    max_panels_area  = math.floor(usable_area_m2 / P.PANEL_AREA_M2) if usable_area_m2 > 0 else 0
    roof_full_kwp_area = max_panels_area * P.PANEL_KW
    roof_full_kwp_3d   = sam3d

    user_known = existing_input >= 0
    branch_info = {}
    if user_known:
        if roof_full_kwp_3d - existing_input >= P.PANEL_KW:
            remaining = max(0, roof_full_kwp_3d - existing_input)
            branch = 1
        elif roof_full_kwp_3d - existing_input < 0:
            remaining = max(0, roof_full_kwp_area - existing_input)
            branch = 1.5
        else:
            remaining = max(0, roof_full_kwp_area - existing_input)
            branch = 3
        existing_out = existing_input
    else:
        # v3 分支 2：用户跳过既有 PV
        remaining = roof_full_kwp_3d * 0.55
        existing_raw = roof_full_kwp_3d * 0.45
        existing_out = min(existing_raw, P.EXISTING_PV_BR2_CAP)
        branch = 2
        branch_info = {
            'br2_existing_raw': existing_raw,
            'br2_capped': existing_raw > P.EXISTING_PV_BR2_CAP,
            'br2_cap': P.EXISTING_PV_BR2_CAP,
        }

    remaining_capped = max(0, min(remaining, P.PV_HARDCAP - existing_out))

    if existing_out >= P.PV_HARDCAP:
        mode = 'R-B'
        mode_reason = f'existing ({existing_out:.2f}) ≥ PV_HARDCAP ({P.PV_HARDCAP})'
    elif remaining_capped < P.REMAIN_MIN_RH:
        mode = 'R-B'
        mode_reason = f'remaining_capped ({remaining_capped:.2f}) < REMAIN_MIN_RH ({P.REMAIN_MIN_RH})'
    else:
        mode = 'R-H'
        mode_reason = f'existing < {P.PV_HARDCAP} 且 remaining_capped ≥ {P.REMAIN_MIN_RH}'

    trigger = P.is_trigger(hvac, ev_km)
    tier_obj = P.TIER_TARGET[tier]
    target_pv_total = tier_obj['boost'] if trigger else tier_obj['base']
    ratio = tier_obj['ratio']

    target_added = added_kwp_pre = added_panels = added_kwp = 0
    pv_total = existing_out
    if mode == 'R-H':
        target_added = max(0, target_pv_total - existing_out)
        added_kwp_pre = min(target_added, remaining_capped)
        added_panels = math.floor(added_kwp_pre / P.PANEL_KW)
        added_kwp = added_panels * P.PANEL_KW
        pv_total = existing_out + added_kwp

    bat_target = pv_total * ratio
    bat_kwh = P.ceil_to_spec(max(P.BATT_MIN, bat_target), P.BATT_SPECS)

    return {
        'existing_input': existing_input, 'user_known': user_known,
        'existing': existing_out,
        'cos40': cos40, 'mask2d': mask2d, 'sam3d': sam3d,
        'roof_area_m2': roof_area_m2, 'usable_area_m2': usable_area_m2,
        'max_panels_area': max_panels_area, 'roof_full_kwp_area': roof_full_kwp_area,
        'roof_full_kwp_3d': roof_full_kwp_3d,
        'remaining': remaining, 'remaining_capped': remaining_capped,
        'branch': branch, 'branch_info': branch_info,
        'mode': mode, 'mode_reason': mode_reason,
        'trigger': trigger, 'tier': tier, 'ratio': ratio,
        'target_pv_total': target_pv_total,
        'target_added': target_added, 'added_kwp_pre': added_kwp_pre,
        'added_panels': added_panels, 'added_kwp': added_kwp,
        'PV_total': pv_total,
        'bat_target': bat_target, 'bat_kWh': bat_kwh,
    }


# ────────────────────────────────────────────────
# 容配比校验 / 逆变器选型（移植 pickInverter）
# ────────────────────────────────────────────────
def pick_inverter(pv_kwp, tier):
    specs = list(P.INV_SPECS[tier])
    target_kw = pv_kwp / P.SCR_TARGET if P.SCR_TARGET else 0
    inv_kw = next((s for s in specs if s >= target_kw), None)
    action = 'ok'
    curtailed = False
    curtail_panels = None
    final_pv = pv_kwp
    if inv_kw is None:
        inv_kw = specs[-1]
        scr = pv_kwp / inv_kw
        if scr > P.SCR_MAX:
            max_pv = inv_kw * P.SCR_MAX
            curtail_panels = math.floor(max_pv / P.PANEL_KW)
            final_pv = curtail_panels * P.PANEL_KW
            curtailed = True
            action = 'curtail'
            scr = final_pv / inv_kw
        else:
            action = 'maxed-but-ok'
    else:
        scr = pv_kwp / inv_kw
    return {
        'specs': specs, 'target_kw': target_kw,
        'inv_kw': inv_kw, 'scr': scr, 'scr_pct': scr * 100,
        'action': action, 'curtailed': curtailed, 'curtail_panels': curtail_panels,
        'final_pv': final_pv,
    }


# ────────────────────────────────────────────────
# N 场景计算（移植 calcN）
# ────────────────────────────────────────────────
def calc_n(tier, hvac, ev_km, sam3d, mask2d):
    trigger = P.is_trigger(hvac, ev_km)
    tier_obj = P.TIER_TARGET[tier]
    target_pv_total = tier_obj['boost'] if trigger else tier_obj['base']
    target_pv_capped = min(target_pv_total, P.PV_HARDCAP)

    sam3d_v = max(0, sam3d or 0)
    roof_capped = min(target_pv_capped, sam3d_v)
    roof_limited = sam3d_v > 0 and sam3d_v < target_pv_capped

    panels = math.floor(roof_capped / P.PANEL_KW) if roof_capped > 0 else 0
    pv_pre = panels * P.PANEL_KW

    inv = pick_inverter(pv_pre, tier)
    actual_pv = inv['final_pv']
    actual_panels = math.floor(actual_pv / P.PANEL_KW)

    ratio = tier_obj['ratio']
    bat_target = actual_pv * ratio
    bat_kwh = P.ceil_to_spec(max(P.BATT_MIN, bat_target), P.BATT_SPECS)

    return {
        'trigger': trigger, 'tier': tier, 'ratio': ratio,
        'target_pv_total': target_pv_total, 'target_pv_capped': target_pv_capped,
        'sam3d': sam3d_v, 'mask2d': mask2d or 0,
        'roof_capped': roof_capped, 'roof_limited': roof_limited,
        'panels_floor': math.floor(roof_capped / P.PANEL_KW) if roof_capped > 0 else 0,
        'panels': panels, 'pv_pre': pv_pre,
        'inv': inv, 'actual_pv': actual_pv, 'actual_panels': actual_panels,
        'bat_target': bat_target, 'bat_kWh': bat_kwh,
    }


# ────────────────────────────────────────────────
# 选板：按年发电量降序选前 N 块
# ────────────────────────────────────────────────
def select_panels(panels, n_target):
    if n_target <= 0 or not panels:
        return [], 0.0
    sorted_p = sorted(
        panels,
        key=lambda p: (p.get('generationPower') or {}).get('annualGeneratePower', 0),
        reverse=True,
    )
    chosen = sorted_p[:n_target]
    annual = sum((p.get('generationPower') or {}).get('annualGeneratePower', 0) for p in chosen)
    return chosen, annual


# ────────────────────────────────────────────────
# 报告
# ────────────────────────────────────────────────
BRANCH_DESC = {
    1:   '分支 1：用户给了既有 PV，SAM3D 满铺至少能多铺 1 块',
    1.5: '分支 1.5：用户给了既有 PV，但 SAM3D 满铺 < existing → 用 2D 估算兜底',
    2:   '分支 2：用户跳过既有 PV，反推 existing = SAM3D × 0.45（封顶 13.16 kWp）',
    3:   '分支 3：用户给了既有 PV，SAM3D 与 existing 差 < 1 块 → 用 2D 估算',
}


def render_report_r(case, lp, gis_state, rh, inv, actual_pv, actual_panels, sel_annual_kwh, sam3d_src):
    lines = []
    add = lines.append
    add(f'# 系统组成报告（R 改造） · case `{case["case_id"]}` · tier `{case["tier"]}`')
    add('')
    add(f'> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcRH() + pickInverter()')
    add(f'> 模式判定：**{rh["mode"]}** — {rh["mode_reason"]}')
    add('')

    # 1. 输入
    add('## 1. 输入')
    add('')
    add('| 项 | 值 | 来源 |')
    add('|---|---|---|')
    add(f'| 州 | `{gis_state}` | request.json |')
    add(f'| 既有 PV (existing_input) | {rh["existing_input"]:.2f} kWp ({"已知" if rh["user_known"] else "跳过"}) | {case.get("_existing_src","")} |')
    add(f'| SAM3D 满铺 | {rh["sam3d"]:.2f} kWp | {sam3d_src} |')
    add(f'| 屋顶 2D 面积 (mask2d) | {rh["mask2d"]:.2f} m² | detect_building.json data.area |')
    add(f'| 方案档 tier | {case["tier"]} (base={P.TIER_TARGET[case["tier"]]["base"]}, boost={P.TIER_TARGET[case["tier"]]["boost"]}, ratio={P.TIER_TARGET[case["tier"]]["ratio"]}) | cases.md |')
    add(f'| 触发上调 | {"是" if rh["trigger"] else "否"} (EV>0 或 热泵/电暖) | LoadProfile Q2/Q4 |')
    add('')

    # 2. 屋顶面积估算
    add('## 2. 屋顶面积估算')
    add('')
    add('```')
    add(f'cos(40°)            = {rh["cos40"]:.4f}')
    add(f'roof_area_m2        = mask2d / cos(40°)         = {rh["mask2d"]:.2f} / {rh["cos40"]:.4f} = {rh["roof_area_m2"]:.2f} m²')
    add(f'usable_area_m2      = roof_area_m2 × 0.45        = {rh["roof_area_m2"]:.2f} × 0.45 = {rh["usable_area_m2"]:.2f} m²')
    add(f'max_panels_area     = floor({rh["usable_area_m2"]:.2f} / {P.PANEL_AREA_M2:.4f}) = {rh["max_panels_area"]} 块')
    add(f'roof_full_kwp_area  = {rh["max_panels_area"]} × {P.PANEL_KW} = {rh["roof_full_kwp_area"]:.2f} kWp  (2D 估算)')
    add(f'roof_full_kwp_3d    = SAM3D = {rh["roof_full_kwp_3d"]:.2f} kWp')
    add('```')
    add('')

    # 3. 分支判定
    add('## 3. 屋顶剩余可铺设容量（分支判定）')
    add('')
    add(f'**判定结果：{BRANCH_DESC[rh["branch"]]}**')
    add('')
    add('```')
    if rh['branch'] == 1:
        add(f'roof_full_kwp_3d - existing = {rh["roof_full_kwp_3d"]:.2f} - {rh["existing"]:.2f} = {rh["roof_full_kwp_3d"]-rh["existing"]:.2f} ≥ {P.PANEL_KW}')
        add(f'remaining = max(0, roof_full_kwp_3d - existing) = {rh["remaining"]:.2f} kWp')
    elif rh['branch'] == 1.5:
        add(f'roof_full_kwp_3d - existing < 0 → SAM3D 已被既有 PV 占满，回退到 2D 估算')
        add(f'remaining = max(0, roof_full_kwp_area - existing) = max(0, {rh["roof_full_kwp_area"]:.2f} - {rh["existing"]:.2f}) = {rh["remaining"]:.2f} kWp')
    elif rh['branch'] == 2:
        bi = rh['branch_info']
        add(f'remaining       = SAM3D × 0.55 = {rh["roof_full_kwp_3d"]:.2f} × 0.55 = {rh["remaining"]:.2f} kWp')
        add(f'existing_raw    = SAM3D × 0.45 = {bi["br2_existing_raw"]:.2f} kWp')
        add(f'existing (封顶) = min({bi["br2_existing_raw"]:.2f}, {bi["br2_cap"]}) = {rh["existing"]:.2f} kWp  '
            f'{"⚠ 触发封顶" if bi["br2_capped"] else "（未触发封顶）"}')
    else:  # 3
        add(f'roof_full_kwp_3d - existing < {P.PANEL_KW}（差 < 1 块）→ SAM3D 估算不准，回退 2D')
        add(f'remaining = max(0, roof_full_kwp_area - existing) = {rh["remaining"]:.2f} kWp')
    add(f'remaining_capped = max(0, min(remaining, {P.PV_HARDCAP} - existing))')
    add(f'                = max(0, min({rh["remaining"]:.2f}, {P.PV_HARDCAP} - {rh["existing"]:.2f}))')
    add(f'                = {rh["remaining_capped"]:.2f} kWp')
    add('```')
    add('')

    # 4. 模式判定
    add('## 4. R-H / R-B 模式判定')
    add('')
    add('```')
    add(f'if existing >= {P.PV_HARDCAP}:                      # 已达硬上限 → 仅加电池')
    add(f'    mode = "R-B"')
    add(f'elif remaining_capped < {P.REMAIN_MIN_RH}:                    # 增量太小 → 仅加电池')
    add(f'    mode = "R-B"')
    add(f'else:                                       # 增量 + 电池')
    add(f'    mode = "R-H"')
    add('')
    add(f'→ existing = {rh["existing"]:.2f} kWp, remaining_capped = {rh["remaining_capped"]:.2f} kWp')
    add(f'→ 判定 = **{rh["mode"]}** ({rh["mode_reason"]})')
    add('```')
    add('')

    # 5. 容量推导
    add('## 5. 方案目标 + 实装容量')
    add('')
    tier_obj = P.TIER_TARGET[case['tier']]
    add(f'触发条件 trigger = (EV_km > 0) ∨ (hvac ∈ {{heat_pump, electric_heat}}) → **{rh["trigger"]}**')
    add(f'target_pv_total = {tier_obj["boost"] if rh["trigger"] else tier_obj["base"]} kWp '
        f'({"boost" if rh["trigger"] else "base"})')
    add('')
    if rh['mode'] == 'R-H':
        add('```')
        add(f'target_added  = max(0, target_pv_total - existing)')
        add(f'              = max(0, {rh["target_pv_total"]} - {rh["existing"]:.2f}) = {rh["target_added"]:.2f} kWp')
        add(f'added_kwp_pre = min(target_added, remaining_capped)')
        add(f'              = min({rh["target_added"]:.2f}, {rh["remaining_capped"]:.2f}) = {rh["added_kwp_pre"]:.2f} kWp')
        add(f'added_panels  = floor({rh["added_kwp_pre"]:.2f} / {P.PANEL_KW}) = {rh["added_panels"]} 块')
        add(f'added_kwp     = {rh["added_panels"]} × {P.PANEL_KW} = {rh["added_kwp"]:.2f} kWp')
        add(f'PV_total      = existing + added_kwp = {rh["existing"]:.2f} + {rh["added_kwp"]:.2f} = {rh["PV_total"]:.2f} kWp')
        add(f'assert PV_total ≤ {P.PV_HARDCAP}  → {"✅" if rh["PV_total"]<=P.PV_HARDCAP+1e-6 else "❌"}')
        add('```')
    else:
        add('```')
        add(f'R-B 仅加电池：added_kwp = 0, PV_total = existing = {rh["PV_total"]:.2f} kWp')
        add('```')
    add('')

    # 6. 容配比 + 逆变器
    add('## 6. 逆变器选型（容配比校验）')
    add('')
    add('```')
    add(f'specs        = {inv["specs"]}  (tier {case["tier"]})')
    add(f'target_kw    = PV_total / SCR_TARGET = {rh["PV_total"]:.2f} / {P.SCR_TARGET} = {inv["target_kw"]:.2f} kW')
    add(f'inv_kw       = {inv["inv_kw"]} kW   ({inv["action"]})')
    add(f'SCR (容配比) = PV_total / inv_kw = {rh["PV_total"]:.2f} / {inv["inv_kw"]} = {inv["scr"]:.4f} = {inv["scr_pct"]:.2f}%')
    if inv['curtailed']:
        add(f'⚠ SCR > {P.SCR_MAX*100:.0f}%，触发削减：')
        add(f'  max_pv         = inv_kw × {P.SCR_MAX} = {inv["inv_kw"]*P.SCR_MAX:.2f} kWp')
        add(f'  curtail_panels = floor(max_pv / 0.470) = {inv["curtail_panels"]}')
        add(f'  final_pv       = {inv["final_pv"]:.2f} kWp  (削减后)')
    else:
        add(f'校验通过（SCR ≤ {P.SCR_MAX*100:.0f}%）')
    add('```')
    add('')

    # 7. 电池
    add('## 7. 电池容量')
    add('')
    add('```')
    add(f'storage_ratio (tier {case["tier"]})  = {rh["ratio"]}')
    add(f'bat_target   = actual_pv × ratio  = {actual_pv:.2f} × {rh["ratio"]} = {actual_pv*rh["ratio"]:.2f} kWh')
    add(f'              (R-B 用 PV_total = existing；以下使用 actual_pv = inv 削减后的实装容量)')
    add(f'bat_kWh      = ceil_to_spec(max(5, bat_target), {P.BATT_SPECS})')
    add(f'             = {rh["bat_kWh"]} kWh')
    add('```')
    add('')

    # 8. 选板
    add('## 8. 选板（按年发电量降序选前 N 块）')
    add('')
    add(f'- actual_panels = {actual_panels} 块（容配比削减后）')
    add(f'- 选中面板年发电量合计 = {sel_annual_kwh:,.1f} kWh/年（来自 panel_location.json `monthlyHourlyPowerList`）')
    add(f'- 实装 PV = {actual_pv:.2f} kWp')
    add('')

    # 9. 结果摘要
    add('## 9. 结果摘要')
    add('')
    add('| 项 | 值 |')
    add('|---|---|')
    add(f'| 模式 | **{rh["mode"]}** |')
    add(f'| 既有 PV | {rh["existing"]:.2f} kWp |')
    add(f'| 新增 PV (added) | {rh["added_kwp"]:.2f} kWp ({rh["added_panels"]} 块) |')
    add(f'| 实装 PV (actual) | {actual_pv:.2f} kWp ({actual_panels} 块) |')
    add(f'| 逆变器 | {inv["inv_kw"]} kW · SCR {inv["scr_pct"]:.2f}% · {inv["action"]} |')
    add(f'| 电池 | {rh["bat_kWh"]} kWh (target {rh["bat_target"]:.2f}, ratio {rh["ratio"]}) |')
    add('')

    return '\n'.join(lines)


def render_report_n(case, lp, gis_state, n, sel_annual_kwh, sam3d_src):
    lines = []
    add = lines.append
    add(f'# 系统组成报告（N 全新建） · case `{case["case_id"]}` · tier `{case["tier"]}`')
    add('')
    add(f'> 步骤 2 / 4 · 计算引擎 = `de_v3.js` calcN() + pickInverter()')
    add('')

    # 1. 输入
    add('## 1. 输入')
    add('')
    add('| 项 | 值 | 来源 |')
    add('|---|---|---|')
    add(f'| 州 | `{gis_state}` | request.json |')
    add(f'| SAM3D 满铺 | {n["sam3d"]:.2f} kWp | {sam3d_src} |')
    add(f'| 屋顶 2D 面积 | {n["mask2d"]:.2f} m² | detect_building.json |')
    add(f'| 方案档 tier | {case["tier"]} (base={P.TIER_TARGET[case["tier"]]["base"]}, boost={P.TIER_TARGET[case["tier"]]["boost"]}, ratio={P.TIER_TARGET[case["tier"]]["ratio"]}) | cases.md |')
    add(f'| 触发上调 | {"是" if n["trigger"] else "否"} | LoadProfile Q2/Q4 |')
    add('')

    # 2. 容量推导
    add('## 2. 目标容量 + 屋顶物理约束')
    add('')
    add('```')
    add(f'target_pv_total   = {n["target_pv_total"]:.2f} kWp ({"boost" if n["trigger"] else "base"})')
    add(f'target_pv_capped  = min(target_pv_total, {P.PV_HARDCAP}) = {n["target_pv_capped"]:.2f} kWp')
    add(f'roof_capped       = min(target_pv_capped, SAM3D)')
    add(f'                  = min({n["target_pv_capped"]:.2f}, {n["sam3d"]:.2f}) = {n["roof_capped"]:.2f} kWp')
    if n['roof_limited']:
        add(f'⚠ 屋顶受限：SAM3D ({n["sam3d"]:.2f}) < target ({n["target_pv_capped"]:.2f})')
    else:
        add(f'✓ 屋顶足够')
    add('')
    add(f'panels = floor({n["roof_capped"]:.2f} / 0.470) = {n["panels"]} 块')
    add(f'pv_pre = panels × 0.470 = {n["pv_pre"]:.2f} kWp')
    add(f'assert pv_pre ≤ min({P.PV_HARDCAP}, SAM3D={n["sam3d"]:.2f}) → '
        f'{"✅" if n["pv_pre"] <= min(P.PV_HARDCAP, n["sam3d"])+1e-6 else "❌"}')
    add('```')
    add('')

    # 3. 容配比
    inv = n['inv']
    add('## 3. 逆变器选型（容配比校验）')
    add('')
    add('```')
    add(f'specs        = {inv["specs"]}  (tier {case["tier"]})')
    add(f'target_kw    = pv_pre / 1.30 = {n["pv_pre"]:.2f} / 1.30 = {inv["target_kw"]:.2f} kW')
    add(f'inv_kw       = {inv["inv_kw"]} kW ({inv["action"]})')
    add(f'SCR          = pv_pre / inv_kw = {n["pv_pre"]:.2f} / {inv["inv_kw"]} = {inv["scr_pct"]:.2f}%')
    if inv['curtailed']:
        add(f'⚠ 削减：curtail_panels = {inv["curtail_panels"]}, final_pv = {inv["final_pv"]:.2f} kWp')
    add('```')
    add('')

    # 4. 电池
    add('## 4. 电池容量')
    add('')
    add('```')
    add(f'storage_ratio = {n["ratio"]} (tier {case["tier"]})')
    add(f'bat_target    = actual_pv × ratio = {n["actual_pv"]:.2f} × {n["ratio"]} = {n["bat_target"]:.2f} kWh')
    add(f'bat_kWh       = ceil_to_spec(max(5, {n["bat_target"]:.2f}), {P.BATT_SPECS}) = {n["bat_kWh"]} kWh')
    add('```')
    add('')

    # 5. 选板
    add('## 5. 选板（按年发电量降序选前 N 块）')
    add('')
    add(f'- actual_panels = {n["actual_panels"]} 块')
    add(f'- 选中面板年发电量合计 = {sel_annual_kwh:,.1f} kWh/年')
    add('')

    # 6. 摘要
    add('## 6. 结果摘要')
    add('')
    add('| 项 | 值 |')
    add('|---|---|')
    add(f'| 屋顶约束 | {"⚠ 屋顶受限" if n["roof_limited"] else "✓ 屋顶足够"} |')
    add(f'| 实装 PV | {n["actual_pv"]:.2f} kWp ({n["actual_panels"]} 块) |')
    add(f'| 逆变器 | {inv["inv_kw"]} kW · SCR {inv["scr_pct"]:.2f}% · {inv["action"]} |')
    add(f'| 电池 | {n["bat_kWh"]} kWh (target {n["bat_target"]:.2f}, ratio {n["ratio"]}) |')
    add('')

    return '\n'.join(lines)


# ────────────────────────────────────────────────
# 处理单个 case
# ────────────────────────────────────────────────
def process_case(case, data_dir, output_dir):
    case_id = case['case_id']
    case_data_dir = data_dir / case_id
    request_data, panels, detect = load_gis(case_data_dir)
    state = (request_data.get('project') or {}).get('state', 'BY')
    if state not in P.BASE:
        state = 'BY'

    mask2d = float((detect.get('data') or {}).get('area', 0) or 0)
    sam3d, sam3d_src = estimate_sam3d(panels, override=case.get('sam3d_kwp'))
    existing, existing_src = get_existing_pv(case, request_data)
    case['_existing_src'] = existing_src

    # LoadProfile 用于 trigger 判定的输入
    hvac_in = case['Q2_hvac'] if case['Q2_hvac'] not in (None, '-') else 'no_system'
    ev_km = case['Q4_ev_km']

    # 加载 LoadProfile JSON（来自步骤 1）
    lp_file = output_dir / case_id / '01_load_profile.json'
    lp = json.loads(lp_file.read_text(encoding='utf-8')) if lp_file.exists() else None

    out_modes = []
    if case['mode'] in ('R', 'RN'):
        out_modes.append('R')
    if case['mode'] in ('N', 'RN'):
        out_modes.append('N')

    for m in out_modes:
        sub = output_dir / case_id / m / case['tier']
        sub.mkdir(parents=True, exist_ok=True)
        if m == 'R':
            rh = calc_rh(existing, sam3d, mask2d, case['tier'], hvac_in, ev_km)
            inv = pick_inverter(rh['PV_total'], case['tier']) if rh['PV_total'] > 0 else \
                  {'specs': P.INV_SPECS[case['tier']], 'target_kw': 0,
                   'inv_kw': 0, 'scr': 0, 'scr_pct': 0, 'action': 'n/a',
                   'curtailed': False, 'curtail_panels': None, 'final_pv': rh['PV_total']}
            actual_pv = inv['final_pv']
            actual_panels = math.floor(actual_pv / P.PANEL_KW) if actual_pv > 0 else 0
            chosen, sel_annual = select_panels(panels, actual_panels)
            out_data = {
                'case_id': case_id, 'mode': m, 'tier': case['tier'],
                'inputs': {
                    'state': state, 'hvac': hvac_in, 'ev_km': ev_km,
                    'existing_input': existing, 'existing_src': existing_src,
                    'sam3d_kwp': sam3d, 'sam3d_src': sam3d_src,
                    'mask2d_m2': mask2d,
                },
                'rh': rh, 'inverter': inv,
                'actual_pv': actual_pv, 'actual_panels': actual_panels,
                'selected_panels_count': len(chosen),
                'selected_panels_annual_kwh': sel_annual,
                'selected_panel_indices': [i for i, _ in enumerate(panels)
                                           if any(_ is c for c in chosen)],
            }
            (sub / '02_system_composition.json').write_text(
                json.dumps(out_data, ensure_ascii=False, indent=2), encoding='utf-8')
            (sub / '02_system_composition.md').write_text(
                render_report_r(case, lp, state, rh, inv, actual_pv, actual_panels, sel_annual, sam3d_src),
                encoding='utf-8')
            print(f'  ✓ [{case_id}/R] mode={rh["mode"]} PV={actual_pv:.2f}({actual_panels}板) '
                  f'inv={inv["inv_kw"]}kW SCR={inv["scr_pct"]:.0f}% bat={rh["bat_kWh"]}kWh')

        else:  # N
            n = calc_n(case['tier'], hvac_in, ev_km, sam3d, mask2d)
            chosen, sel_annual = select_panels(panels, n['actual_panels'])
            out_data = {
                'case_id': case_id, 'mode': m, 'tier': case['tier'],
                'inputs': {
                    'state': state, 'hvac': hvac_in, 'ev_km': ev_km,
                    'sam3d_kwp': sam3d, 'sam3d_src': sam3d_src,
                    'mask2d_m2': mask2d,
                },
                'n': n,
                'selected_panels_count': len(chosen),
                'selected_panels_annual_kwh': sel_annual,
            }
            (sub / '02_system_composition.json').write_text(
                json.dumps(out_data, ensure_ascii=False, indent=2), encoding='utf-8')
            (sub / '02_system_composition.md').write_text(
                render_report_n(case, lp, state, n, sel_annual, sam3d_src),
                encoding='utf-8')
            print(f'  ✓ [{case_id}/N] PV={n["actual_pv"]:.2f}({n["actual_panels"]}板) '
                  f'inv={n["inv"]["inv_kw"]}kW SCR={n["inv"]["scr_pct"]:.0f}% bat={n["bat_kWh"]}kWh '
                  f'{"(屋顶受限)" if n["roof_limited"] else ""}')


def main():
    ap = argparse.ArgumentParser(description='DE V1.13 · 步骤 2：系统组成')
    ap.add_argument('--cases', required=True)
    ap.add_argument('--data-dir', required=True)
    ap.add_argument('--output-dir', required=True)
    args = ap.parse_args()

    from parse_cases import parse_cases_md
    cases = parse_cases_md(args.cases)
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f'步骤 2 / 系统组成：处理 {len(cases)} 个 case')
    for c in cases:
        process_case(c, data_dir, output_dir)
    print('完成。')


if __name__ == '__main__':
    main()
