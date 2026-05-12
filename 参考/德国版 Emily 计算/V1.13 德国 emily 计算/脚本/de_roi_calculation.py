"""
DE V1.13 · 步骤 4：投资回报 (ROI)
─────────────────────────────────────────────────────────────────
对齐 DE_基础参数.md：
  - PV：550 EUR/kWp
  - Inverter：330 EUR/kW
  - Battery：400 EUR/kWh
  - 购电 0.35 / 馈网 0.07 / 日固定费 0.7 EUR
  - 电费通胀 2% / 现金利率 3.5%（也作 NPV 折现率） / GST 0%
  - N_battery = 0（不换电池）

R 改造模式：sysCost 仅计算 added_kwp × pv_eur + inv × inv_eur + bat × batt_eur
N 全新建：sysCost = actual_pv × pv_eur + inv × inv_eur + bat × batt_eur

年现金流（持有 N 年）：
  baseline_cost[t]  = load_total × buy × (1+inf)^t + fixed_daily × 365     # 不装系统的电费
  remain_cost[t]    = import × buy × (1+inf)^t + fixed_daily × 365         # 装系统后还需购买的电费
  export_income[t]  = export × sell                                        # 馈网收入（不通胀）
  saving[t]         = baseline_cost[t] - remain_cost[t] + export_income[t]
  cf[0]             = -sysCost
  cf[t]             = saving[t]   (t = 1..N)

输出指标：
  - IRR (Newton 迭代)
  - NPV @ cash_rate
  - 回本期 (Payback) — 线性插值
  - 累计净现金流曲线
"""
import argparse
import json
import math
from pathlib import Path

import de_params as P


# ────────────────────────────────────────────────
# 金融工具
# ────────────────────────────────────────────────
def npv(rate, cash_flows):
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cash_flows))


def irr(cash_flows, guess=0.1, tol=1e-6, max_iter=200):
    """Newton 法求 IRR；失败则 fallback 二分搜索 [-0.99, 1.0]。"""
    # 简单检查可行性：必须有正负现金流
    if all(cf >= 0 for cf in cash_flows) or all(cf <= 0 for cf in cash_flows):
        return None
    r = guess
    for _ in range(max_iter):
        f = sum(cf / (1 + r) ** t for t, cf in enumerate(cash_flows))
        fp = sum(-t * cf / (1 + r) ** (t + 1) for t, cf in enumerate(cash_flows))
        if abs(fp) < 1e-12:
            break
        r_new = r - f / fp
        if abs(r_new - r) < tol:
            return r_new
        r = r_new
    # fallback：二分
    lo, hi = -0.99, 1.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(mid, cash_flows) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def payback_period(cash_flows):
    """线性插值回本期；如果不回本返回 None。"""
    cum = 0.0
    for t, cf in enumerate(cash_flows):
        prev = cum
        cum += cf
        if prev < 0 <= cum:
            # 在 [t-1, t] 之间，cf=cum-prev，prev + frac*cf = 0
            if cf != 0:
                frac = -prev / cf
                return (t - 1) + frac
            return t
    return None


# ────────────────────────────────────────────────
# 成本
# ────────────────────────────────────────────────
def compute_sys_cost(mode, sc):
    """返回 (sys_cost_eur, breakdown_dict)"""
    if mode == 'R':
        added_kwp = sc['rh']['added_kwp']
        actual_pv = sc['actual_pv']
        inv_kw    = sc['inverter']['inv_kw']
        bat_kwh   = sc['rh']['bat_kWh']
        # R-H/R-B 都仅计算 added_kwp 的 PV 成本（既有 PV 不计）
        pv_cost   = added_kwp * P.COST_PV_EUR_PER_KWP
    else:
        actual_pv = sc['n']['actual_pv']
        inv_kw    = sc['n']['inv']['inv_kw']
        bat_kwh   = sc['n']['bat_kWh']
        pv_cost   = actual_pv * P.COST_PV_EUR_PER_KWP

    inv_cost  = inv_kw * P.COST_INV_EUR_PER_KW
    bat_cost  = bat_kwh * P.COST_BATT_EUR_PER_KWH
    subtotal  = pv_cost + inv_cost + bat_cost
    gst       = subtotal * P.GST_RATE
    total     = subtotal + gst
    return total, {
        'pv_cost': pv_cost, 'inv_cost': inv_cost, 'bat_cost': bat_cost,
        'subtotal': subtotal, 'gst': gst, 'total': total,
        'rate_pv': P.COST_PV_EUR_PER_KWP, 'rate_inv': P.COST_INV_EUR_PER_KW,
        'rate_bat': P.COST_BATT_EUR_PER_KWH, 'gst_rate': P.GST_RATE,
        'pv_basis_kwp': (sc['rh']['added_kwp'] if mode == 'R' else sc['n']['actual_pv']),
        'inv_kw': inv_kw, 'bat_kwh': bat_kwh,
    }


