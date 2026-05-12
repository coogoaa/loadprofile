"""
批量下载项目数据并生成汇总表格
功能：
1. 下载项目的 GIS 数据（detect_building.json）
2. 区分 with_pv 状态
3. 下载 image_drawed 图片
4. 下载 buildingbox 图片
5. 提取面积信息
6. 关联 CSV 表格数据并生成 Excel 汇总表格
"""

import json
import requests
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse
from datetime import datetime
import re


def download_file(url: str, output_path: Path, timeout: int = 30) -> bool:
    """下载文件到指定路径"""
    try:
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(response.content)
        
        return True
    except Exception as e:
        print(f"  ✗ 下载失败 {url}: {e}")
        return False


def download_gis_data(project_id: str, output_dir: Path) -> Optional[Dict]:
    """下载 GIS 数据（detect_building.json）"""
    url = f"https://file.greensketch.ai/marketing/test/debug/{project_id}/detect_building.json"
    output_path = output_dir / project_id / "detect_building.json"
    
    print(f"  下载 GIS 数据: {project_id}")
    if download_file(url, output_path):
        try:
            with open(output_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"  ✗ 解析 JSON 失败: {e}")
            return None
    return None


def download_image_drawed(project_id: str, gis_data: Dict, output_dir: Path) -> Tuple[Optional[str], Optional[str]]:
    """下载 image_drawed 图片，返回 (本地路径, URL)"""
    try:
        # GIS 数据可能嵌套在 data 字段中
        data = gis_data.get('data', gis_data)
        image_url = data.get('image_drawed', '')
        if not image_url:
            print(f"  ⚠ 未找到 image_drawed URL")
            return None, None
        
        # 从 URL 中提取文件扩展名
        ext = '.jpg'
        if '.' in image_url:
            ext = '.' + image_url.split('.')[-1].split('?')[0]
        
        output_path = output_dir / project_id / f"image_drawed{ext}"
        print(f"  下载 image_drawed: {image_url}")
        
        if download_file(image_url, output_path):
            return str(output_path.relative_to(output_dir)), image_url
        return None, image_url
    except Exception as e:
        print(f"  ✗ 下载 image_drawed 失败: {e}")
        return None, None


def download_buildingbox_image(project_id: str, gis_data: Dict, output_dir: Path) -> Tuple[Optional[str], Optional[str]]:
    """下载 buildingbox 图片，返回 (本地路径, URL)"""
    try:
        # GIS 数据可能嵌套在 data 字段中
        data = gis_data.get('data', gis_data)
        
        # 从 center 字段提取经纬度 (格式: "lon,lat")
        center = data.get('center', '')
        if center and ',' in center:
            lon, lat = center.split(',')
            lon = float(lon)
            lat = float(lat)
        else:
            lat = data.get('lat')
            lon = data.get('lon')
        
        if lat is None or lon is None:
            print(f"  ⚠ 未找到经纬度信息")
            return None, None
        
        # 构建 buildingbox URL
        url = f"https://file.greensketch.ai/maps/au/sale_agent/image/metromap_latest/image_{lon}_{lat}_buildingbox.jpg"
        output_path = output_dir / project_id / "buildingbox.jpg"
        
        print(f"  下载 buildingbox: {url}")
        if download_file(url, output_path):
            return str(output_path.relative_to(output_dir)), url
        return None, url
    except Exception as e:
        print(f"  ✗ 下载 buildingbox 失败: {e}")
        return None, None


def extract_area(gis_data: Dict) -> Optional[float]:
    """提取面积信息"""
    try:
        # GIS 数据可能嵌套在 data 字段中
        data = gis_data.get('data', gis_data)
        area = data.get('area')
        if area is not None:
            return float(area)
        return None
    except Exception as e:
        print(f"  ✗ 提取面积失败: {e}")
        return None


def extract_with_pv(gis_data: Dict) -> Optional[bool]:
    """提取 with_pv 状态"""
    try:
        # GIS 数据可能嵌套在 data 字段中
        data = gis_data.get('data', gis_data)
        with_pv = data.get('with_pv')
        if with_pv is not None:
            return bool(with_pv)
        return None
    except Exception as e:
        print(f"  ✗ 提取 with_pv 失败: {e}")
        return None


def extract_is_old(gis_data: Dict) -> Optional[bool]:
    """提取 is_old 状态"""
    try:
        # GIS 数据可能嵌套在 data 字段中
        data = gis_data.get('data', gis_data)
        is_old = data.get('is_old')
        if is_old is not None:
            return bool(is_old)
        return None
    except Exception as e:
        return None


def process_project(project_id: str, output_dir: Path) -> Dict:
    """处理单个项目"""
    print(f"\n处理项目: {project_id}")
    print("-" * 60)
    
    result = {
        '项目ID': project_id,
        'area': None,
        'image_drawed_path': None,
        'image_drawed_url': None,
        'buildingbox_path': None,
        'buildingbox_url': None,
        'with_pv': None,
        'is_old': None,
        'lat': None,
        'lon': None,
        'success': False
    }
    
    # 1. 下载 GIS 数据
    gis_data = download_gis_data(project_id, output_dir)
    if not gis_data:
        print(f"  ✗ 项目 {project_id} GIS 数据下载失败")
        return result
    
    # 2. 提取基础信息
    result['area'] = extract_area(gis_data)
    result['with_pv'] = extract_with_pv(gis_data)
    result['is_old'] = extract_is_old(gis_data)
    
    # 从 center 字段提取经纬度
    data = gis_data.get('data', gis_data)
    center = data.get('center', '')
    if center and ',' in center:
        lon, lat = center.split(',')
        result['lon'] = float(lon)
        result['lat'] = float(lat)
    else:
        result['lat'] = data.get('lat')
        result['lon'] = data.get('lon')
    
    # 3. 下载 image_drawed
    image_drawed_path, image_drawed_url = download_image_drawed(project_id, gis_data, output_dir)
    result['image_drawed_path'] = image_drawed_path
    result['image_drawed_url'] = image_drawed_url
    
    # 4. 下载 buildingbox
    buildingbox_path, buildingbox_url = download_buildingbox_image(project_id, gis_data, output_dir)
    result['buildingbox_path'] = buildingbox_path
    result['buildingbox_url'] = buildingbox_url
    
    result['success'] = True
    print(f"  ✓ 项目 {project_id} 处理完成")
    
    return result


