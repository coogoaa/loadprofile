"""
gen_test_cases.py — 生成覆盖各维度的测试输入文件

用法:
    python3 tools/gen_test_cases.py                        # 生成到 inputs/ (默认)
    python3 tools/gen_test_cases.py --output-dir inputs/   # 指定目录
    python3 tools/gen_test_cases.py --overwrite            # 覆盖已有文件
    python3 tools/gen_test_cases.py --dry-run              # 仅打印，不写入

测试矩阵设计（共 33 cases）：
    A (8)  州覆盖     — 8 州各一，其余参数固定（Heat pump / Medium / 10k km / Mostly away）
    B (4)  暖通系统   — NSW 固定，Q2 枚举 4 种有效系统
    C (4)  使用强度   — NSW + Heat pump，Q3 枚举 Low / Medium / High / Very high
    D (5)  EV 里程   — NSW + Heat pump + Medium，Q4 枚举 5k–25k km
    E (4)  EV 充电   — NSW + Heat pump + Medium + 10k km，Q5 枚举 4 种充电模式
    F (4)  居住模式   — NSW + Heat pump + Medium + No EV，Q1 枚举 4 种
    G (4)  边界/特殊  — 全跳过 / 极值 / 纯基础 / PRD 标准基准
"""

import argparse
from pathlib import Path

# ── 各州代表地址 ────────────────────────────────────────────────────────────────
STATE_ADDRESSES = {
    "ACT": "1 Civic Square, Canberra ACT 2601",
    "NSW": "1 Martin Place, Sydney NSW 2000",
    "NT":  "69 Mitchell Street, Darwin NT 0800",
    "QLD": "160 Ann Street, Brisbane QLD 4000",
    "SA":  "50 Grenfell Street, Adelaide SA 5000",
    "TAS": "1 Elizabeth Street, Hobart TAS 7000",
    "VIC": "1 Spring Street, Melbourne VIC 3000",
    "WA":  "1 Cathedral Avenue, Perth WA 6000",
}

# ── 测试矩阵定义 ────────────────────────────────────────────────────────────────
# 每个 case: (filename_stem, description, address, q1, q2, q3, q4, q5)
# q3/q5 留空代表该题不适用（由脚本逻辑决定是否写入）

