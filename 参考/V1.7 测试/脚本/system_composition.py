"""
系统组成计算
基于 roi_verify.py 的逻辑，实现方案B的目标容量规则
"""

import json
import argparse
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional


def load_json_file(file_path: Path) -> Dict[str, Any]:
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def calculate_initial_pv_capacity(panel_location_data: List[Dict[str, Any]]) -> float:
    """
    计算屋顶初始PV容量
    
    Args:
        panel_location_data: panel_location.json 的数据数组
    
    Returns:
        初始PV容量 (kW)
    """
    total_annual_kwh = 0.0
    panel_count = len(panel_location_data)
    
    for panel in panel_location_data:
        generation_power = panel.get('generationPower', {})
        annual_power = generation_power.get('annualGeneratePower', 0.0)
        total_annual_kwh += float(annual_power)
    
    # 假设每块面板额定功率 450W = 0.45kW
    # 或者根据年发电量反推：capacity ≈ annual_kwh / (peak_sun_hours * 365 * efficiency)
    # 这里使用简化方法：面板数量 × 单块功率
    panel_power_kw = 0.45
    initial_capacity_kw = panel_count * panel_power_kw
    
    return initial_capacity_kw


def determine_target_capacity_plan_b(initial_pv_capacity_kw: float) -> float:
    """
    确定方案B的目标容量
    
    规则：
    - 若屋顶初始 PV 容量 > 15kW，目标设为 13.2kW
    - 若屋顶初始 PV 容量 <= 15kW，目标设为 10.12kW
    
    Args:
        initial_pv_capacity_kw: 初始PV容量 (kW)
    
    Returns:
        目标容量 (kW)
    """
    if initial_pv_capacity_kw > 15.0:
        return 13.2
    else:
        return 10.12


def select_panels_for_target_capacity(
    panel_location_data: List[Dict[str, Any]],
    target_capacity_kw: float,
    panel_power_kw: float = 0.45
) -> Tuple[List[Dict[str, Any]], float, int]:
    """
    选择面板以达到目标容量
    
    策略：优先选择发电量高的面板
    
    Args:
        panel_location_data: 面板数据数组
        target_capacity_kw: 目标容量 (kW)
        panel_power_kw: 单块面板功率 (kW)
    
    Returns:
        (选中的面板列表, 实际容量, 面板数量)
    """
    # 按年发电量排序（降序）
    sorted_panels = sorted(
        panel_location_data,
        key=lambda p: p.get('generationPower', {}).get('annualGeneratePower', 0.0),
        reverse=True
    )
    
    target_panel_count = int(target_capacity_kw / panel_power_kw)
    
    # 选择前N块面板
    selected_panels = sorted_panels[:target_panel_count]
    actual_capacity = len(selected_panels) * panel_power_kw
    
    return selected_panels, actual_capacity, len(selected_panels)


