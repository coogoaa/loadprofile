"""
投资回报计算
基于系统组成计算结果，计算IRR、回本期等财务指标
"""

import json
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional, Sequence


def load_json_file(file_path: Path) -> Dict[str, Any]:
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def calculate_irr(cashflows: Sequence[float]) -> float:
    """
    计算内部收益率 (IRR)
    使用二分法求解 NPV = 0 时的折现率
    
    Args:
        cashflows: 现金流数组，第0项为初始投资（负值），后续为年度收益
    
    Returns:
        IRR值
    """
    def npv(rate: float) -> float:
        total = 0.0
        for t, cf in enumerate(cashflows):
            total += cf / ((1.0 + rate) ** t)
        return total
    
    # 二分法求解
    lo = -0.99
    hi = 10.0
    f_lo = npv(lo)
    f_hi = npv(hi)
    
    if f_lo == 0:
        return lo
    if f_hi == 0:
        return hi
    if f_lo * f_hi > 0:
        return 0.0
    
    for _ in range(200):
        mid = (lo + hi) / 2.0
        f_mid = npv(mid)
        if abs(f_mid) < 1e-8:
            return mid
        if f_lo * f_mid <= 0:
            hi = mid
            f_hi = f_mid
        else:
            lo = mid
            f_lo = f_mid
    
    return (lo + hi) / 2.0


def calculate_payback_period(
    initial_investment: float,
    annual_savings: List[float]
) -> Optional[float]:
    """
    计算回本期（年）
    
    Args:
        initial_investment: 初始投资（正值）
        annual_savings: 每年的节省金额
    
    Returns:
        回本期（年），如果无法回本则返回None
    """
    cumulative = -initial_investment
    
    for year, saving in enumerate(annual_savings, start=1):
        cumulative += saving
        if cumulative >= 0:
            # 线性插值计算精确回本时间
            prev_cumulative = cumulative - saving
            fraction = abs(prev_cumulative) / saving if saving > 0 else 0
            return year - 1 + fraction
    
    return None


def simulate_annual_savings(
    system_composition: Dict[str, Any],
    financial_params: Dict[str, Any],
    years: int = 20
) -> List[float]:
    """
    模拟每年的节省金额
    
    Args:
        system_composition: 系统组成信息
        financial_params: 财务参数
        years: 模拟年数
    
    Returns:
        每年的节省金额列表
    """
    # 提取参数
    annual_generation_kwh = system_composition['totalAnnualGenerationKwh']
    
    buy_price = financial_params.get('buyPricePerKwh', 0.35)
    feed_in_tariff = financial_params.get('feedInTariffPerKwh', 0.08)
    daily_fixed_fee = financial_params.get('dailyFixedFee', 1.0)
    price_inflation = financial_params.get('priceInflationRate', 0.03)
    panel_degradation_year1 = financial_params.get('panelDegradationYear1', 0.02)
    panel_degradation_after = financial_params.get('panelDegradationAfterYear1', 0.005)
    self_consumption_rate = financial_params.get('selfConsumptionRate', 0.4)
    
    annual_savings = []
    
    for year in range(1, years + 1):
        # 计算衰减系数
        if year == 1:
            degradation_factor = 1.0 - panel_degradation_year1
        else:
            degradation_factor = (1.0 - panel_degradation_year1) * \
                                ((1.0 - panel_degradation_after) ** (year - 1))
        
        # 计算电价上涨系数
        tariff_factor = (1.0 + price_inflation) ** year
        
        # 当年发电量
        generation_kwh = annual_generation_kwh * degradation_factor
        
        # 自用和上网电量
        self_used_kwh = generation_kwh * self_consumption_rate
        export_kwh = generation_kwh * (1 - self_consumption_rate)
        
        # 节省的电费（自用部分按零售电价计算）
        self_used_savings = self_used_kwh * buy_price * tariff_factor
        
        # 上网收入
        feed_in_income = export_kwh * feed_in_tariff
        
        # 年度总节省
        annual_saving = self_used_savings + feed_in_income
        
        annual_savings.append(annual_saving)
    
    return annual_savings


