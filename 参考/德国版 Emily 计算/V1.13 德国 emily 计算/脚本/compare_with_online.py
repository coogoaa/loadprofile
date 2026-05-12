#!/usr/bin/env python3
"""
与线上返回结果进行比对
从测试输入.md 中提取线上结果，与我们的计算结果进行对比
"""

import json
import re
import sys
from pathlib import Path


def extract_online_results(input_file):
    """从测试输入.md 中提取线上返回的 JSON 数据"""
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取 JSON 部分（在 ```json 和 ``` 之间，或者单独的 ``` 块）
    json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
    if not json_match:
        json_match = re.search(r'```\s*({[\s\S]*?})\s*```', content)
    
    if not json_match:
        raise ValueError("无法从输入文件中提取 JSON 数据")
    
    json_str = json_match.group(1).strip()
    data = json.loads(json_str)
    
    return data['data']


def load_our_results(output_dir, case_id, mode, tier):
    """加载我们的计算结果"""
    # ROI 结果
    roi_file = Path(output_dir) / case_id / mode / tier / '04_roi.json'
    with open(roi_file, 'r', encoding='utf-8') as f:
        roi_data = json.load(f)
    
    # 系统组成结果
    sys_file = Path(output_dir) / case_id / mode / tier / '02_system_composition.json'
    with open(sys_file, 'r', encoding='utf-8') as f:
        sys_data = json.load(f)
    
    # 能量流结果
    energy_file = Path(output_dir) / case_id / mode / tier / '03_energy_flow.json'
    with open(energy_file, 'r', encoding='utf-8') as f:
        energy_data = json.load(f)
    
    return {
        'roi': roi_data,
        'system': sys_data,
        'energy': energy_data
    }


def get_design_by_tier(online_data, tier):
    """根据 tier 获取对应的设计方案"""
    tier_map = {
        'A': 'maxValue',      # designType: 0
        'B': 'mostPopular',   # designType: 1
        'C': 'customFit'      # designType: 2
    }
    
    design_name = tier_map.get(tier, 'mostPopular')
    
    for design in online_data['designs']:
        if design['designName'] == design_name:
            return design
    
    return None


def compare_results(online_data, our_results, case_id, mode, tier, output_file=None):
    """对比线上结果和我们的计算结果"""
    
    # 获取对应的设计
    design = get_design_by_tier(online_data, tier)
    if not design:
        print(f"❌ 未找到 tier {tier} 对应的设计方案")
        return
    
    lines = []
    lines.append("=" * 80)
    lines.append(f"比对报告: Case {case_id} | Mode: {mode} | Tier: {tier}")
    lines.append("=" * 80)
    
    # 系统组成对比
    lines.append("\n## 系统组成对比")
    lines.append("-" * 80)
    lines.append(f"{'指标':<20} {'线上结果':<20} {'我们的结果':<20} {'差异':<15}")
    lines.append("-" * 80)
    
    # PV 容量
    online_pv = design['systemSize']
    our_pv = our_results['system']['actual_pv']
    pv_diff = our_pv - online_pv
    lines.append(f"{'PV容量 (kW)':<20} {online_pv:<20.2f} {our_pv:<20.2f} {pv_diff:+.2f}")
    
    # 面板数量
    online_panels = json.loads(design['layout']).get('installPanelCount', 0)
    our_panels = our_results['system']['actual_panels']
    panels_diff = our_panels - online_panels
    lines.append(f"{'面板数量':<20} {online_panels:<20} {our_panels:<20} {panels_diff:+d}")
    
    # 逆变器
    online_inv = design.get('systemSize', 0) * 0.9  # 估算
    our_inv = our_results['system']['inverter']['inv_kw']
    inv_diff = our_inv - online_inv
    lines.append(f"{'逆变器 (kW)':<20} {online_inv:<20.2f} {our_inv:<20.2f} {inv_diff:+.2f}")
    
    # 电池
    online_bat = design.get('batteryCapacity', 0)
    our_bat = our_results['system']['rh']['bat_kWh']
    bat_diff = our_bat - online_bat
    lines.append(f"{'电池 (kWh)':<20} {online_bat:<20} {our_bat:<20} {bat_diff:+.2f}")
    
    # 投资额
    online_cost = design.get('upfrontInvestment', 0)
    our_cost = our_results['roi']['total_cost']
    cost_diff = our_cost - online_cost
    lines.append(f"{'投资额 (€)':<20} {online_cost:<20.2f} {our_cost:<20.2f} {cost_diff:+.2f}")
    
    # ROI 指标对比
    lines.append("\n## ROI 指标对比")
    lines.append("-" * 80)
    lines.append(f"{'指标':<20} {'线上结果':<20} {'我们的结果':<20} {'差异':<15}")
    lines.append("-" * 80)
    
    # IRR
    online_irr = design.get('irr', 0) * 100
    our_irr = our_results['roi']['IRR'] * 100
    irr_diff = our_irr - online_irr
    lines.append(f"{'IRR (%)':<20} {online_irr:<20.2f} {our_irr:<20.2f} {irr_diff:+.2f}")
    
    # Payback
    online_payback = design.get('paybackPeriod', 0)
    our_payback = our_results['roi']['payback_years']
    payback_diff = our_payback - online_payback
    lines.append(f"{'回本期 (年)':<20} {online_payback:<20.2f} {our_payback:<20.2f} {payback_diff:+.2f}")
    
    # NPV
    online_npv = 0  # 线上没有 NPV
    our_npv = our_results['roi']['NPV']
    lines.append(f"{'NPV (€)':<20} {online_npv:<20.2f} {our_npv:<20.2f} {'N/A':<15}")
    
    # 能量流对比
    lines.append("\n## 能量流对比")
    lines.append("-" * 80)
    lines.append(f"{'指标':<20} {'我们的结果':<20} {'备注':<30}")
    lines.append("-" * 80)
    
    online_scr = design.get('selfConsumption', 0) * 100
    our_scr = our_results['energy']['totals']['SCR'] * 100
    scr_diff = our_scr - online_scr
    lines.append(f"{'自用率 (%)':<20} {our_scr:<20.2f} 线上: {online_scr:.2f}% (差异: {scr_diff:+.2f}%)")
    
    our_gen = our_results['energy']['totals']['gen_total']
    lines.append(f"{'年发电量 (kWh)':<20} {our_gen:<20} 线上无此数据")
    
    our_load = our_results['energy']['totals']['load_total']
    lines.append(f"{'年用电量 (kWh)':<20} {our_load:<20} 线上无此数据")
    
    our_import = our_results['energy']['totals']['import_grid']
    lines.append(f"{'年购电 (kWh)':<20} {our_import:<20} 线上无此数据")
    
    our_export = our_results['energy']['totals']['export']
    lines.append(f"{'年售电 (kWh)':<20} {our_export:<20} 线上无此数据")
    
    # 现金流对比
    lines.append("\n## 现金流对比（前5年）")
    lines.append("-" * 80)
    lines.append(f"{'年份':<10} {'线上年节省':<20} {'我们的年节省':<20} {'差异':<15}")
    lines.append("-" * 80)
    
    online_annual = design.get('annualBillSavings', 0)
    our_cashflow = our_results['roi']['cashflow']
    
    for i in range(min(5, len(our_cashflow) - 1)):
        year = i + 1
        our_annual = our_cashflow[year]
        diff = our_annual - online_annual
        lines.append(f"{'第' + str(year) + '年':<10} {online_annual:<20.2f} {our_annual:<20.2f} {diff:+.2f}")
    
    lines.append("\n" + "=" * 80)
    lines.append("⚠️  注意事项")
    lines.append("=" * 80)
    lines.append("1. 线上 selfConsumption 可能计算方式不同（可能只计算新增系统的自用率）")
    lines.append("2. 线上 paybackPeriod 数值异常（0.33年），可能计算逻辑有问题")
    lines.append("3. 线上 annualBillSavings 数值异常（€50,553），可能包含其他补贴")
    lines.append("=" * 80)
    
    # 输出到控制台
    report = "\n".join(lines)
    print(report)
    
    # 写入文件
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report, encoding='utf-8')
        print(f"\n✓ 比对报告已保存到: {output_file}")


def main():
    if len(sys.argv) < 5:
        print("用法: python3 compare_with_online.py <输入文件> <输出目录> <case_id> <mode> <tier> [输出文件]")
        print("示例: python3 compare_with_online.py '../输入/测试输入.md' '../输出' 11199 R B")
        print("示例（带输出文件）: python3 compare_with_online.py '../输入/测试输入.md' '../输出' 11199 R B '../输出/11199/R/B/05_comparison.md'")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_dir = sys.argv[2]
    case_id = sys.argv[3]
    mode = sys.argv[4]
    tier = sys.argv[5]
    output_file = sys.argv[6] if len(sys.argv) >= 6 else None
    
    try:
        # 提取线上结果
        online_data = extract_online_results(input_file)
        print(f"✓ 已加载线上结果: {online_data['id']}")
        
        # 加载我们的结果
        our_results = load_our_results(output_dir, case_id, mode, tier)
        print(f"✓ 已加载我们的计算结果: {case_id}/{mode}/{tier}")
        
        # 进行对比
        compare_results(online_data, our_results, case_id, mode, tier, output_file)
        
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
