#!/usr/bin/env python3
"""
validate_loadprofile.py — LoadProfile 计算验证脚本
基于 [PRD]SalesAgent V1.12 § 3.1

用法:
  python validate_loadprofile.py --validate
  python validate_loadprofile.py --batch
  python validate_loadprofile.py --state NSW --system "Heat pump" --usage Medium \
      --mileage 10000 --occupancy "Mostly away" --ev-charging mostly_overnight
  python validate_loadprofile.py --config my_cases.json
"""

import argparse, csv, json, sys
from pathlib import Path

# ── ANSI 颜色（不支持的终端自动降级）────────────────────────────────────────
def _c(code): return f"\033[{code}m" if sys.stdout.isatty() else ""
G = _c("92"); R = _c("91"); CY = _c("96"); B = _c("1"); DM = _c("2"); RS = _c("0")
def green(s): return f"{G}{s}{RS}"
def red(s):   return f"{R}{s}{RS}"
def bold(s):  return f"{B}{s}{RS}"
def cyan(s):  return f"{CY}{s}{RS}"
def dim(s):   return f"{DM}{s}{RS}"

# ── 格式化工具 ────────────────────────────────────────────────────────────────
def box_header(lines, w=72):
    print(f"\n╔{'═'*(w-2)}╗")
    for line in (lines if isinstance(lines, list) else [lines]):
        print(f"║  {line:<{w-4}} ║")
    print(f"╚{'═'*(w-2)}╝")

def step_header(title, subtitle, w=72):
    print(f"\n{'═'*w}")
    print(bold(f"  {title}"))
    print(f"  {dim(subtitle)}")
    print(f"{'═'*w}")

def sub(title):
    print(f"\n{cyan(f'【{title}】')}")

def formula(label, subst, result):
    """三行展示：公式 → 代入 → 结果"""
    print(f"    {dim(label)}")
    print(f"    = {subst}")
    print(f"    {bold('= ' + result)}")

def chk(name, got, expected, tol=1.0):
    ok = abs(got - expected) <= tol
    mark = green("✅ PASS") if ok else red("❌ FAIL")
    print(f"  {mark}  {name}: {got:,.3f}  (期望 ≈ {expected:,.3f})")
    return ok


# ── 参数加载 ──────────────────────────────────────────────────────────────────
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

class Params:
    def __init__(self, d="参数"):
        d = Path(d)
        self.base_annual  = self._kv(d/"AU_base_annual_kwh.csv",           "state",       "base_annual_kwh",       float)
        self.hvac_load    = self._kv(d/"AU_hvac_thermal_load.csv",          "system",      "base_thermal_load_kwh", float)
        self.usage_coeff  = self._full(d/"AU_usage_level_coefficients.csv", "usage_level")
        self.monthly_share= self._row(d/"AU_monthly_share.csv",             "state",       MONTHS)
        self.season_flags = self._season(d/"AU_cooling_heating_season_flags.csv")
        self.hourly_share = self._row(d/"AU_hourly_share.csv",              "state",       [f"H{h:02d}" for h in range(24)])
        self.occupancy    = self._kv(d/"GLOBAL_occupancy_factors.csv",      "occupancy",   "daytime_mult",          float)
        self.ev_charging  = self._ev(d/"AU_ev_charging_profiles.csv")
        self.ev_efficiency= 0.18

    def _kv(self, path, kc, vc, cast=str):
        out = {}
        with open(path) as f:
            for row in csv.DictReader(f):
                out[row[kc].strip()] = cast(row[vc])
        return out

    def _full(self, path, kc):
        out = {}
        with open(path) as f:
            for row in csv.DictReader(f):
                k = row[kc].strip()
                out[k] = {c: float(v) for c, v in row.items() if c != kc and v.replace('.','').replace('-','').lstrip('-').replace('.','').isdigit()}
        return out

    def _row(self, path, kc, cols):
        out = {}
        with open(path) as f:
            for row in csv.DictReader(f):
                out[row[kc].strip()] = [float(row[c]) for c in cols]
        return out

    def _season(self, path):
        out = {}
        with open(path) as f:
            for row in csv.DictReader(f):
                s = row["state"].strip()
                out[s] = {"cool": [int(row[f"{m}_cool"]) for m in MONTHS],
                           "heat": [int(row[f"{m}_heat"]) for m in MONTHS]}
        return out

    def _ev(self, path):
        profiles = {p: [] for p in ["mostly_overnight","mixed_day_and_night","mostly_daytime","solar_optimized"]}
        with open(path) as f:
            for row in csv.DictReader(f):
                for p in profiles:
                    profiles[p].append(float(row[p]) if row.get(p) else 0.0)
        return profiles


# ── 核心计算器 ────────────────────────────────────────────────────────────────
COOL_SYS = {"Air conditioning", "Heat pump (heating & cooling)"}
HEAT_SYS = {"Electric heating", "Heat pump (heating & cooling)"}
DAYTIME_H   = set(range(7, 17))
COOL_PEAK_H = set(range(14, 19))
HEAT_PEAK_H = set(range(6, 9)) | set(range(18, 22))