CASES = [

    # ─── A: 州覆盖 ─── 其余固定: Heat pump / Medium / 10k km / Mostly away
    ("A01_ACT_heatpump",   "A01 州覆盖 ACT",   "ACT",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("A02_NSW_heatpump",   "A02 州覆盖 NSW",   "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("A03_NT_heatpump",    "A03 州覆盖 NT",    "NT",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("A04_QLD_heatpump",   "A04 州覆盖 QLD",   "QLD",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("A05_SA_heatpump",    "A05 州覆盖 SA",    "SA",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("A06_TAS_heatpump",   "A06 州覆盖 TAS",   "TAS",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("A07_VIC_heatpump",   "A07 州覆盖 VIC",   "VIC",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("A08_WA_heatpump",    "A08 州覆盖 WA",    "WA",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    # ─── B: 暖通系统覆盖 ─── 固定: NSW / Medium / No EV / Mostly away
    ("B01_NSW_no_system",      "B01 系统=无",          "NSW",
     "Mostly away during the day", "No heating or cooling system", "",
     "No electric vehicle", ""),

    ("B02_NSW_aircon",          "B02 系统=空调(制冷)",   "NSW",
     "Mostly away during the day", "Air conditioning", "Medium",
     "No electric vehicle", ""),

    ("B03_NSW_electric_heating","B03 系统=电热(制热)",   "NSW",
     "Mostly away during the day", "Electric heating", "High",
     "No electric vehicle", ""),

    ("B04_NSW_heat_pump",       "B04 系统=热泵(冷暖)",   "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "No electric vehicle", ""),

    # ─── C: 使用强度覆盖 ─── 固定: NSW / Heat pump / No EV / Mostly away
    ("C01_NSW_usage_low",       "C01 强度=Low",      "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Low",
     "No electric vehicle", ""),

    ("C02_NSW_usage_medium",    "C02 强度=Medium",   "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "No electric vehicle", ""),

    ("C03_NSW_usage_high",      "C03 强度=High",     "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "High",
     "No electric vehicle", ""),

    ("C04_NSW_usage_veryhigh",  "C04 强度=Very high","NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Very high",
     "No electric vehicle", ""),

    # ─── D: EV 里程覆盖 ─── 固定: NSW / Heat pump / Medium / Mostly away / Mostly overnight
    ("D01_NSW_ev_5k",    "D01 EV=5,000 km",   "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "5,000 km", "Mostly overnight"),

    ("D02_NSW_ev_10k",   "D02 EV=10,000 km",  "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("D03_NSW_ev_15k",   "D03 EV=15,000 km",  "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "15,000 km", "Mostly overnight"),

    ("D04_NSW_ev_20k",   "D04 EV=20,000 km",  "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "20,000 km", "Mostly overnight"),

    ("D05_NSW_ev_25k",   "D05 EV=25,000+ km", "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "25,000+ km", "Mostly overnight"),

    # ─── E: EV 充电模式覆盖 ─── 固定: NSW / Heat pump / Medium / 10k km / Mostly away
    ("E01_NSW_charge_overnight", "E01 充电=夜间",     "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),

    ("E02_NSW_charge_mixed",     "E02 充电=日夜混合", "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mixed day and night"),

    ("E03_NSW_charge_daytime",   "E03 充电=白天",     "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly daytime"),

    ("E04_NSW_charge_solar",     "E04 充电=光伏优化", "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Solar-optimized charging"),

    # ─── F: 居住模式覆盖 ─── 固定: NSW / Heat pump / Medium / No EV
    ("F01_NSW_occ_away",    "F01 居住=外出为主",  "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "No electric vehicle", ""),

    ("F02_NSW_occ_wfh",     "F02 居住=居家办公",  "NSW",
     "Working from home", "Heat pump (heating & cooling)", "Medium",
     "No electric vehicle", ""),

    ("F03_NSW_occ_always",  "F03 居住=始终在家",  "NSW",
     "Someone always at home", "Heat pump (heating & cooling)", "Medium",
     "No electric vehicle", ""),

    ("F04_NSW_occ_skip",    "F04 居住=跳过",      "NSW",
     "skip", "Heat pump (heating & cooling)", "Medium",
     "No electric vehicle", ""),

    # ─── G: 边界 / 特殊场景 ───
    ("G01_all_skip",   "G01 全跳过（纯基础默认值）", "NSW",
     "skip", "skip", "skip",
     "skip", "skip"),

    ("G02_max_all",    "G02 极值（TAS + 电热 VeryHigh + 25k EV 光伏）", "TAS",
     "Working from home", "Electric heating", "Very high",
     "25,000+ km", "Solar-optimized charging"),

    ("G03_base_no_ev_no_hvac", "G03 纯基础（无HVAC+无EV+始终在家）", "VIC",
     "Someone always at home", "No heating or cooling system", "",
     "No electric vehicle", ""),

    ("G04_prd_baseline", "G04 PRD标准基准（对照 --validate）", "NSW",
     "Mostly away during the day", "Heat pump (heating & cooling)", "Medium",
     "10,000 km", "Mostly overnight"),
]

# ── 文件写入 ────────────────────────────────────────────────────────────────────
NO_HVAC_SYSTEMS = {"No heating or cooling system", "skip", ""}
NO_EV_VALUES    = {"No electric vehicle", "skip", "0", ""}

def render_case(stem, desc, state, q1, q2, q3, q4, q5) -> str:
    """把一个 case tuple 渲染为 .txt 文件内容字符串。"""
    has_hvac = q2 not in NO_HVAC_SYSTEMS
    has_ev   = q4 not in NO_EV_VALUES

    lines = [
        f"# {desc}",
        f"address: {STATE_ADDRESSES[state]}",
        f"q1: {q1}",
        f"q2: {q2}",
    ]

    if has_hvac:
        lines.append(f"q3: {q3 if q3 else 'Medium'}")
    else:
        lines.append("# q3: (不适用 — Q2 无暖通系统)")

    lines.append(f"q4: {q4}")

    if has_ev:
        lines.append(f"q5: {q5 if q5 else 'Mostly overnight'}")
    else:
        lines.append("# q5: (不适用 — Q4 无 EV)")

    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description="生成 LoadProfile 测试输入文件")
    ap.add_argument("--output-dir", default="inputs", help="输出目录（默认: inputs/）")
    ap.add_argument("--overwrite",  action="store_true", help="覆盖已存在的文件")
    ap.add_argument("--dry-run",    action="store_true", help="仅打印，不写入文件")
    args = ap.parse_args()

    out = Path(args.output_dir)
    if not args.dry_run:
        out.mkdir(parents=True, exist_ok=True)

    groups = {"A": [], "B": [], "C": [], "D": [], "E": [], "F": [], "G": []}
    written = skipped = 0

    print(f"\n{'─'*72}")
    print(f"  {'文件':<38} {'状态':<10} 描述")
    print(f"{'─'*72}")

    for case in CASES:
        stem, desc, state, q1, q2, q3, q4, q5 = case
        content = render_case(*case)
        fp = out / (stem + ".txt")
        group = stem[0]

        if args.dry_run:
            tag = "DRY"
        elif fp.exists() and not args.overwrite:
            tag = "SKIP(已存在)"
            skipped += 1
        else:
            fp.write_text(content, encoding="utf-8")
            tag = "✅ 已写入"
            written += 1

        print(f"  {stem + '.txt':<38} {tag:<10} {desc}")
        groups.get(group, []).append(stem)

    print(f"{'─'*72}")

    if not args.dry_run:
        print(f"\n  写入: {written}  跳过: {skipped}  目录: {out.resolve()}")
        if skipped:
            print(f"  提示: 使用 --overwrite 覆盖已有文件")
    else:
        print(f"\n  [DRY RUN] 共 {len(CASES)} 个 case，未写入任何文件")

    print(f"\n  分组汇总:")
    descs = {"A": "州覆盖(8)", "B": "系统覆盖(4)", "C": "强度覆盖(4)",
             "D": "EV里程(5)", "E": "充电模式(4)", "F": "居住模式(4)", "G": "边界特殊(4)"}
    for g, label in descs.items():
        n = len(groups.get(g, []))
        print(f"    {g}: {label:<16}  {'*' * n}")
    print(f"  合计: {len(CASES)} cases\n")


if __name__ == "__main__":
    main()