# ────────────────────────────────────────────────
# 现金流
# ────────────────────────────────────────────────
def build_cashflow(years, sys_cost, ef_totals):
    load_total   = ef_totals['load_total']
    import_grid  = ef_totals['import_grid']
    export_grid  = ef_totals['export']

    buy   = P.GRID_BUY_RATE
    sell  = P.GRID_SELL_RATE
    inf   = P.ELEC_INFLATION_RATE
    fixed = P.DAILY_FIXED_CHARGE * 365

    rows = []
    cum  = -sys_cost
    cf   = [-sys_cost]
    rows.append({
        'year': 0, 'baseline_cost': 0, 'remain_cost': 0,
        'export_income': 0, 'saving': 0, 'cash_flow': -sys_cost,
        'cumulative': cum,
    })
    for t in range(1, years + 1):
        factor       = (1 + inf) ** (t - 1)  # 第 1 年使用 t-1=0（不通胀），如需第 1 年就涨价改为 ** t
        baseline_cost = load_total * buy * factor + fixed
        remain_cost   = import_grid * buy * factor + fixed
        export_income = export_grid * sell  # 馈网价默认不通胀
        saving        = baseline_cost - remain_cost + export_income
        cum += saving
        cf.append(saving)
        rows.append({
            'year': t, 'baseline_cost': baseline_cost, 'remain_cost': remain_cost,
            'export_income': export_income, 'saving': saving,
            'cash_flow': saving, 'cumulative': cum,
        })
    return cf, rows


# ────────────────────────────────────────────────
# 报告
# ────────────────────────────────────────────────
def render_report(case, mode, sc, ef, sys_cost, cost_b, cf, rows, irr_v, npv_v, pb):
    lines = []
    add = lines.append
    add(f'# ROI 报告 · case `{case["case_id"]}` · {mode} · tier `{case["tier"]}`')
    add('')
    add('> 步骤 4 / 4 · 引擎 = DE €参数 IRR/NPV/Payback')
    add('')

    # 1. 投资
    add('## 1. 投资成本（前期一次性）')
    add('')
    pv_basis_label = "added_kwp（R 模式仅算新增 PV）" if mode == 'R' else "actual_pv（N 模式全部 PV）"
    add('| 项 | 单价 | 用量 | 金额 EUR |')
    add('|---|---|---|---|')
    add(f'| PV 面板 ({pv_basis_label}) | {cost_b["rate_pv"]} €/kWp | {cost_b["pv_basis_kwp"]:.2f} kWp | {cost_b["pv_cost"]:,.0f} |')
    add(f'| 逆变器 | {cost_b["rate_inv"]} €/kW | {cost_b["inv_kw"]} kW | {cost_b["inv_cost"]:,.0f} |')
    add(f'| 电池 | {cost_b["rate_bat"]} €/kWh | {cost_b["bat_kwh"]} kWh | {cost_b["bat_cost"]:,.0f} |')
    add(f'| 小计 | – | – | {cost_b["subtotal"]:,.0f} |')
    add(f'| GST ({cost_b["gst_rate"]*100:.0f}%) | – | – | {cost_b["gst"]:,.0f} |')
    add(f'| **总投资** | – | – | **{cost_b["total"]:,.0f}** |')
    add('')

    # 2. 财务参数
    add('## 2. 财务参数')
    add('')
    add('| 参数 | 值 |')
    add('|---|---|')
    add(f'| 购电价 buy | {P.GRID_BUY_RATE} €/kWh |')
    add(f'| 馈网价 sell | {P.GRID_SELL_RATE} €/kWh |')
    add(f'| 日固定费 daily_fixed | {P.DAILY_FIXED_CHARGE} €/天 × 365 = {P.DAILY_FIXED_CHARGE*365:.2f} €/年 |')
    add(f'| 电费通胀 inflation | {P.ELEC_INFLATION_RATE*100:.1f}% |')
    add(f'| 现金利率 (NPV 折现率) | {P.CASH_INTEREST_RATE*100:.1f}% |')
    add(f'| 评估年限 | {len(cf)-1} 年 |')
    add(f'| 换电池年 | {P.N_BATTERY_REPLACE}（0 = 不换电池） |')
    add('')

    # 3. 公式
    add('## 3. 年现金流公式')
    add('')
    add('```')
    add('baseline_cost[t] = load_total × buy × (1+inf)^(t-1) + fixed_daily × 365')
    add('remain_cost[t]   = import × buy × (1+inf)^(t-1) + fixed_daily × 365')
    add('export_income[t] = export × sell                  # 馈网价不通胀')
    add('saving[t]        = baseline_cost - remain_cost + export_income')
    add('cf[0]            = -sysCost')
    add('cf[t]            = saving[t]')
    add('```')
    add('')
    add(f'其中：load_total = {ef["load_total"]:,.1f}, import = {ef["import_grid"]:,.1f}, '
        f'export = {ef["export"]:,.1f} (来自步骤 3)')
    add('')

    # 4. 年现金流表
    add('## 4. 年现金流（20 年）')
    add('')
    add('| 年 | 不装系统的电费 | 装后剩余电费 | 馈网收入 | 年节省 | 累计净现金流 |')
    add('|---|---|---|---|---|---|')
    for r in rows:
        if r['year'] == 0:
            add(f'| 0 | – | – | – | – | {r["cumulative"]:,.0f} (投资) |')
        else:
            add(f'| {r["year"]} | {r["baseline_cost"]:,.0f} | {r["remain_cost"]:,.0f} | '
                f'{r["export_income"]:,.0f} | {r["saving"]:,.0f} | {r["cumulative"]:,.0f} |')
    add('')

    # 5. 指标
    add('## 5. 关键指标')
    add('')
    add('| 指标 | 值 |')
    add('|---|---|')
    add(f'| 总投资 | €{sys_cost:,.0f} |')
    add(f'| 第 1 年节省 | €{rows[1]["saving"]:,.0f} |')
    add(f'| {len(cf)-1} 年累计节省 | €{rows[-1]["cumulative"] + sys_cost:,.0f} |')
    add(f'| **IRR** | {"–" if irr_v is None else f"{irr_v*100:.2f}%"} |')
    add(f'| **NPV @ {P.CASH_INTEREST_RATE*100:.1f}%** | €{npv_v:,.0f} |')
    add(f'| **回本期 Payback** | {"–" if pb is None else f"{pb:.2f} 年"} |')
    add('')

    return '\n'.join(lines)