class LoadProfileCalculator:
    def __init__(self, params, state, system, usage_level,
                 mileage, occupancy, ev_charging, verbose=True):
        self.p  = params
        self.state       = state.upper()
        self.system      = system
        self.usage_level = usage_level
        self.mileage     = int(mileage)
        self.occupancy   = occupancy
        self.ev_charging = ev_charging
        self.verbose     = verbose

    def _p(self, *a, **kw):
        if self.verbose: print(*a, **kw)

    def run(self) -> dict:
        if self.verbose:
            box_header([
                f"LoadProfile 计算验证  |  {self.state} · {self.system}",
                f"Usage: {self.usage_level}  |  EV: {self.mileage:,} km ({self.ev_charging})",
                f"Occupancy: {self.occupancy}",
            ])
            self._flags()
        r1 = self._step1()
        r2 = self._step2(r1)
        r3 = self._step3(r1)
        r4 = self._step4(r1, r3)
        return {**r1, **r2, **r3, **r4}

    def _flags(self):
        sf = self.p.season_flags[self.state]
        cm = [MONTHS[i] for i,v in enumerate(sf["cool"]) if v]
        hm = [MONTHS[i] for i,v in enumerate(sf["heat"]) if v]
        pc = self.system in COOL_SYS; ph = self.system in HEAT_SYS
        print(f"\n{bold('── 前置标志位')}{dim('（根据参数自动生成，供各 Step 使用）')}")
        print(f"  {self.state} 制冷月 (CoolFlag=1) : {', '.join(cm) or '无'}")
        print(f"  {self.state} 制热月 (HeatFlag=1) : {', '.join(hm) or '无'}")
        print(f"  系统参与冷季 : {green('是 ✓') if pc else dim('否')}  [{self.system}]")
        print(f"  系统参与暖季 : {green('是 ✓') if ph else dim('否')}  [{self.system}]")
        print(f"  白天时段  DaytimeFlag=1  : H07–H16 (07:00–17:00)")
        print(f"  制冷尖峰  CoolPeakFlag=1 : H14–H18 (14:00–19:00)")
        print(f"  制热尖峰  HeatPeakFlag=1 : H06–H08 & H18–H21")

    # ─────────────────────────────────────────────────────────────────────────
    def _step1(self) -> dict:
        if self.verbose:
            step_header("STEP 1  确定最终年用电量",
                        "在各州基础年电量上，叠加暖通空调和 EV 的额外用电")

        base   = self.p.base_annual[self.state]
        t_base = self.p.hvac_load[self.system]
        u      = self.p.usage_coeff[self.usage_level]
        u_mult = u["annual_mult"]
        ev_eff = self.p.ev_efficiency
        t_ext  = t_base * u_mult
        ev_ext = self.mileage * ev_eff
        final  = base + t_ext + ev_ext
        pc = self.system in COOL_SYS; ph = self.system in HEAT_SYS

        if self.verbose:
            sub("热力额外电量 Thermal_Extra")
            print(f"  公式 : Thermal_Extra = BaseThermalLoad[system] × UsageMult[level]")
            formula(f"= {t_base:,.0f} kWh  ×  {u_mult:.3f}",
                    f"{t_base:,.0f}  ×  {u_mult:.3f}",
                    f"{t_ext:,.2f} kWh")

            sub("EV 额外电量 EV_Extra")
            print(f"  公式 : EV_Extra = 年里程 (km) × 能效 (kWh/km)")
            formula(f"= {self.mileage:,} km  ×  {ev_eff} kWh/km",
                    f"{self.mileage:,}  ×  {ev_eff}",
                    f"{ev_ext:,.2f} kWh")

            sub("最终年用电量 Final_Annual")
            print(f"  公式 : Final_Annual = Base_Annual + Thermal_Extra + EV_Extra")
            formula(f"= {base:,.0f} + {t_ext:,.0f} + {ev_ext:,.0f}",
                    f"{base:,.0f}  +  {t_ext:,.0f}  +  {ev_ext:,.0f}",
                    f"{final:,.2f} kWh")

            print(f"\n  ── 汇总 {'─'*50}")
            print(f"  Base_Annual       ({self.state})           : {base:>10,.2f} kWh")
            print(f"  BaseThermalLoad   [{self.system[:22]}]  : {t_base:>10,.2f} kWh")
            print(f"  UsageMult         [{self.usage_level}]           : {u_mult:>10.3f}")
            print(f"  Thermal_Extra                          : {t_ext:>10,.2f} kWh")
            print(f"  EV_Extra          ({self.mileage:,} km × {ev_eff})  : {ev_ext:>10,.2f} kWh")
            print(f"  {'─'*56}")
            print(f"  {bold('Final_Annual')}                          : {bold(f'{final:>10,.2f}')} kWh")

        return dict(base_annual=base, thermal_base=t_base, usage_mult=u_mult,
                    thermal_extra=t_ext, ev_extra=ev_ext, final_annual=final,
                    participates_cool=pc, participates_heat=ph)

    # ─────────────────────────────────────────────────────────────────────────
    def _step2(self, r1) -> dict:
        if self.verbose:
            step_header("STEP 2  月度分布（12个月）",
                        "把全年用电量按月分摊，体现冷暖季高峰，同时叠加热力/EV 额外用电")

        base=r1["base_annual"]; t_ext=r1["thermal_extra"]
        ev_ext=r1["ev_extra"]; final=r1["final_annual"]
        pc=r1["participates_cool"]; ph=r1["participates_heat"]

        sf=self.p.season_flags[self.state]; cf=sf["cool"]; hf=sf["heat"]
        bms=self.p.monthly_share[self.state]
        u=self.p.usage_coeff[self.usage_level]
        cmm=u["cool_month_mult"]; hmm=u["heat_month_mult"]

        # 2.1 SeasonalMult
        if self.verbose:
            sub("Step 2.1  季节乘数 SeasonalMult[m]")
            print(f"  目的 : 冷/暖季月份用电量放大，保留季节性高峰形状")
            print(f"  公式 :")
            print(f"    SeasonalMult[m] = 1")
            print(f"        + IF(系统参与冷季 AND CoolFlag[m]=1,  CoolMonthMult−1,  0)")
            print(f"        + IF(系统参与暖季 AND HeatFlag[m]=1,  HeatMonthMult−1,  0)")
            print(f"  参数 : CoolMonthMult={cmm:.2f}  HeatMonthMult={hmm:.2f}")
            print(f"         参与冷季={green('是') if pc else '否'}  参与暖季={green('是') if ph else '否'}")
            print()

        s_mult = []
        for i in range(12):
            ca = (cmm-1) if (pc and cf[i]) else 0.0
            ha = (hmm-1) if (ph and hf[i]) else 0.0
            m = 1.0 + ca + ha; s_mult.append(m)
            if self.verbose:
                tags = []
                if cf[i] and pc: tags.append(f"制冷 +{ca:.2f}")
                if hf[i] and ph: tags.append(f"制热 +{ha:.2f}")
                tag = f"  [{' & '.join(tags)}]" if tags else "  [平季，不调整]"
                print(f"    SeasonalMult[{MONTHS[i]:<3}] = 1 + {ca:.2f} + {ha:.2f} = {bold(f'{m:.3f}')}{dim(tag)}")

        # 2.2 ReshapedBase & NormBase
        reshaped = [base * bms[i] * s_mult[i] for i in range(12)]
        sum_r    = sum(reshaped)
        norm_b   = [r / sum_r * base for r in reshaped]

        if self.verbose:
            sub("Step 2.2  重塑基准 ReshapedBase → 归一化 NormBase")
            print(f"  目的 : 保留冷暖季波动形状，同时把全年总量「归一化」回 Base_Annual")
            print(f"  公式 :")
            print(f"    ReshapedBase[m] = Base_Annual × BaseMonthlyShare[m] × SeasonalMult[m]")
            print(f"    NormBase[m]     = ReshapedBase[m] / SUM(ReshapedBase) × Base_Annual")
            print(f"\n  {bold('代入示例')}（以 Jan 为例）：")
            formula(f"ReshapedBase[Jan] = {base:,.0f} × {bms[0]:.5f} × {s_mult[0]:.3f}",
                    f"{base:,.0f}  ×  {bms[0]:.5f}  ×  {s_mult[0]:.3f}",
                    f"{reshaped[0]:,.2f} kWh")
            formula(f"NormBase[Jan] = {reshaped[0]:,.2f} / {sum_r:,.2f} × {base:,.0f}",
                    f"{reshaped[0]:,.2f}  /  {sum_r:,.2f}  ×  {base:,.0f}",
                    f"{norm_b[0]:,.2f} kWh")
            print(f"\n  ➤ SUM(ReshapedBase) = {sum_r:,.2f} kWh  {dim('← 季节修正后膨胀，下步拉回')}")
            print(f"  ➤ SUM(NormBase)     = {sum(norm_b):,.2f} kWh  {green('← ✅ 已归一化回 Base_Annual')}")

        # 2.3 ThermalWeight & ThermalAlloc
        tw = []
        for i in range(12):
            w = 0.0
            if pc and cf[i]: w += bms[i] * cmm
            if ph and hf[i]: w += bms[i] * hmm
            tw.append(w)
        sum_tw = sum(tw)
        ta = [w/sum_tw*t_ext if sum_tw > 0 else 0.0 for w in tw]

        if self.verbose:
            sub("Step 2.3  热力额外分配 ThermalAlloc[m]")
            print(f"  目的 : 把 Thermal_Extra={t_ext:,.0f} kWh 按设备类型×冷暖月权重分摊到各月")
            if self.system == "Heat pump (heating & cooling)":
                print(f"  规则 : Heat pump 既参与冷季又参与暖季")
                print(f"         IF 冷季月 : ThermalWeight[m] += BaseShare[m] × CoolMonthMult")
                print(f"         IF 暖季月 : ThermalWeight[m] += BaseShare[m] × HeatMonthMult")
            elif self.system == "Electric heating":
                print(f"  规则 : Electric heating 仅参与暖季")
                print(f"         IF 暖季月 : ThermalWeight[m] = BaseShare[m] × HeatMonthMult")
            else:
                print(f"  规则 : {self.system}  Thermal_Extra=0，无需分配")
            print(f"  公式 : ThermalAlloc[m] = ThermalWeight[m] / SUM(ThermalWeight) × Thermal_Extra")
            print(f"  ➤ SUM(ThermalWeight) = {sum_tw:.5f}")
            if sum_tw > 0:
                ex_i = next((i for i in range(12) if tw[i] > 0), 0)
                print(f"\n  {bold('代入示例')}（以 {MONTHS[ex_i]} 为例）：")
                lbl = "冷季" if (cf[ex_i] and pc) else "暖季"
                mult = cmm if (cf[ex_i] and pc) else hmm
                formula(f"ThermalWeight[{MONTHS[ex_i]}] = {bms[ex_i]:.5f} × {mult:.2f}  [{lbl}月]",
                        f"{bms[ex_i]:.5f}  ×  {mult:.2f}",
                        f"{tw[ex_i]:.5f}")
                formula(f"ThermalAlloc[{MONTHS[ex_i]}] = {tw[ex_i]:.5f} / {sum_tw:.5f} × {t_ext:,.0f}",
                        f"{tw[ex_i]:.5f}  /  {sum_tw:.5f}  ×  {t_ext:,.0f}",
                        f"{ta[ex_i]:,.2f} kWh")
            else:
                print(f"  → 全年权重为 0，所有月份 ThermalAlloc = 0")

        # 2.4 EVAlloc
        ev_m = ev_ext / 12
        ev_alloc = [ev_m] * 12

        if self.verbose:
            sub("Step 2.4  EV 额外均分 EVAlloc[m]")
            print(f"  目的 : EV 充电电量平均摊到每个月（不区分季节）")
            print(f"  公式 : EVAlloc[m] = EV_Extra / 12")
            formula(f"= {ev_ext:,.2f} / 12",
                    f"{ev_ext:,.2f}  /  12",
                    f"{ev_m:,.4f} kWh（每月相同）")

        # 2.5 FinalKWh & FinalShare
        fk = [norm_b[i]+ta[i]+ev_alloc[i] for i in range(12)]
        fs = [k/final for k in fk]

        if self.verbose:
            sub("Step 2.5  合成最终月电量 FinalKWh[m]")
            print(f"  公式 : FinalKWh[m]   = NormBase[m] + ThermalAlloc[m] + EVAlloc[m]")
            print(f"         FinalShare[m]  = FinalKWh[m] / Final_Annual")
            print(f"\n  {bold('代入示例')}（以 Jan 为例）：")
            formula(f"FinalKWh[Jan] = {norm_b[0]:,.2f} + {ta[0]:,.2f} + {ev_m:,.2f}",
                    f"{norm_b[0]:,.2f}  +  {ta[0]:,.2f}  +  {ev_m:,.2f}",
                    f"{fk[0]:,.2f} kWh")
            formula(f"FinalShare[Jan] = {fk[0]:,.2f} / {final:,.2f}",
                    f"{fk[0]:,.2f}  /  {final:,.2f}",
                    f"{fs[0]:.5f}  ({fs[0]*100:.2f}%)")

            W = 102
            print(f"\n  {'─'*W}")
            print(f"  {'月':<4} {'BaseShare':>9} {'SsnMult':>8} {'Reshaped':>10} {'NormBase':>10} {'ThrmAlloc':>10} {'EVAlloc':>8} {'FinalKWh':>10} {'FinalShare':>11}  标记")
            print(f"  {'─'*W}")
            for i in range(12):
                mk = ("❄" if (cf[i] and pc) else " ") + ("🔥" if (hf[i] and ph) else "")
                print(f"  {MONTHS[i]:<4} {bms[i]:>9.5f} {s_mult[i]:>8.3f} {reshaped[i]:>10.2f} {norm_b[i]:>10.2f} {ta[i]:>10.2f} {ev_alloc[i]:>8.2f} {fk[i]:>10.2f} {fs[i]:>11.5f}  {mk}")
            print(f"  {'─'*W}")
            print(f"  {'合计':<4} {sum(bms):>9.5f} {'─':>8} {sum_r:>10.2f} {sum(norm_b):>10.2f} {sum(ta):>10.2f} {sum(ev_alloc):>8.2f} {sum(fk):>10.2f} {sum(fs):>11.5f}")
            print(f"\n  {bold('校验：')}")
            chk("sum(NormBase) ≈ Base_Annual",  sum(norm_b), base,  tol=0.5)
            chk("sum(FinalKWh) ≈ Final_Annual", sum(fk),     final, tol=0.5)
            chk("sum(FinalShare) ≈ 1.0",        sum(fs),     1.0,   tol=0.001)

        return dict(seasonal_mult=s_mult, reshaped_base=reshaped, sum_reshaped=sum_r,
                    norm_base=norm_b, thermal_alloc_monthly=ta,
                    ev_alloc_monthly=ev_alloc, final_kwh_monthly=fk, final_share_monthly=fs)

    # ─────────────────────────────────────────────────────────────────────────
    def _step3(self, r1) -> dict:
        if self.verbose:
            step_header("STEP 3  24 小时分布",
                        "在基准曲线上叠加「居住模式修正」和「冷暖尖峰修正」，再叠加 EV 充电")

        base=r1["base_annual"]; t_ext=r1["thermal_extra"]
        ev_ext=r1["ev_extra"]; final=r1["final_annual"]
        pc=r1["participates_cool"]; ph=r1["participates_heat"]

        hb      = self.p.hourly_share[self.state]
        occ_val = self.p.occupancy.get(self.occupancy, 1.0)
        u       = self.p.usage_coeff[self.usage_level]
        cpm     = u["cool_peak_mult"]; hpm = u["heat_peak_mult"]
        ev_dist = self.p.ev_charging[self.ev_charging]

        # 3.1 OccMult
        occ = [occ_val if h in DAYTIME_H else 1.0 for h in range(24)]

        if self.verbose:
            sub("Step 3.1  居住占用模式修正 OccMult[h]")
            print(f"  目的 : 白天时段（H07–H16）根据用户是否在家，放大或压缩用电比例")
            print(f"  公式 :")
            print(f"    OccMult[h] = DaytimeFactor[occupancy]   如果 h ∈ 白天时段 (H07–H16)")
            print(f"               = 1.0                        如果 h ∈ 夜间（不调整）")
            print(f"  DaytimeFactor[{self.occupancy}] = {bold(str(occ_val))}")
            print(f"  → 白天 H07–H16: OccMult = {bold(str(occ_val))}")
            print(f"  → 其余小时    : OccMult = 1.0")

        # 3.2 PeakMult
        cool_pk = [cpm if (pc and h in COOL_PEAK_H) else 1.0 for h in range(24)]
        heat_pk = [hpm if (ph and h in HEAT_PEAK_H) else 1.0 for h in range(24)]
        peak    = [cool_pk[h] * heat_pk[h] for h in range(24)]

        if self.verbose:
            sub("Step 3.2  峰时段修正 PeakMult[h]")
            print(f"  目的 : 制冷/制热设备在特定时段集中用电，放大对应小时的负荷比例")
            print(f"  公式 :")
            print(f"    CoolPeak[h] = CoolPeakMult  如果 系统参与冷季 AND h ∈ H14–H18 (制冷尖峰)")
            print(f"                = 1.0           否则")
            print(f"    HeatPeak[h] = HeatPeakMult  如果 系统参与暖季 AND h ∈ H06–H08, H18–H21 (制热尖峰)")
            print(f"                = 1.0           否则")
            print(f"    PeakMult[h] = CoolPeak[h] × HeatPeak[h]")
            print(f"  参数 : CoolPeakMult={cpm:.2f}  HeatPeakMult={hpm:.2f}")
            print()
            for h in [0, 6, 7, 14, 18, 22]:
                tags = []
                if h in COOL_PEAK_H and pc: tags.append(f"制冷尖峰×{cpm:.2f}")
                if h in HEAT_PEAK_H and ph: tags.append(f"制热尖峰×{hpm:.2f}")
                if h in DAYTIME_H:          tags.append(f"白天 OccMult×{occ_val:.1f}")
                note = f"  [{' + '.join(tags)}]" if tags else "  [普通小时，不修正]"
                print(f"    H{h:02d}: CoolPeak={cool_pk[h]:.2f} × HeatPeak={heat_pk[h]:.2f}"
                      f" = {bold(f'PeakMult={peak[h]:.4f}')}{dim(note)}")

        # 3.3 AdjShare → NormShare
        adj  = [hb[h] * occ[h] * peak[h] for h in range(24)]
        sadj = sum(adj)
        norm = [a / sadj for a in adj]

        if self.verbose:
            sub("Step 3.3  调整 & 归一化 AdjShare → NormShare")
            print(f"  公式 :")
            print(f"    AdjShare[h]  = BaseHourlyShare[h] × OccMult[h] × PeakMult[h]")
            print(f"    NormShare[h] = AdjShare[h] / SUM(AdjShare)   ← 强制 24h 合计 = 1.0")
            print(f"\n  {bold('代入示例')}（以 H07 为例，白天 + {self.occupancy}）：")
            formula(f"AdjShare[H07] = {hb[7]:.5f} × {occ[7]:.3f} × {peak[7]:.4f}",
                    f"{hb[7]:.5f}  ×  {occ[7]:.3f}  ×  {peak[7]:.4f}",
                    f"{adj[7]:.5f}")
            formula(f"NormShare[H07] = {adj[7]:.5f} / {sadj:.5f}",
                    f"{adj[7]:.5f}  /  {sadj:.5f}",
                    f"{norm[7]:.5f}")

        # 3.4 NonEV / EV / FinalHourlyShare
        d_non_ev = (base + t_ext) / 365
        d_ev     = ev_ext / 365
        non_ev   = [d_non_ev * norm[h] for h in range(24)]
        ev_h     = [d_ev * ev_dist[h]  for h in range(24)]
        fkd      = [non_ev[h] + ev_h[h] for h in range(24)]
        total_d  = final / 365
        fhs      = [f / total_d for f in fkd]

        if self.verbose:
            sub("Step 3.4  叠加 EV 充电 & 合成 FinalHourlyShare")
            print(f"  目的 : EV 充电按充电模式分布到各小时，与非 EV 用电合并")
            print(f"  公式 :")
            print(f"    NonEV_kWh[h]      = (Base_Annual + Thermal_Extra) / 365 × NormShare[h]")
            print(f"    EV_kWh[h]         = (EV_Extra / 365) × EVChargingDist[h][{self.ev_charging}]")
            print(f"    FinalKWhPerDay[h]  = NonEV_kWh[h] + EV_kWh[h]")
            print(f"    FinalHourlyShare[h]= FinalKWhPerDay[h] / (Final_Annual / 365)")
            print(f"\n  日均非EV电量 = ({base:,.0f} + {t_ext:,.0f}) / 365 = {d_non_ev:.4f} kWh")
            print(f"  日均EV电量   = {ev_ext:,.0f} / 365 = {d_ev:.4f} kWh")
            print(f"\n  {bold('代入示例')}（以 H00 为例，mostly_overnight 充电）：")
            formula(f"NonEV_kWh[H00] = {d_non_ev:.4f} × {norm[0]:.5f}",
                    f"{d_non_ev:.4f}  ×  {norm[0]:.5f}",
                    f"{non_ev[0]:.4f} kWh")
            formula(f"EV_kWh[H00] = {d_ev:.4f} × {ev_dist[0]:.3f}  [EVChargingDist H00]",
                    f"{d_ev:.4f}  ×  {ev_dist[0]:.3f}",
                    f"{ev_h[0]:.4f} kWh")
            formula(f"FinalHourlyShare[H00] = {fkd[0]:.4f} / {total_d:.4f}",
                    f"{fkd[0]:.4f}  /  {total_d:.4f}",
                    f"{fhs[0]:.5f}")

            # 完整 24h 表格
            W = 108
            print(f"\n  {'─'*W}")
            print(f"  {'小时':<5} {'BaseShr':>8} {'OccMlt':>7} {'CoolPk':>7} {'HeatPk':>7} {'PeakMlt':>8} {'AdjShr':>8} {'NormShr':>8} {'NonEV':>7} {'EV':>7} {'FinalShr':>9}  说明")
            print(f"  {'─'*W}")
            for h in range(24):
                tags = []
                if h in DAYTIME_H:            tags.append("白天")
                if h in COOL_PEAK_H and pc:   tags.append("冷峰")
                if h in HEAT_PEAK_H and ph:   tags.append("暖峰")
                if ev_dist[h] > 0:            tags.append(f"EV{ev_dist[h]:.3f}")
                note = "+".join(tags)
                print(f"  H{h:02d}  {hb[h]:>8.5f} {occ[h]:>7.3f} {cool_pk[h]:>7.2f} {heat_pk[h]:>7.2f}"
                      f" {peak[h]:>8.4f} {adj[h]:>8.5f} {norm[h]:>8.5f}"
                      f" {non_ev[h]:>7.3f} {ev_h[h]:>7.3f} {fhs[h]:>9.5f}  {note}")
            print(f"  {'─'*W}")
            print(f"  {'合计':<5} {sum(hb):>8.5f} {'─':>7} {'─':>7} {'─':>7} {'─':>8}"
                  f" {sum(adj):>8.5f} {sum(norm):>8.5f}"
                  f" {sum(non_ev):>7.3f} {sum(ev_h):>7.3f} {sum(fhs):>9.5f}")
            print(f"\n  {bold('校验：')}")
            chk("sum(NormShare) ≈ 1.0",        sum(norm), 1.0, tol=0.001)
            chk("sum(FinalHourlyShare) ≈ 1.0", sum(fhs),  1.0, tol=0.001)

        return dict(occ_mult=occ, peak_mult=peak, adj_share=adj, norm_share=norm,
                    non_ev_kwh=non_ev, ev_kwh_hourly=ev_h,
                    final_kwh_day=fkd, final_hourly_share=fhs)

    # ─────────────────────────────────────────────────────────────────────────
    def _step4(self, r1, r3) -> dict:
        if self.verbose:
            step_header("STEP 4  派生三大用电需求（最终输出给方案 A/B/C）",
                        "把 24h 分布折叠成三个时段指标，直接替换旧版固定值输入电池推荐公式")

        final = r1["final_annual"]
        fhs   = r3["final_hourly_share"]
        d_avg = final / 365

        DT_H = list(range(7, 17))           # H07-H16
        EP_H = list(range(17, 21))          # H17-H20
        ON_H = list(range(17, 24)) + list(range(0, 7))  # H17-H23 + H00-H06

        dt_s = sum(fhs[h] for h in DT_H)
        ep_s = sum(fhs[h] for h in EP_H)
        on_s = sum(fhs[h] for h in ON_H)
        dt_k = d_avg * dt_s
        ep_k = d_avg * ep_s
        on_k = d_avg * on_s

        if self.verbose:
            sub("日均用电")
            print(f"  公式 : 日均用电 = Final_Annual / 365")
            formula(f"= {final:,.2f} / 365",
                    f"{final:,.2f}  /  365",
                    f"{d_avg:.4f} kWh/天")

            sub("白天用电（H07–H16）")
            print(f"  公式 : 白天用电 = 日均 × Σ FinalHourlyShare[h=7..16]")
            print(f"  Σ FinalHourlyShare[H07–H16] = {' + '.join(f'{fhs[h]:.4f}' for h in DT_H[:4])} + ...")
            print(f"                              = {dt_s:.5f}")
            formula(f"= {d_avg:.4f} × {dt_s:.5f}",
                    f"{d_avg:.4f}  ×  {dt_s:.5f}",
                    f"{dt_k:.4f} kWh/天  ({dt_s*100:.2f}%)")

            sub("晚高峰用电（H17–H20）")
            print(f"  公式 : 晚高峰用电 = 日均 × Σ FinalHourlyShare[h=17..20]")
            print(f"  Σ FinalHourlyShare[H17–H20] = {' + '.join(f'{fhs[h]:.4f}' for h in EP_H)} = {ep_s:.5f}")
            formula(f"= {d_avg:.4f} × {ep_s:.5f}",
                    f"{d_avg:.4f}  ×  {ep_s:.5f}",
                    f"{ep_k:.4f} kWh/天  ({ep_s*100:.2f}%)")

            sub("整夜用电（H17–H06）")
            print(f"  公式 : 整夜用电 = 日均 × Σ FinalHourlyShare[h=17..23, h=0..6]")
            print(f"  Σ FinalHourlyShare[H17–H06] = {on_s:.5f}")
            formula(f"= {d_avg:.4f} × {on_s:.5f}",
                    f"{d_avg:.4f}  ×  {on_s:.5f}",
                    f"{on_k:.4f} kWh/天  ({on_s*100:.2f}%)")

            OLD = dict(dt=0.4388, ep=0.2210, on=0.5960)
            print(f"\n  ── 最终输出（输入方案 A/B/C 电池推荐公式）{'─'*28}")
            print(f"  {'指标':<20} {'本次计算值':>12}  {'占比':>8}  {'旧版固定值':>10}  {'变化':>8}")
            print(f"  {'─'*70}")
            print(f"  {'日均用电':<20} {d_avg:>12.4f}  {'100.00%':>8}  {'—':>10}  {'—':>8}")

            def diff_fmt(new, old):
                d = (new - old) * 100
                s = f"{d:+.2f}pp"
                return green(s) if abs(d) > 0.1 else dim(s)

            print(f"  {'白天用电  H07–H16':<20} {dt_k:>12.4f}  {dt_s*100:>7.2f}%"
                  f"  {OLD['dt']*100:>9.2f}%  {diff_fmt(dt_s, OLD['dt']):>15}")
            print(f"  {'晚高峰用电 H17–H20':<20} {ep_k:>12.4f}  {ep_s*100:>7.2f}%"
                  f"  {OLD['ep']*100:>9.2f}%  {diff_fmt(ep_s, OLD['ep']):>15}")
            print(f"  {'整夜用电  H17–H06':<20} {on_k:>12.4f}  {on_s*100:>7.2f}%"
                  f"  {OLD['on']*100:>9.2f}%  {diff_fmt(on_s, OLD['on']):>15}")
            print(f"  {'─'*70}")
            print(f"  {dim('差异来源说明：')}")
            if self.occupancy != "No modification (default/skip)":
                print(f"    白天 OccMult={self.p.occupancy.get(self.occupancy,1.0):.1f} [{self.occupancy}]")
            if self.system in COOL_SYS or self.system in HEAT_SYS:
                print(f"    冷暖峰修正 [{self.system}]  CoolPeakMult={self.p.usage_coeff[self.usage_level]['cool_peak_mult']:.2f}  HeatPeakMult={self.p.usage_coeff[self.usage_level]['heat_peak_mult']:.2f}")
            if r1["ev_extra"] > 0:
                print(f"    EV充电分布 [{self.ev_charging}] 叠加到对应小时")

        return dict(daily_avg=d_avg,
                    daytime_kwh=dt_k, daytime_pct=dt_s*100,
                    evening_peak_kwh=ep_k, evening_peak_pct=ep_s*100,
                    overnight_kwh=on_k, overnight_pct=on_s*100)


