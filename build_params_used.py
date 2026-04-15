#!/usr/bin/env python3
"""
build_params_used.py
从 参数/ 生成 参数_used/：
  - 只保留 AU+GLOBAL 相关文件（去除 DE）
  - 去除 note/source/DE 字段，只留参与计算的列
  - 新增 5 道题目选项映射表（Q1–Q5）
"""
import csv
from pathlib import Path

SRC = Path("参数")
DST = Path("参数_used")
DST.mkdir(exist_ok=True)

def write_csv(path, rows, fieldnames):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow({k: row[k] for k in fieldnames})

def read_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

def transform(src_name, dst_name, keep_cols):
    rows = read_csv(SRC / src_name)
    write_csv(DST / dst_name, rows, keep_cols)
    removed = [c for c in rows[0].keys() if c not in keep_cols] if rows else []
    tag = f"  (removed: {removed})" if removed else ""
    print(f"  ✓  {dst_name}{tag}")


print("── 计算参数文件 ─────────────────────────────────────────────────")

transform("AU_base_annual_kwh.csv", "AU_base_annual_kwh.csv",
          ["state","base_annual_kwh"])

transform("AU_cooling_heating_season_flags.csv", "AU_cooling_heating_season_flags.csv",
          ["state",
           "Jan_cool","Feb_cool","Mar_cool","Apr_cool","May_cool","Jun_cool",
           "Jul_cool","Aug_cool","Sep_cool","Oct_cool","Nov_cool","Dec_cool",
           "Jan_heat","Feb_heat","Mar_heat","Apr_heat","May_heat","Jun_heat",
           "Jul_heat","Aug_heat","Sep_heat","Oct_heat","Nov_heat","Dec_heat"])

transform("AU_hourly_share.csv", "AU_hourly_share.csv",
          ["state"] + [f"H{h:02d}" for h in range(24)])

transform("AU_hvac_thermal_load.csv", "AU_hvac_thermal_load.csv",
          ["system","base_thermal_load_kwh"])

transform("AU_monthly_share.csv", "AU_monthly_share.csv",
          ["state","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])

transform("AU_usage_level_coefficients.csv", "AU_usage_level_coefficients.csv",
          ["usage_level","annual_mult","cool_month_mult","heat_month_mult","cool_peak_mult","heat_peak_mult"])

transform("AU_ev_charging_profiles.csv", "AU_ev_charging_profiles.csv",
          ["hour","mostly_overnight","mixed_day_and_night","mostly_daytime","solar_optimized"])

transform("GLOBAL_occupancy_factors.csv", "GLOBAL_occupancy_factors.csv",
          ["occupancy","daytime_mult"])

# GLOBAL_ev_params — 重构为 parameter/value 两列
with open(DST / "GLOBAL_ev_params.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["parameter", "value"])
    w.writerow(["ev_efficiency_kwh_per_km", "0.18"])
    w.writerow(["mileage_option_0", "0"])
    w.writerow(["mileage_option_1", "5000"])
    w.writerow(["mileage_option_2", "10000"])
    w.writerow(["mileage_option_3", "15000"])
    w.writerow(["mileage_option_4", "20000"])
    w.writerow(["mileage_option_5", "25000"])
print("  ✓  GLOBAL_ev_params.csv  (restructured to parameter/value)")


print("\n── 题目选项映射表 ───────────────────────────────────────────────")

# Q1: 居住模式
with open(DST / "Q1_occupancy_options.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ui_label", "internal_key", "note"])
    w.writerow(["Mostly away during the day", "Mostly away during the day",   "白天大多不在家"])
    w.writerow(["Working from home",           "Working from home",           "居家办公"])
    w.writerow(["Someone always at home",      "Someone always at home",      "始终有人在家"])
    w.writerow(["skip",                        "No modification (default/skip)", "跳过→默认不调整"])
print("  ✓  Q1_occupancy_options.csv")

# Q2: 暖通系统
with open(DST / "Q2_hvac_options.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ui_label", "internal_key", "note"])
    w.writerow(["No heating or cooling system",    "No heating or cooling system",    "无系统（Thermal_Extra=0）"])
    w.writerow(["Air conditioning",                "Air conditioning",                "仅制冷（重分布，不增加年电量）"])
    w.writerow(["Electric heating",                "Electric heating",                "仅制热（+2500kWh基准）"])
    w.writerow(["Heat pump (heating & cooling)",   "Heat pump (heating & cooling)",   "冷暖两用（+1800kWh基准）"])
    w.writerow(["skip",                            "No heating or cooling system",    "跳过→默认无系统"])
print("  ✓  Q2_hvac_options.csv")

# Q3: 使用强度（仅在 Q2 != No system 时展示）
with open(DST / "Q3_usage_options.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ui_label", "internal_key", "show_condition", "note"])
    w.writerow(["Low",       "Low",       "Q2 != No system", "低强度"])
    w.writerow(["Medium",    "Medium",    "Q2 != No system", "中等强度"])
    w.writerow(["High",      "High",      "Q2 != No system", "高强度"])
    w.writerow(["Very high", "Very high", "Q2 != No system", "极高强度"])
    w.writerow(["skip",      "Medium",    "Q2 != No system", "跳过→默认Medium"])
print("  ✓  Q3_usage_options.csv  (show_condition: Q2 != No system)")

# Q4: EV 年里程
with open(DST / "Q4_ev_km_options.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ui_label", "km_value", "note"])
    w.writerow(["No electric vehicle", "0",     "无EV（EV_Extra=0）"])
    w.writerow(["5,000 km",            "5000",  ""])
    w.writerow(["10,000 km",           "10000", ""])
    w.writerow(["15,000 km",           "15000", ""])
    w.writerow(["20,000 km",           "20000", ""])
    w.writerow(["25,000+ km",          "25000", ""])
    w.writerow(["skip",                "0",     "跳过→默认无EV"])
print("  ✓  Q4_ev_km_options.csv")

# Q5: EV 充电时间（仅在 Q4 != No EV 时展示）
with open(DST / "Q5_ev_charging_options.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ui_label", "internal_key", "show_condition", "note"])
    w.writerow(["Mostly overnight",          "mostly_overnight",    "Q4 != No EV", "夜间充电（默认）"])
    w.writerow(["Mixed day and night",       "mixed_day_and_night", "Q4 != No EV", "日夜混合"])
    w.writerow(["Mostly daytime",            "mostly_daytime",      "Q4 != No EV", "白天充电"])
    w.writerow(["Solar-optimized charging",  "solar_optimized",     "Q4 != No EV", "光伏优化"])
    w.writerow(["skip",                      "mostly_overnight",    "Q4 != No EV", "跳过→默认mostly_overnight"])
print("  ✓  Q5_ev_charging_options.csv  (show_condition: Q4 != No EV)")

files = list(DST.iterdir())
print(f"\n✅  参数_used/ 生成完毕，共 {len(files)} 个文件：")
for f in sorted(files):
    print(f"    {f.name}")