def calculate_system_composition(
    request_data: Dict[str, Any],
    panel_location_data: List[Dict[str, Any]],
    detect_building_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    计算系统组成
    
    Args:
        request_data: request.json 数据
        panel_location_data: panel_location.json 数据
        detect_building_data: detect_building.json 数据
    
    Returns:
        系统组成计算结果
    """
    # 1. 计算初始PV容量
    initial_capacity = calculate_initial_pv_capacity(panel_location_data)
    
    # 2. 确定目标容量（方案B）
    target_capacity = determine_target_capacity_plan_b(initial_capacity)
    
    # 3. 选择面板
    selected_panels, actual_capacity, panel_count = select_panels_for_target_capacity(
        panel_location_data,
        target_capacity
    )
    
    # 4. 计算总发电量
    total_annual_generation = sum(
        p.get('generationPower', {}).get('annualGeneratePower', 0.0)
        for p in selected_panels
    )
    
    # 5. 提取建筑信息
    building_area = detect_building_data.get('data', {}).get('area', 0.0)
    
    # 6. 提取项目信息
    project_info = request_data.get('project', {})
    
    result = {
        'projectInfo': {
            'id': project_info.get('id'),
            'projectCode': project_info.get('projectCode'),
            'address': project_info.get('address'),
            'state': project_info.get('state'),
            'city': project_info.get('city'),
            'countryCode': project_info.get('countryCode'),
            'longitude': project_info.get('longitude'),
            'latitude': project_info.get('latitude')
        },
        'buildingInfo': {
            'area': building_area,
            'mapType': detect_building_data.get('data', {}).get('map_type')
        },
        'systemComposition': {
            'initialPanelCount': len(panel_location_data),
            'initialCapacityKw': initial_capacity,
            'targetCapacityKw': target_capacity,
            'selectedPanelCount': panel_count,
            'actualCapacityKw': actual_capacity,
            'totalAnnualGenerationKwh': total_annual_generation,
            'capacityUtilization': (actual_capacity / initial_capacity) if initial_capacity > 0 else 0.0
        },
        'selectedPanels': [
            {
                'positions': p.get('panelLocationInfo', {}).get('positions'),
                'aspect': p.get('panelLocationInfo', {}).get('aspect'),
                'slope': p.get('panelLocationInfo', {}).get('slope'),
                'annualGeneratePower': p.get('generationPower', {}).get('annualGeneratePower'),
                'roofId': p.get('panelLocationInfo', {}).get('positionIndexList', [{}])[0].get('roofId')
            }
            for p in selected_panels
        ]
    }
    
    return result


def process_case(case_dir: Path, output_dir: Path) -> None:
    """处理单个案例"""
    case_id = case_dir.name
    print(f"\n处理案例: {case_id}")
    print("-" * 60)
    
    try:
        # 加载数据文件
        request_file = case_dir / 'request.json'
        panel_location_file = case_dir / 'panel_location.json'
        detect_building_file = case_dir / 'detect_building.json'
        
        if not all([request_file.exists(), panel_location_file.exists(), detect_building_file.exists()]):
            print(f"  ✗ 缺少必要的数据文件")
            return
        
        request_data = load_json_file(request_file)
        panel_location_data = load_json_file(panel_location_file)
        detect_building_data = load_json_file(detect_building_file)
        
        # 计算系统组成
        result = calculate_system_composition(
            request_data,
            panel_location_data,
            detect_building_data
        )
        
        # 保存结果
        output_case_dir = output_dir / case_id
        output_case_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_case_dir / 'system_composition.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"  ✓ 系统组成计算完成")
        print(f"    - 初始容量: {result['systemComposition']['initialCapacityKw']:.2f} kW")
        print(f"    - 目标容量: {result['systemComposition']['targetCapacityKw']:.2f} kW")
        print(f"    - 实际容量: {result['systemComposition']['actualCapacityKw']:.2f} kW")
        print(f"    - 选中面板: {result['systemComposition']['selectedPanelCount']} 块")
        print(f"    - 年发电量: {result['systemComposition']['totalAnnualGenerationKwh']:.2f} kWh")
        print(f"  ✓ 结果已保存到: {output_file}")
        
    except Exception as e:
        print(f"  ✗ 处理失败: {e}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(description='系统组成计算')
    parser.add_argument('--data-dir', required=True, help='数据目录')
    parser.add_argument('--output-dir', default='./output', help='输出目录')
    parser.add_argument('--case-ids', nargs='*', help='指定案例ID（可选，默认处理所有）')
    
    args = parser.parse_args()
    
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    
    if not data_dir.exists():
        print(f"错误: 数据目录不存在: {data_dir}")
        return
    
    print("=" * 60)
    print("系统组成计算")
    print("=" * 60)
    print(f"数据目录: {data_dir.absolute()}")
    print(f"输出目录: {output_dir.absolute()}")
    
    # 确定要处理的案例
    if args.case_ids:
        case_dirs = [data_dir / case_id for case_id in args.case_ids]
    else:
        case_dirs = [d for d in data_dir.iterdir() if d.is_dir() and not d.name.startswith('.')]
    
    case_dirs = [d for d in case_dirs if d.exists()]
    
    if not case_dirs:
        print("没有找到要处理的案例")
        return
    
    print(f"找到 {len(case_dirs)} 个案例")
    
    # 处理每个案例
    for case_dir in sorted(case_dirs):
        process_case(case_dir, output_dir)
    
    print("\n" + "=" * 60)
    print("所有案例处理完成！")


if __name__ == '__main__':
    main()