# ── 内置场景 ──────────────────────────────────────────────────────────────────
PRD_CASE = dict(
    state="NSW", system="Heat pump (heating & cooling)", usage_level="Medium",
    mileage=10000, occupancy="Mostly away during the day", ev_charging="mostly_overnight"
)

BATCH_CASES = [
    dict(name="T-01 PRD基准",      state="NSW", system="Heat pump (heating & cooling)", usage_level="Medium",    mileage=10000, occupancy="Mostly away during the day",    ev_charging="mostly_overnight"),
    dict(name="T-02 全跳过/旧版",   state="NSW", system="No heating or cooling system",  usage_level="Medium",    mileage=0,     occupancy="No modification (default/skip)", ev_charging="mostly_overnight"),
    dict(name="T-03 QLD纯制冷高度", state="QLD", system="Air conditioning",              usage_level="High",      mileage=0,     occupancy="Someone always at home",         ev_charging="mostly_overnight"),
    dict(name="T-04 TAS制热极重",   state="TAS", system="Electric heating",              usage_level="Very high", mileage=0,     occupancy="Working from home",              ev_charging="mostly_overnight"),
    dict(name="T-05 大EV+居家办公", state="NSW", system="Heat pump (heating & cooling)", usage_level="Medium",    mileage=25000, occupancy="Working from home",              ev_charging="solar_optimized"),
    dict(name="T-06 VIC低强度混充", state="VIC", system="Heat pump (heating & cooling)", usage_level="Low",       mileage=10000, occupancy="Mostly away during the day",    ev_charging="mixed_day_and_night"),
]