def calculate_roi_metrics(
    system_composition: Dict[str, Any],
    upfront_investment: float,
    subsidy: float,
    financial_params: Dict[str, Any],
    years: int = 20
) -> Dict[str, Any]:
    """
    计算ROI相关指标
    
    Args:
        system_composition: 系统组成信息
        upfront_investment: 前期投资
        subsidy: 政府补贴
        financial_params: 财务参数
        years: 计算年限
    
    Returns:
        ROI指标字典
    """
    # 净投资成本
    net_investment = upfront_investment - subsidy
    
    # 模拟年度节省
    annual_savings = simulate_annual_savings(system_composition, financial_params, years)
    
    # 计算IRR
    cashflows = [-net_investment] + annual_savings
    irr = calculate_irr(cashflows)
    
    # 计算回本期
    payback_period = calculate_payback_period(net_investment, annual_savings)
    
    # 计算总收益和ROI
    total_savings = sum(annual_savings)
    roi = (total_savings - net_investment) / net_investment if net_investment > 0 else 0.0
    
    # 计算NPV（使用5%折现率）
    discount_rate = 0.05
    npv = sum(cf / ((1 + discount_rate) ** t) for t, cf in enumerate(cashflows))
    
    return {
        'upfrontInvestment': upfront_investment,
        'subsidy': subsidy,
        'netInvestment': net_investment,
        'annualBillSavings': annual_savings[0] if annual_savings else 0.0,
        'totalSavings': total_savings,
        'irr': irr,
        'paybackPeriod': payback_period,
        'roi': roi,
        'npv': npv,
        'years': years,
        'cashflows': cashflows,
        'annualSavings': annual_savings
    }


def estimate_system_cost(
    capacity_kw: float,
    battery_capacity_kwh: float = 0.0,
    cost_per_kw: float = 1500.0,
    battery_cost_per_kwh: float = 1000.0
) -> float:
    """
    估算系统成本
    
    Args:
        capacity_kw: 系统容量 (kW)
        battery_capacity_kwh: 电池容量 (kWh)
        cost_per_kw: 每kW成本
        battery_cost_per_kwh: 每kWh电池成本
    
    Returns:
        总成本
    """
    pv_cost = capacity_kw * cost_per_kw
    battery_cost = battery_capacity_kwh * battery_cost_per_kwh
    return pv_cost + battery_cost


def estimate_subsidy(
    capacity_kw: float,
    state: str = 'VIC',
    subsidy_per_kw: float = 1000.0
) -> float:
    """
    估算政府补贴
    
    Args:
        capacity_kw: 系统容量 (kW)
        state: 州代码
        subsidy_per_kw: 每kW补贴金额
    
    Returns:
        补贴金额
    """
    # 简化计算，实际应根据不同州的政策
    return capacity_kw * subsidy_per_kw