# ────────────────────────────────────────────────
# 处理 case
# ────────────────────────────────────────────────
def process_case(case, output_dir, years):
    case_id = case['case_id']
    out_dir = output_dir / case_id

    for mode in ('R', 'N'):
        sub = out_dir / mode
        sc_file = sub / '02_system_composition.json'
        ef_file = sub / '03_energy_flow.json'
        if not (sc_file.exists() and ef_file.exists()):
            continue
        sc = json.loads(sc_file.read_text(encoding='utf-8'))
        ef = json.loads(ef_file.read_text(encoding='utf-8'))
        ef_totals = ef['totals']

        sys_cost, cost_b = compute_sys_cost(mode, sc)
        cf, rows = build_cashflow(years, sys_cost, ef_totals)
        irr_v = irr(cf)
        npv_v = npv(P.CASH_INTEREST_RATE, cf)
        pb = payback_period(cf)

        out = {
            'case_id': case_id, 'mode': mode, 'tier': case['tier'],
            'sys_cost': sys_cost, 'cost_breakdown': cost_b,
            'financial': {
                'years': years,
                'buy_rate': P.GRID_BUY_RATE, 'sell_rate': P.GRID_SELL_RATE,
                'daily_fixed': P.DAILY_FIXED_CHARGE,
                'inflation': P.ELEC_INFLATION_RATE,
                'cash_rate': P.CASH_INTEREST_RATE,
            },
            'cashflow': cf,
            'rows': rows,
            'IRR': irr_v, 'NPV': npv_v, 'payback_years': pb,
        }
        (sub / '04_roi.json').write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
        (sub / '04_roi.md').write_text(
            render_report(case, mode, sc, ef_totals, sys_cost, cost_b, cf, rows, irr_v, npv_v, pb),
            encoding='utf-8')
        irr_s = '–' if irr_v is None else f'{irr_v*100:.2f}%'
        pb_s  = '–' if pb is None else f'{pb:.2f}'
        print(f'  ✓ [{case_id}/{mode}] cost=€{sys_cost:,.0f} IRR={irr_s} NPV=€{npv_v:,.0f} payback={pb_s}年')


def main():
    ap = argparse.ArgumentParser(description='DE V1.13 · 步骤 4：ROI')
    ap.add_argument('--cases', required=True)
    ap.add_argument('--output-dir', required=True)
    ap.add_argument('--years', type=int, default=P.DEFAULT_ROI_YEARS)
    args = ap.parse_args()
    from parse_cases import parse_cases_md
    cases = parse_cases_md(args.cases)
    output_dir = Path(args.output_dir)
    print(f'步骤 4 / ROI：处理 {len(cases)} 个 case  (years={args.years})')
    for c in cases:
        process_case(c, output_dir, args.years)
    print('完成。')


if __name__ == '__main__':
    main()