def run_validate(params):
    calc = LoadProfileCalculator(params, verbose=True, **PRD_CASE)
    r = calc.run()
    print(f"\n{'═'*72}")
    print(bold("  PRD 期望值校验"))
    print(f"{'═'*72}")
    passed = []
    passed.append(chk("Final_Annual",        r["final_annual"],  11378.0, tol=1.0))
    passed.append(chk("Thermal_Extra",        r["thermal_extra"], 1800.0,  tol=0.1))
    passed.append(chk("EV_Extra",             r["ev_extra"],      1800.0,  tol=0.1))
    passed.append(chk("sum(ReshapedBase)",    r["sum_reshaped"],  8383.67, tol=5.0))
    passed.append(chk("EVAlloc[每月]",        r["ev_alloc_monthly"][0], 150.0, tol=0.1))
    n = sum(passed); total = len(passed)
    if n == total:
        print(f"\n  {green(bold(f'✅ 全部通过 {n}/{total} — LoadProfile 计算逻辑与 PRD 完全一致'))}")
    else:
        print(f"\n  {red(bold(f'❌ {total-n}/{total} 项不一致，请检查上方标红项'))}")


def run_batch(params):
    rows = []
    for case in BATCH_CASES:
        kw = {k: v for k, v in case.items() if k != "name"}
        r  = LoadProfileCalculator(params, verbose=False, **kw).run()
        rows.append((case["name"], r))

    W = 98
    print(f"\n{'═'*W}")
    print(bold("  批量测算结果汇总"))
    print(f"{'═'*W}")
    print(f"  {'场景':<22} {'年总电量':>10} {'白天kWh':>9} {'白天%':>7} {'晚高峰kWh':>10} {'晚高峰%':>8} {'整夜kWh':>9} {'整夜%':>7}")
    print(f"  {'─'*W}")
    for name, r in rows:
        print(f"  {name:<22} {r['final_annual']:>10,.1f} {r['daytime_kwh']:>9.3f} {r['daytime_pct']:>7.2f}% {r['evening_peak_kwh']:>10.3f} {r['evening_peak_pct']:>7.2f}% {r['overnight_kwh']:>9.3f} {r['overnight_pct']:>6.2f}%")
    print(f"  {'─'*W}")
    print(f"  {'旧版固定值（对照）':<22} {'—':>10} {'—':>9} {'43.88%':>7} {'—':>10} {'22.10%':>8} {'—':>9} {'59.60%':>7}")
    print(f"{'═'*W}")


