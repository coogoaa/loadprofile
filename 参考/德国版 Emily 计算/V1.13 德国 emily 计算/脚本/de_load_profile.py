"""
DE V1.13 · 步骤 1：Load Profile 计算
─────────────────────────────────────────────────────────────────
对齐 de_v3.js 的 calcLoad()。
输入：state（来自 request.json）+ Q2/Q3/Q4/Q5（来自 cases.md）
输出：
  - 01_load_profile.json   机器读：年/月/小时分布、所有中间变量
  - 01_load_profile.md     人读：完整公式 + 步骤推导 + 中间变量表 + 源引用
"""
import argparse
import json
import math
from pathlib import Path

import de_params as P


# ────────────────────────────────────────────────
# 核心计算（移植自 de_v3.js calcLoad）
# ────────────────────────────────────────────────
def calc_load(state, hvac, usage, ev_km, ev_time, occ='someone_at_home'):
    """计算 Load Profile，返回包含全部中间变量的 dict（便于报告生成）。

    公式总览（与 de_v3.js 完全一致）：
        base    = BASE[state]
        u       = UC[usage]
        t_base  = HVAC[hvac]
        t_ext   = t_base × u.am                   # 暖通增量
        ev_ext  = ev_km × 0.18                    # EV 增量
        final   = base + t_ext + ev_ext           # 年总用电

      月度（12）：
        sm[i]   = 1 + (制冷月? u.cmm-1 : 0) + (制热月? u.hmm-1 : 0)
        rb[i]   = base × DE_MONTHLY[i] × sm[i]    # 中间月分布
        nb[i]   = rb[i] / sum(rb) × base          # 归一化基础月用电
        tw[i]   = (制冷月? DE_MONTHLY[i]×u.cmm : 0)
                + (制热月? DE_MONTHLY[i]×u.hmm : 0)
        ta[i]   = tw[i] / sum(tw) × t_ext         # 暖通月分布
        ea[i]   = ev_ext / 12                     # EV 月分布（均匀）
        fkm[i]  = nb[i] + ta[i] + ea[i]           # 最终月度 kWh

      小时（24）：
        om[h]   = 占空比因子（白天 hour ∈ DAY_HOURS 用 occ_v，否则 1.0）
        pm[h]   = 暖通峰值乘子（晚峰小时 × cpm，早晚峰 × hpm）
        adj[h]  = DE_HOURLY[h] × om[h] × pm[h]
        ns[h]   = adj[h] / sum(adj)               # 归一化小时占比
        nek[h]  = (base + t_ext)/365 × ns[h]      # 非 EV 小时 kWh
        evk[h]  = ev_ext/365 × EV_PROFILE[ev_time][h]
        fkd[h]  = nek[h] + evk[h]                 # 最终小时 kWh
    """
    # ── 入参兜底 ──
    state  = state if state in P.BASE else 'BY'  # 找不到州时默认 BY
    hvac   = hvac   if hvac   in P.HVAC else 'no_system'
    usage  = usage  if usage  in P.UC   else 'medium'
    ev_time = ev_time if ev_time in P.EV_PROFILE else 'mostly_overnight'
    occ    = occ    if occ    in P.OCC  else 'someone_at_home'
    ev_km  = max(0, int(ev_km or 0))

    base   = P.BASE[state]
    u      = P.UC[usage]
    t_base = P.HVAC[hvac]
    pc     = hvac in P.COOL_SYS
    ph     = hvac in P.HEAT_SYS
    occ_v  = P.OCC[occ]
    ev_dist = P.EV_PROFILE[ev_time]

    # ── 年总量 ──
    t_ext  = t_base * u['am']
    ev_ext = ev_km * P.EV_KWH_PER_KM
    final  = base + t_ext + ev_ext

    bms = P.DE_MONTHLY
    hb  = P.DE_HOURLY

    # ── 月度分布 ──
    sm = [1
          + (u['cmm'] - 1 if pc and P.COOL_M[i] else 0)
          + (u['hmm'] - 1 if ph and P.HEAT_M[i] else 0)
          for i in range(12)]
    rb  = [base * bms[i] * sm[i] for i in range(12)]
    srb = sum(rb)
    nb  = [v / srb * base for v in rb]

    tw  = [((bms[i] * u['cmm']) if pc and P.COOL_M[i] else 0)
         + ((bms[i] * u['hmm']) if ph and P.HEAT_M[i] else 0)
         for i in range(12)]
    stw = sum(tw)
    ta  = [(w / stw * t_ext) if stw > 0 else 0 for w in tw]
    ea  = [ev_ext / 12.0 for _ in range(12)]
    fkm = [nb[i] + ta[i] + ea[i] for i in range(12)]
    fsm = [v / final for v in fkm] if final > 0 else [0]*12

    # ── 小时分布 ──
    om = [occ_v if h in P.DAY_HOURS else 1.0 for h in range(24)]
    pm = [((u['cpm'] if pc and h in P.EVE_PEAK_HOURS else 1.0)
         * (u['hpm'] if ph and h in P.MORN_PEAK_HOURS else 1.0))
        for h in range(24)]
    adj  = [hb[h] * om[h] * pm[h] for h in range(24)]
    sadj = sum(adj)
    ns   = [v / sadj for v in adj]

    dne = (base + t_ext) / 365.0
    dev = ev_ext / 365.0
    nek = [dne * v for v in ns]
    evk = [dev * v for v in ev_dist]
    fkd = [nek[h] + evk[h] for h in range(24)]
    davg = final / 365.0
    fhs  = [(v / davg if davg > 0 else 0) for v in fkd]

    # ── 时段聚合 ──
    dtk = sum(fkd[h] for h in P.DAY_HOURS)               # 白天
    epk = sum(fkd[h] for h in (18, 19, 20))              # 傍晚高峰
    onk = sum(fkd[h] for h in (18,19,20,21,22,23,0,1,2,3,4,5))  # 整夜

    return {
        'inputs': {
            'state': state, 'state_zh': P.STATE_ZH[state],
            'hvac': hvac, 'hvac_zh': P.HVAC_ZH[hvac],
            'usage': usage, 'usage_zh': P.USE_ZH[usage],
            'ev_km': ev_km, 'ev_time': ev_time,
            'occ': occ, 'occ_zh': P.OCC_ZH[occ],
        },
        'totals': {
            'base': base, 't_base': t_base, 't_ext': t_ext, 'ev_ext': ev_ext,
            'final': final, 'davg': davg,
            'pc': pc, 'ph': ph, 'occ_v': occ_v, 'u': u,
        },
        'monthly': {
            'sm': sm, 'rb': rb, 'srb': srb, 'nb': nb,
            'tw': tw, 'stw': stw, 'ta': ta, 'ea': ea,
            'fkm': fkm, 'fsm': fsm,
        },
        'hourly': {
            'om': om, 'pm': pm, 'adj': adj, 'sadj': sadj, 'ns': ns,
            'dne': dne, 'dev': dev, 'nek': nek, 'evk': evk,
            'fkd': fkd, 'fhs': fhs,
        },
        'periods': {
            'daytime_kwh': dtk, 'daytime_pct': dtk / davg * 100 if davg else 0,
            'evening_peak_kwh': epk, 'evening_peak_pct': epk / davg * 100 if davg else 0,
            'overnight_kwh': onk, 'overnight_pct': onk / davg * 100 if davg else 0,
        },
    }