def process_case(case_dir: Path, output_dir: Path, financial_params: Dict[str, Any]) -> None:
    """处理单个案例的ROI计算"""
    case_id = case_dir.name
    print(f"\n处理案例: {case_id}")
    print("-" * 60)
    
    try:
        # 加载系统组成计算结果
        system_composition_file = case_dir / 'system_composition.json'
        if not system_composition_file.exists():
            print(f"  ✗ 未找到系统组成计算结果")
            return
        
        data = load_json_file(system_composition_file)
        system_composition = data['systemComposition']
        project_info = data['projectInfo']
        
        # 估算成本和补贴
        capacity_kw = system_composition['actualCapacityKw']
        battery_capacity_kwh = financial_params.get('batteryCapacityKwh', 0.0)
        
        upfront_investment = estimate_system_cost(
            capacity_kw,
            battery_capacity_kwh,
            financial_params.get('costPerKw', 1500.0),
            financial_params.get('batteryCostPerKwh', 1000.0)
        )
        
        subsidy = estimate_subsidy(
            capacity_kw,
            project_info.get('state', 'VIC'),
            financial_params.get('subsidyPerKw', 1000.0)
        )
        
        # 计算ROI指标
        roi_metrics = calculate_roi_metrics(
            system_composition,
            upfront_investment,
            subsidy,
            financial_params,
            financial_params.get('years', 20)
        )
        
        # 组合结果
        result = {
            'projectInfo': project_info,
            'systemComposition': system_composition,
            'roiMetrics': roi_metrics
        }
        
        # 保存结果
        output_case_dir = output_dir / case_id
        output_case_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_case_dir / 'roi_calculation.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"  ✓ ROI计算完成")
        print(f"    - 系统容量: {capacity_kw:.2f} kW")
        print(f"    - 前期投资: ${upfront_investment:.2f}")
        print(f"    - 政府补贴: ${subsidy:.2f}")
        print(f"    - 净投资: ${roi_metrics['netInvestment']:.2f}")
        print(f"    - 年度节省: ${roi_metrics['annualBillSavings']:.2f}")
        print(f"    - IRR: {roi_metrics['irr']*100:.2f}%")
        if roi_metrics['paybackPeriod']:
            print(f"    - 回本期: {roi_metrics['paybackPeriod']:.2f} 年")
        else:
            print(f"    - 回本期: 无法回本")
        print(f"    - ROI: {roi_metrics['roi']*100:.2f}%")
        print(f"    - NPV: ${roi_metrics['npv']:.2f}")
        print(f"  ✓ 结果已保存到: {output_file}")
        
    except Exception as e:
        print(f"  ✗ 处理失败: {e}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(description='投资回报计算')
    parser.add_argument('--data-dir', required=True, help='数据目录（包含system_composition.json）')
    parser.add_argument('--output-dir', default='./output', help='输出目录')
    parser.add_argument('--config', help='财务参数配置文件（JSON）')
    parser.add_argument('--case-ids', nargs='*', help='指定案例ID（可选）')
    
    args = parser.parse_args()
    
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    
    # 加载财务参数
    if args.config:
        config_file = Path(args.config)
        if config_file.exists():
            financial_params = load_json_file(config_file)
        else:
            print(f"警告: 配置文件不存在: {config_file}，使用默认参数")
            financial_params = {}
    else:
        financial_params = {}
    
    # 默认财务参数
    default_params = {
        'buyPricePerKwh': 0.35,
        'feedInTariffPerKwh': 0.08,
        'dailyFixedFee': 1.0,
        'priceInflationRate': 0.03,
        'panelDegradationYear1': 0.02,
        'panelDegradationAfterYear1': 0.005,
        'selfConsumptionRate': 0.4,
        'batteryCapacityKwh': 0.0,
        'costPerKw': 1500.0,
        'batteryCostPerKwh': 1000.0,
        'subsidyPerKw': 1000.0,
        'years': 20
    }
    
    # 合并参数
    for key, value in default_params.items():
        if key not in financial_params:
            financial_params[key] = value
    
    print("=" * 60)
    print("投资回报计算")
    print("=" * 60)
    print(f"数据目录: {data_dir.absolute()}")
    print(f"输出目录: {output_dir.absolute()}")
    print("\n财务参数:")
    for key, value in financial_params.items():
        print(f"  - {key}: {value}")
    
    # 确定要处理的案例
    if args.case_ids:
        case_dirs = [data_dir / case_id for case_id in args.case_ids]
    else:
        case_dirs = [d for d in data_dir.iterdir() if d.is_dir() and not d.name.startswith('.')]
    
    case_dirs = [d for d in case_dirs if d.exists()]
    
    if not case_dirs:
        print("\n没有找到要处理的案例")
        return
    
    print(f"\n找到 {len(case_dirs)} 个案例")
    
    # 处理每个案例
    for case_dir in sorted(case_dirs):
        process_case(case_dir, output_dir, financial_params)
    
    print("\n" + "=" * 60)
    print("所有案例处理完成！")


if __name__ == '__main__':
    main()