# ── CLI 入口 ──────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description="LoadProfile 计算验证脚本 — SalesAgent V1.12",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python validate_loadprofile.py --validate
  python validate_loadprofile.py --batch
  python validate_loadprofile.py --state NSW --system "Heat pump" --usage Medium --mileage 10000 --occupancy "Mostly away" --ev-charging mostly_overnight
  python validate_loadprofile.py --config my_cases.json
  python validate_loadprofile.py --skip-all --state NSW
        """
    )
    ap.add_argument("--validate",    action="store_true",        help="运行 PRD 标准示例并校验期望值")
    ap.add_argument("--batch",       action="store_true",        help="运行全部 6 个内置批量场景（汇总表）")
    ap.add_argument("--skip-all",    action="store_true",        help="模拟全部题目跳过（旧版行为）")
    ap.add_argument("--config",      type=str,                   help="JSON 配置文件路径")
    ap.add_argument("--state",       type=str, default="NSW",    help="州代码 TAS/NT/ACT/SA/NSW/QLD/WA/VIC")
    ap.add_argument("--system",      type=str, default="No heating or cooling system")
    ap.add_argument("--usage",       type=str, default="Medium", dest="usage_level")
    ap.add_argument("--mileage",     type=int, default=0)
    ap.add_argument("--occupancy",   type=str, default="No modification (default/skip)")
    ap.add_argument("--ev-charging", type=str, default="mostly_overnight", dest="ev_charging")
    ap.add_argument("--params-dir",  type=str, default="参数",   dest="params_dir")
    args = ap.parse_args()

    params = Params(args.params_dir)

    if args.validate:
        run_validate(params)
    elif args.batch:
        run_batch(params)
    elif args.config:
        with open(args.config) as f:
            cases = json.load(f)
        if isinstance(cases, dict):
            cases = [cases]
        for case in cases:
            kw = {k: v for k, v in case.items() if k != "name"}
            LoadProfileCalculator(params, verbose=True, **kw).run()
    elif args.skip_all:
        LoadProfileCalculator(
            params, state=args.state,
            system="No heating or cooling system", usage_level="Medium",
            mileage=0, occupancy="No modification (default/skip)",
            ev_charging="mostly_overnight", verbose=True
        ).run()
    else:
        LoadProfileCalculator(
            params, state=args.state, system=args.system,
            usage_level=args.usage_level, mileage=args.mileage,
            occupancy=args.occupancy, ev_charging=args.ev_charging,
            verbose=True
        ).run()


if __name__ == "__main__":
    main()