# ────────────────────────────────────────────────
# 报告生成
# ────────────────────────────────────────────────
def fmt(v, d=2):
    if v is None:
        return '–'
    if isinstance(v, bool):
        return '是' if v else '否'
    if isinstance(v, float):
        return f'{v:,.{d}f}'
    return str(v)


def render_report(case, res):
    inp, tot, mo, ho, pe = res['inputs'], res['totals'], res['monthly'], res['hourly'], res['periods']
    u = tot['u']

    lines = []
    add = lines.append

    add(f'# Load Profile 计算报告 · case `{case["case_id"]}`')
    add('')
    add(f'> 步骤 1 / 4 · 计算引擎 = `de_v3.js` calcLoad()')
    add(f'> 参数源 = `de_params.py`（同步自 `德国参数/DE_*.md`）')
    add('')

    # 1. 输入
    add('## 1. 输入')
    add('')
    add('| 字段 | 值 | 说明 |')
    add('|---|---|---|')
    add(f'| 州 (state) | `{inp["state"]}` ({inp["state_zh"]}) | 来源：request.json → project.state |')
    add(f'| Q2 暖通系统 | `{inp["hvac"]}` ({inp["hvac_zh"]}) | t_base = {tot["t_base"]} kWh |')
    add(f'| Q3 使用强度 | `{inp["usage"]}` ({inp["usage_zh"]}) | am={u["am"]} cmm={u["cmm"]} hmm={u["hmm"]} cpm={u["cpm"]} hpm={u["hpm"]} |')
    add(f'| Q4 EV 年里程 | {inp["ev_km"]} km | EV_KWH_PER_KM = {P.EV_KWH_PER_KM} |')
    add(f'| Q5 EV 充电时段 | `{inp["ev_time"]}` | 24 小时分布见附录 |')
    add(f'| 在家因子 | `{inp["occ"]}` ({inp["occ_zh"]}) | occ_v = {tot["occ_v"]} |')
    add(f'| 触发冷气 (pc) | {fmt(tot["pc"])} | hvac ∈ {{air_con, heat_pump}} |')
    add(f'| 触发取暖 (ph) | {fmt(tot["ph"])} | hvac ∈ {{electric_heat, heat_pump}} |')
    add('')

    # 2. 年总量
    add('## 2. 年总量推导')
    add('')
    add('```')
    add(f'base    = BASE["{inp["state"]}"]                = {fmt(tot["base"], 0)} kWh')
    add(f't_base  = HVAC["{inp["hvac"]}"]              = {fmt(tot["t_base"], 0)} kWh')
    add(f't_ext   = t_base × u.am   = {tot["t_base"]} × {u["am"]}   = {fmt(tot["t_ext"], 1)} kWh   # 暖通年增量')
    add(f'ev_ext  = ev_km × 0.18    = {inp["ev_km"]} × 0.18   = {fmt(tot["ev_ext"], 1)} kWh   # EV 年增量')
    add(f'final   = base + t_ext + ev_ext')
    add(f'        = {fmt(tot["base"],0)} + {fmt(tot["t_ext"],1)} + {fmt(tot["ev_ext"],1)}')
    add(f'        = {fmt(tot["final"], 1)} kWh / 年')
    add(f'davg    = final / 365   = {fmt(tot["davg"], 2)} kWh / 日')
    add('```')
    add('')

    # 3. 月度分布
    add('## 3. 月度分布（12 个月，单位 kWh）')
    add('')
    add(f'**月度乘子 sm[i]** = 1 + (制冷月? cmm−1 : 0) + (制热月? hmm−1 : 0)')
    add('')
    add('| 月 | DE_月度比例 | 制冷? | 制热? | sm[i] | rb[i]=base×ratio×sm | nb[i](基础) | tw[i] | ta[i](暖通) | ea[i](EV) | **fkm[i]** | 占比 |')
    add('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for i in range(12):
        add(f'| {P.MONTH_ZH[i]} | {P.DE_MONTHLY[i]:.4f} | {"●" if P.COOL_M[i] else "·"} | '
            f'{"●" if P.HEAT_M[i] else "·"} | {mo["sm"][i]:.3f} | {mo["rb"][i]:,.1f} | '
            f'{mo["nb"][i]:,.1f} | {mo["tw"][i]:.4f} | {mo["ta"][i]:,.1f} | {mo["ea"][i]:,.1f} | '
            f'**{mo["fkm"][i]:,.1f}** | {mo["fsm"][i]*100:.2f}% |')
    add(f'| **合计** | 1.0000 | – | – | – | {mo["srb"]:,.1f} | {tot["base"]:,.0f} | '
        f'{mo["stw"]:.4f} | {tot["t_ext"]:,.1f} | {tot["ev_ext"]:,.1f} | '
        f'**{sum(mo["fkm"]):,.1f}** | 100.00% |')
    add('')

    # 4. 小时分布
    add('## 4. 小时分布（24 小时，单位 kWh）')
    add('')
    add(f'**om[h]** = 占空比 = `{tot["occ_v"]}` if h∈DAY_HOURS else `1.0`  → 白天小时 = `{sorted(P.DAY_HOURS)}`')
    add(f'**pm[h]** = 峰乘子 = (制冷峰? cpm={u["cpm"]} : 1) × (制热峰? hpm={u["hpm"]} : 1)')
    add(f'  - 制冷峰小时 EVE_PEAK = `{sorted(P.EVE_PEAK_HOURS)}`')
    add(f'  - 制热峰小时 MORN_PEAK = `{sorted(P.MORN_PEAK_HOURS)}`')
    add('')
    add(f'**adj[h]** = DE_HOURLY[h] × om[h] × pm[h]; **ns[h]** = adj[h] / Σadj = {ho["sadj"]:.4f}')
    add(f'**dne** = (base + t_ext) / 365 = {ho["dne"]:.3f} kWh/日')
    add(f'**dev** = ev_ext / 365 = {ho["dev"]:.3f} kWh/日')
    add('')
    add('| h | DE_小时 | 白天 | 晚峰 | 早峰 | om | pm | adj | ns | nek=dne·ns | evk=dev·EVP | **fkd** | fhs(对均值) |')
    add('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for h in range(24):
        add(f'| {h:02d} | {P.DE_HOURLY[h]:.4f} | {"●" if h in P.DAY_HOURS else "·"} | '
            f'{"●" if h in P.EVE_PEAK_HOURS else "·"} | {"●" if h in P.MORN_PEAK_HOURS else "·"} | '
            f'{ho["om"][h]:.2f} | {ho["pm"][h]:.3f} | {ho["adj"][h]:.4f} | {ho["ns"][h]:.4f} | '
            f'{ho["nek"][h]:.3f} | {ho["evk"][h]:.3f} | **{ho["fkd"][h]:.3f}** | {ho["fhs"][h]:.3f} |')
    add(f'| **Σ** | 1.0000 | – | – | – | – | – | {ho["sadj"]:.4f} | 1.0000 | '
        f'{sum(ho["nek"]):.3f} | {sum(ho["evk"]):.3f} | **{sum(ho["fkd"]):.3f}** | 24.000 |')
    add('')

    # 5. 时段聚合
    add('## 5. 时段聚合（日均）')
    add('')
    add('| 时段 | 小时集合 | kWh/日 | 占日均比 |')
    add('|---|---|---|---|')
    add(f'| 全天日均 davg | – | {tot["davg"]:.2f} | 100.00% |')
    add(f'| 白天 (DAY_HOURS) | `{sorted(P.DAY_HOURS)}` | {pe["daytime_kwh"]:.2f} | {pe["daytime_pct"]:.2f}% |')
    add(f'| 傍晚高峰 18-20 | [18,19,20] | {pe["evening_peak_kwh"]:.2f} | {pe["evening_peak_pct"]:.2f}% |')
    add(f'| 整夜 18-05 | [18-23, 0-5] | {pe["overnight_kwh"]:.2f} | {pe["overnight_pct"]:.2f}% |')
    add('')

    # 6. 校验
    add('## 6. 自检')
    add('')
    sum_fkm = sum(mo['fkm'])
    sum_fkd = sum(ho['fkd'])
    add(f'- Σ fkm[i] = {sum_fkm:,.2f}  ↔  final = {tot["final"]:,.2f}  '
        f'差额 = {sum_fkm - tot["final"]:.4f} {"✅" if abs(sum_fkm - tot["final"]) < 1e-3 else "❌"}')
    add(f'- Σ fkd[h] = {sum_fkd:.3f}  ↔  davg = {tot["davg"]:.3f}  '
        f'差额 = {sum_fkd - tot["davg"]:.4f} {"✅" if abs(sum_fkd - tot["davg"]) < 1e-3 else "❌"}')
    add(f'- Σ ns[h]  = {sum(ho["ns"]):.4f}  应 = 1.0  '
        f'{"✅" if abs(sum(ho["ns"]) - 1.0) < 1e-3 else "❌"}')
    add('')

    # 附录
    add('## 附录 · EV 充电分布')
    add('')
    add(f'`EV_PROFILE["{inp["ev_time"]}"]`（24h, sum=1）：')
    add('')
    add('```')
    add('h: ' + ' '.join(f'{h:02d}' for h in range(24)))
    add('p: ' + ' '.join(f'{v:.3f}' for v in P.EV_PROFILE[inp['ev_time']]))
    add('```')
    add('')

    return '\n'.join(lines)


# ────────────────────────────────────────────────
# CLI
# ────────────────────────────────────────────────
def get_state_from_request(case_dir):
    """从 request.json 读 state，找不到时回退 'BY'。"""
    rf = case_dir / 'request.json'
    if not rf.exists():
        return None
    try:
        data = json.loads(rf.read_text(encoding='utf-8'))
        st = (data.get('project') or {}).get('state')
        return st if st in P.BASE else None
    except Exception:
        return None


def process_case(case, data_dir, output_dir):
    case_id = case['case_id']
    case_data_dir = data_dir / case_id
    state = get_state_from_request(case_data_dir)
    if state is None:
        print(f'  ⚠ [{case_id}] request.json 缺失或 state 不识别，回退 BY')
        state = 'BY'

    res = calc_load(
        state=state,
        hvac=case['Q2_hvac'] if case['Q2_hvac'] not in (None, '-') else 'no_system',
        usage=case['Q3_usage'] if case['Q3_usage'] not in (None, '-') else 'medium',
        ev_km=case['Q4_ev_km'],
        ev_time=case['Q5_ev_time'] if case['Q5_ev_time'] not in (None, '-') else 'mostly_overnight',
    )
    res['case_id'] = case_id

    out_dir = output_dir / case_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / '01_load_profile.json').write_text(
        json.dumps(res, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    (out_dir / '01_load_profile.md').write_text(
        render_report(case, res), encoding='utf-8'
    )
    print(f'  ✓ [{case_id}] state={state} final={res["totals"]["final"]:,.0f} kWh/年 '
          f'davg={res["totals"]["davg"]:.2f} kWh/日')


def main():
    ap = argparse.ArgumentParser(description='DE V1.13 · 步骤 1：Load Profile')
    ap.add_argument('--cases', required=True, help='cases.md 路径')
    ap.add_argument('--data-dir', required=True, help='下载数据目录（含 {case_id}/request.json）')
    ap.add_argument('--output-dir', required=True, help='输出目录')
    args = ap.parse_args()

    from parse_cases import parse_cases_md
    cases = parse_cases_md(args.cases)
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f'步骤 1 / Load Profile：处理 {len(cases)} 个 case')
    for c in cases:
        process_case(c, data_dir, output_dir)
    print('完成。')


if __name__ == '__main__':
    main()
