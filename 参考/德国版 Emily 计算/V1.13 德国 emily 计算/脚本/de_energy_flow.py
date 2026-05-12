"""
DE V1.13 · 步骤 3：能量流模拟
─────────────────────────────────────────────────────────────────
输入：
  - 步骤 1：01_load_profile.json  → final, fkm[12], fhs[24], fkd[24], inputs
  - 步骤 2：02_system_composition.json + panel_location.json → 选板 + 电池容量
输出：
  - 03_energy_flow.json
  - 03_energy_flow.md   12×24 月度小时矩阵 + 电池模拟 + SCR/SSR
公式（与 verify_energy_flow.py 对齐 + DE 参数）：
  gen[m][h] = Σ_selected_panel.monthlyHourlyPowerList[m][h]
  load[m][h] = final × DE_MONTHLY[m] / DAYS_IN_MONTH[m] × fhs[h]      # 注：fhs=fkd/davg，按小时归一化到日均
  # 简化电池模型（按"日"循环，DoD/RTE 已合并入 BATT_EFF=0.855）
  for each (m, day):
      for each h in 0..23:
          direct  = min(gen[h], load[h])             # 直接消纳
          surplus = gen[h] - direct                  # 剩余可充电
          deficit = load[h] - direct                 # 待补缺口
          charge  = min(surplus, bat_capacity - soc) # 充电（含 DoD 上限）
          soc    += charge
          discharge_avail = soc × BATT_EFF
          discharge = min(deficit, discharge_avail)
          soc -= discharge / BATT_EFF
          export[h] = surplus - charge
          import_[h] = deficit - discharge
  SCR (自用率)  = (direct + discharge) / gen_total
  SSR (自给率) = (direct + discharge) / load_total
"""
import argparse
import json
import math
from pathlib import Path

import de_params as P


# ────────────────────────────────────────────────
# 发电矩阵：从面板 monthlyHourlyPowerList 累加
# ────────────────────────────────────────────────
def build_generation_matrix(panels):
    """返回 (gen[12][24], annual_total)。面板若缺数据则跳过该行。"""
    gen = [[0.0]*24 for _ in range(12)]
    total = 0.0
    for p in panels:
        gp = p.get('generationPower') or {}
        total += gp.get('annualGeneratePower', 0) or 0
        mhpl = gp.get('monthlyHourlyPowerList') or []
        if len(mhpl) == 12:
            for m in range(12):
                row = mhpl[m] or []
                if len(row) == 24:
                    for h in range(24):
                        gen[m][h] += row[h] or 0
    return gen, total


# ────────────────────────────────────────────────
# 用电矩阵：从 LoadProfile 推 12×24
# ────────────────────────────────────────────────
def build_load_matrix(lp):
    """
    用 fkm[12]（月度 kWh）分摊到日 → 再用 fhs[24]/24（小时占日均比）扩展到小时。
    更精确：load[m][h] = fkm[m] / days[m] × (fkd[h] / davg) = monthly_daily_kwh × fhs[h] / Σfhs
      其中 Σfhs = 24（fhs 是相对日均的比例，∑=24）
    """
    fkm = lp['monthly']['fkm']           # [12]
    fkd = lp['hourly']['fkd']            # [24]，单位 kWh/小时（日均）
    davg = lp['totals']['davg']
    # 小时占比向量（sum=1）
    if davg > 0:
        h_share = [v / (davg * 24) * 24 for v in fkd]  # = fkd / davg / Σ(fkd/davg) ≈ fkd/davg/24
    else:
        h_share = [1/24.0] * 24
    # 归一化保险
    s = sum(h_share)
    h_share = [v / s for v in h_share] if s > 0 else [1/24.0] * 24

    load = [[0.0]*24 for _ in range(12)]
    for m in range(12):
        daily = fkm[m] / P.DAYS_IN_MONTH[m]
        for h in range(24):
            load[m][h] = daily * h_share[h]
    return load, h_share


