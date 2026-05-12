"""
数据下载工具
从远程服务器下载测试所需的各类数据文件
"""

import json
import requests
from pathlib import Path
from typing import Optional
import argparse


def download_file(url: str, output_path: Path) -> bool:
    """下载文件到指定路径"""
    try:
        print(f"下载: {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(response.content)
        
        print(f"  ✓ 已保存到: {output_path}")
        return True
    except Exception as e:
        print(f"  ✗ 下载失败: {e}")
        return False


def download_case_data(case_id: str, output_dir: Path) -> dict:
    """下载指定案例的所有数据文件"""
    base_url = "https://file.greensketch.ai/marketing/test/debug"
    
    files = {
        'request': f'{base_url}/{case_id}/request.json',
        'panel_location': f'{base_url}/{case_id}/panel_location.json',
        'detect_building': f'{base_url}/{case_id}/detect_building.json',
    }
    
    # 三种设计方案的数据
    for design in ['maxValue', 'mostPopular', 'customFit']:
        files[f'{design}_panel_location'] = f'{base_url}/{case_id}/{design}_panel_location.json'
        files[f'{design}_cashflow'] = f'{base_url}/{case_id}/{design}_cashflow.json'
    
    case_dir = output_dir / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    
    results = {}
    for name, url in files.items():
        output_path = case_dir / f"{name}.json"
        success = download_file(url, output_path)
        results[name] = {
            'url': url,
            'path': str(output_path),
            'success': success
        }
    
    return results


def main():
    parser = argparse.ArgumentParser(description='下载测试数据')
    parser.add_argument('case_ids', nargs='+', help='案例ID列表')
    parser.add_argument('--output-dir', default='./data', help='输出目录')
    
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    
    print(f"开始下载 {len(args.case_ids)} 个案例的数据...")
    print(f"输出目录: {output_dir.absolute()}")
    print("=" * 60)
    
    all_results = {}
    for case_id in args.case_ids:
        print(f"\n处理案例: {case_id}")
        print("-" * 60)
        results = download_case_data(case_id, output_dir)
        all_results[case_id] = results
        
        # 统计成功/失败
        success_count = sum(1 for r in results.values() if r['success'])
        total_count = len(results)
        print(f"\n案例 {case_id} 完成: {success_count}/{total_count} 个文件下载成功")
    
    # 保存下载记录
    summary_file = output_dir / 'download_summary.json'
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print(f"所有下载完成！")
    print(f"下载记录已保存到: {summary_file}")


if __name__ == '__main__':
    main()