def load_csv_data(csv_path: Path) -> pd.DataFrame:
    """加载 CSV 数据"""
    try:
        df = pd.read_csv(csv_path, encoding='utf-8')
        # 确保项目ID列存在
        if '项目ID' not in df.columns:
            print(f"⚠ CSV 文件中未找到 '项目ID' 列")
            return pd.DataFrame()
        return df
    except Exception as e:
        print(f"✗ 加载 CSV 文件失败: {e}")
        return pd.DataFrame()


def generate_summary_excel(results: List[Dict], csv_df: pd.DataFrame, output_path: Path):
    """生成汇总 Excel 表格"""
    print("\n生成汇总表格...")
    
    # 创建结果 DataFrame
    results_df = pd.DataFrame(results)
    
    # 如果有 CSV 数据，进行关联
    if not csv_df.empty:
        # 确保项目ID是字符串类型
        results_df['项目ID'] = results_df['项目ID'].astype(str)
        csv_df['项目ID'] = csv_df['项目ID'].astype(str)
        
        # 选择需要关联的列
        csv_columns = ['项目ID', 'lat_分析', 'lon_分析', '屋顶检测', '整体效果', 
                      '问题分类', '面板铺设', '电池墙', '掩码分割', '备注信息', '标注人']
        
        # 只保留存在的列
        available_columns = [col for col in csv_columns if col in csv_df.columns]
        csv_subset = csv_df[available_columns]
        
        # 合并数据
        merged_df = pd.merge(results_df, csv_subset, on='项目ID', how='left')
    else:
        merged_df = results_df
    
    # 重新排列列顺序
    column_order = ['项目ID', 'area', 'image_drawed_path', 'image_drawed_url', 
                   'buildingbox_path', 'buildingbox_url', 'with_pv', 'is_old', 'lat', 'lon']
    
    # 添加 CSV 中的列
    if not csv_df.empty:
        csv_cols = ['lat_分析', 'lon_分析', '屋顶检测', '整体效果', 
                   '问题分类', '面板铺设', '电池墙', '掩码分割', '备注信息', '标注人']
        for col in csv_cols:
            if col in merged_df.columns:
                column_order.append(col)
    
    # 添加其他列
    for col in merged_df.columns:
        if col not in column_order:
            column_order.append(col)
    
    # 重新排序
    final_df = merged_df[[col for col in column_order if col in merged_df.columns]]
    
    # 保存为 Excel
    output_path.parent.mkdir(parents=True, exist_ok=True)
    final_df.to_excel(output_path, index=False, engine='openpyxl')
    
    print(f"✓ 汇总表格已保存到: {output_path}")
    
    # 统计信息
    print("\n统计信息:")
    print(f"  总项目数: {len(results)}")
    print(f"  成功处理: {sum(1 for r in results if r['success'])}")
    print(f"  with_pv=True: {sum(1 for r in results if r.get('with_pv') == True)}")
    print(f"  with_pv=False: {sum(1 for r in results if r.get('with_pv') == False)}")
    print(f"  is_old=True: {sum(1 for r in results if r.get('is_old') == True)}")
    print(f"  is_old=False: {sum(1 for r in results if r.get('is_old') == False)}")


def main():
    parser = argparse.ArgumentParser(description='批量下载项目数据并生成汇总表格')
    parser.add_argument('project_ids', nargs='+', help='项目ID列表（空格分隔）')
    parser.add_argument('--output-dir', default='../测试数据', help='输出目录')
    parser.add_argument('--csv-file', default='../CSV/V1.9版本 - 测试环境（官）(临时复制）_副本.csv', 
                       help='CSV 文件路径')
    parser.add_argument('--excel-output', help='Excel 输出路径（默认：输出目录/batch_summary_时间戳.xlsx）')
    
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    csv_path = Path(args.csv_file)
    
    print("=" * 60)
    print("批量项目数据下载与分析")
    print("=" * 60)
    print(f"项目数量: {len(args.project_ids)}")
    print(f"输出目录: {output_dir.absolute()}")
    print(f"CSV 文件: {csv_path.absolute()}")
    print("=" * 60)
    
    # 加载 CSV 数据
    csv_df = pd.DataFrame()
    if csv_path.exists():
        csv_df = load_csv_data(csv_path)
        print(f"✓ CSV 数据加载成功: {len(csv_df)} 行")
    else:
        print(f"⚠ CSV 文件不存在: {csv_path}")
    
    # 处理所有项目
    results = []
    for project_id in args.project_ids:
        result = process_project(str(project_id), output_dir)
        results.append(result)
    
    # 生成汇总表格
    if args.excel_output:
        excel_path = Path(args.excel_output)
    else:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        excel_path = output_dir / f"batch_summary_{timestamp}.xlsx"
    
    generate_summary_excel(results, csv_df, excel_path)
    
    print("\n" + "=" * 60)
    print("批量处理完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()