# ────────────────────────────────────────────────
# 电池模拟（日循环）
# ────────────────────────────────────────────────
def simulate_battery(gen, load, bat_capacity_kwh):
    """对每个月，按典型日复用 30/31/28 天，逐小时模拟。"""
    usable_capacity = bat_capacity_kwh * P.BATT_DOD  # DoD 后可用容量
    rte = P.BATT_RTE

    direct_total = 0.0
    discharge_total = 0.0
    charge_total = 0.0
    export_total = 0.0
    import_total = 0.0
    gen_total = 0.0
    load_total = 0.0

    month_summary = []
    for m in range(12):
        days = P.DAYS_IN_MONTH[m]
        soc = 0.0  # 月初 SOC=0
        m_direct = m_disch = m_charge = m_exp = m_imp = 0.0
        m_gen = sum(gen[m]) * days
        m_load = sum(load[m]) * days
        for _day in range(days):
            for h in range(24):
                g = gen[m][h]
                l = load[m][h]
                direct = min(g, l)
                surplus = g - direct
                deficit = l - direct
                # 充电（受可用容量上限约束）
                room = max(0, usable_capacity - soc)
                charge = min(surplus, room)
                # 充电效率：储入电池的能量 = charge × √RTE（简化为 charge × RTE_in）
                # 简化采用：充进去全算（RTE 在放电时一次性扣除）
                soc += charge
                # 放电：实际可输出 = soc × RTE
                avail_out = soc * rte
                discharge = min(deficit, avail_out)
                # 扣减 SOC：实际从电池抽走 = discharge / RTE
                soc -= discharge / rte if rte > 0 else 0
                soc = max(0.0, soc)

                exp = surplus - charge
                imp = deficit - discharge

                m_direct += direct
                m_disch  += discharge
                m_charge += charge
                m_exp    += exp
                m_imp    += imp

        direct_total += m_direct
        discharge_total += m_disch
        charge_total += m_charge
        export_total += m_exp
        import_total += m_imp
        gen_total   += m_gen
        load_total  += m_load

        month_summary.append({
            'month': m + 1,
            'gen_kwh': m_gen, 'load_kwh': m_load,
            'direct': m_direct, 'discharge': m_disch, 'charge': m_charge,
            'export': m_exp, 'import': m_imp,
            'self_use': m_direct + m_disch,
        })

    return {
        'gen_total': gen_total, 'load_total': load_total,
        'direct': direct_total, 'discharge': discharge_total,
        'charge': charge_total, 'export': export_total, 'import_grid': import_total,
        'self_use': direct_total + discharge_total,
        'SCR': (direct_total + discharge_total) / gen_total if gen_total > 0 else 0,
        'SSR': (direct_total + discharge_total) / load_total if load_total > 0 else 0,
        'monthly': month_summary,
        'usable_capacity': usable_capacity,
    }


# ────────────────────────────────────────────────
# 报告
# ────────────────────────────────────────────────
def render_report(case, mode, sc, lp, gen, load, sim):
    lines = []
    add = lines.append
    add(f'# 能量流报告 · case `{case["case_id"]}` · {mode} · tier `{case["tier"]}`')
    add('')
    add('> 步骤 3 / 4 · 引擎 = 12×24 月度小时矩阵 + 日循环电池模拟')
    add('')

    # 1. 输入
    if mode == 'R':
        actual_pv = sc['actual_pv']
        actual_panels = sc['actual_panels']
        bat_kwh = sc['rh']['bat_kWh']
    else:
        actual_pv = sc['n']['actual_pv']
        actual_panels = sc['n']['actual_panels']
        bat_kwh = sc['n']['bat_kWh']

    add('## 1. 输入')
    add('')
    add('| 项 | 值 |')
    add('|---|---|')
    add(f'| 选中面板 | {actual_panels} 块 ({actual_pv:.2f} kWp) |')
    add(f'| 电池容量 | {bat_kwh} kWh（usable={sim["usable_capacity"]:.2f} kWh, DoD={P.BATT_DOD}, RTE={P.BATT_RTE}） |')
    add(f'| 年用电 final | {lp["totals"]["final"]:,.1f} kWh |')
    add(f'| 年发电（选板合计） | {sim["gen_total"]:,.1f} kWh |')
    add('')

    # 2. 发电矩阵
    add('## 2. 发电矩阵 gen[m][h]（kWh/小时，典型日）')
    add('')
    add('| 月\\h | ' + ' | '.join(f'{h:02d}' for h in range(24)) + ' | 日合 |')
    add('|---' * 26 + '|')
    for m in range(12):
        row = ' | '.join(f'{gen[m][h]:.2f}' for h in range(24))
        add(f'| {P.MONTH_ZH[m]} | {row} | **{sum(gen[m]):.2f}** |')
    add('')

    # 3. 用电矩阵
    add('## 3. 用电矩阵 load[m][h]（kWh/小时，典型日）')
    add('')
    add('| 月\\h | ' + ' | '.join(f'{h:02d}' for h in range(24)) + ' | 日合 |')
    add('|---' * 26 + '|')
    for m in range(12):
        row = ' | '.join(f'{load[m][h]:.2f}' for h in range(24))
        add(f'| {P.MONTH_ZH[m]} | {row} | **{sum(load[m]):.2f}** |')
    add('')

    # 4. 电池模拟公式
    add('## 4. 电池模拟（日循环 · 月初 SOC=0）')
    add('')
    add('```')
    add('usable_capacity = bat × DoD = {:.2f} × {} = {:.2f} kWh'.format(bat_kwh, P.BATT_DOD, sim["usable_capacity"]))
    add('for each h ∈ 0..23:')
    add('    direct    = min(gen[h], load[h])                  # 直接消纳')
    add('    surplus   = gen[h] - direct                       # 剩余可充电')
    add('    deficit   = load[h] - direct                      # 缺口待补')
    add('    charge    = min(surplus, usable_capacity - soc)   # 充电')
    add('    soc      += charge')
    add('    discharge = min(deficit, soc × RTE)               # 放电')
    add('    soc      -= discharge / RTE')
    add('    export[h] = surplus - charge                      # 馈网')
    add('    import[h] = deficit - discharge                   # 购电')
    add('```')
    add('')

    # 5. 月度汇总
    add('## 5. 月度汇总')
    add('')
    add('| 月 | 发电 | 用电 | 直接消纳 | 电池放电 | 馈网 | 购电 | 自用合计 |')
    add('|---|---|---|---|---|---|---|---|')
    for r in sim['monthly']:
        add(f'| {P.MONTH_ZH[r["month"]-1]} | {r["gen_kwh"]:,.1f} | {r["load_kwh"]:,.1f} | '
            f'{r["direct"]:,.1f} | {r["discharge"]:,.1f} | {r["export"]:,.1f} | '
            f'{r["import"]:,.1f} | {r["self_use"]:,.1f} |')
    add(f'| **合计** | **{sim["gen_total"]:,.1f}** | **{sim["load_total"]:,.1f}** | '
        f'**{sim["direct"]:,.1f}** | **{sim["discharge"]:,.1f}** | **{sim["export"]:,.1f}** | '
        f'**{sim["import_grid"]:,.1f}** | **{sim["self_use"]:,.1f}** |')
    add('')

    # 6. 关键指标
    add('## 6. 关键指标')
    add('')
    add('| 指标 | 公式 | 值 |')
    add('|---|---|---|')
    add(f'| 自用率 SCR | (direct + discharge) / gen_total | '
        f'({sim["direct"]:.1f}+{sim["discharge"]:.1f}) / {sim["gen_total"]:.1f} = **{sim["SCR"]*100:.2f}%** |')
    add(f'| 自给率 SSR | (direct + discharge) / load_total | '
        f'({sim["direct"]:.1f}+{sim["discharge"]:.1f}) / {sim["load_total"]:.1f} = **{sim["SSR"]*100:.2f}%** |')
    add(f'| 馈网比例 | export / gen_total | {sim["export"]/sim["gen_total"]*100 if sim["gen_total"] else 0:.2f}% |')
    add(f'| 购电比例 | import / load_total | {sim["import_grid"]/sim["load_total"]*100 if sim["load_total"] else 0:.2f}% |')
    add('')

    # 7. 自检
    add('## 7. 自检')
    add('')
    bal_gen = sim['direct'] + sim['charge'] + sim['export']
    bal_load = sim['direct'] + sim['discharge'] + sim['import_grid']
    add(f'- 发电守恒：direct + charge + export = {bal_gen:.1f}  ↔ gen_total = {sim["gen_total"]:.1f}  '
        f'差额 = {bal_gen - sim["gen_total"]:.4f} {"✅" if abs(bal_gen-sim["gen_total"])<1 else "⚠"}')
    add(f'- 用电守恒：direct + discharge + import = {bal_load:.1f}  ↔ load_total = {sim["load_total"]:.1f}  '
        f'差额 = {bal_load - sim["load_total"]:.4f} {"✅" if abs(bal_load-sim["load_total"])<1 else "⚠"}')
    add('')

    return '\n'.join(lines)


# ────────────────────────────────────────────────
# 处理 case
# ────────────────────────────────────────────────
def process_case(case, data_dir, output_dir):
    case_id = case['case_id']
    out_dir = output_dir / case_id

    lp_file = out_dir / '01_load_profile.json'
    if not lp_file.exists():
        print(f'  ⚠ [{case_id}] 缺 01_load_profile.json，跳过')
        return
    lp = json.loads(lp_file.read_text(encoding='utf-8'))

    panels_all = []
    pan_file = data_dir / case_id / 'panel_location.json'
    if pan_file.exists():
        panels_all = json.loads(pan_file.read_text(encoding='utf-8'))

    for mode in ('R', 'N'):
        sub = out_dir / mode
        sc_file = sub / '02_system_composition.json'
        if not sc_file.exists():
            continue
        sc = json.loads(sc_file.read_text(encoding='utf-8'))

        n_select = sc['actual_panels'] if mode == 'R' else sc['n']['actual_panels']
        bat_kwh = sc['rh']['bat_kWh'] if mode == 'R' else sc['n']['bat_kWh']
        # 选板（按年发电量降序）
        sorted_panels = sorted(
            panels_all,
            key=lambda p: (p.get('generationPower') or {}).get('annualGeneratePower', 0),
            reverse=True,
        )
        chosen = sorted_panels[:n_select] if n_select > 0 else []

        gen, _ = build_generation_matrix(chosen)
        load, h_share = build_load_matrix(lp)
        sim = simulate_battery(gen, load, bat_kwh)

        out = {
            'case_id': case_id, 'mode': mode, 'tier': case['tier'],
            'selected_panels': n_select,
            'bat_kwh': bat_kwh,
            'totals': {
                'gen_total': sim['gen_total'],
                'load_total': sim['load_total'],
                'direct': sim['direct'],
                'discharge': sim['discharge'],
                'charge': sim['charge'],
                'export': sim['export'],
                'import_grid': sim['import_grid'],
                'self_use': sim['self_use'],
                'SCR': sim['SCR'], 'SSR': sim['SSR'],
            },
            'monthly': sim['monthly'],
            'matrix_gen': gen,
            'matrix_load': load,
            'hour_share': h_share,
        }
        (sub / '03_energy_flow.json').write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
        (sub / '03_energy_flow.md').write_text(
            render_report(case, mode, sc, lp, gen, load, sim), encoding='utf-8')
        print(f'  ✓ [{case_id}/{mode}] gen={sim["gen_total"]:,.0f} load={sim["load_total"]:,.0f} '
              f'SCR={sim["SCR"]*100:.1f}% SSR={sim["SSR"]*100:.1f}% '
              f'import={sim["import_grid"]:,.0f} export={sim["export"]:,.0f}')


def main():
    ap = argparse.ArgumentParser(description='DE V1.13 · 步骤 3：能量流')
    ap.add_argument('--cases', required=True)
    ap.add_argument('--data-dir', required=True)
    ap.add_argument('--output-dir', required=True)
    args = ap.parse_args()
    from parse_cases import parse_cases_md
    cases = parse_cases_md(args.cases)
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    print(f'步骤 3 / 能量流：处理 {len(cases)} 个 case')
    for c in cases:
        process_case(c, data_dir, output_dir)
    print('完成。')


if __name__ == '__main__':
    main()
