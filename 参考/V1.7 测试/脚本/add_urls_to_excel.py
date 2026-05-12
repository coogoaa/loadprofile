"""
从已下载的 GIS 数据中提取图片 URL，并添加到现有的 Excel 表格中
这个脚本会快速读取已有数据，无需重新下载
"""
import json
import pandas as pd
from pathlib import Path
from typing import Optional, Tuple


def extract_urls_from_gis(gis_file: Path) -> Tuple[Optional[str], Optional[str]]:
    """从 GIS 文件中提取图片 URL"""
    try:
        with open(gis_file, 'r', encoding='utf-8') as f:
            gis_data = json.load(f)
        
        # GIS 数据可能嵌套在 data 字段中
        data = gis_data.get('data', gis_data)
        
        # 提取 image_drawed URL
        image_drawed_url = data.get('image_drawed', '')
        
        # 提取经纬度并构建 buildingbox URL
        center = data.get('center', '')
        if center and ',' in center:
            lon, lat = center.split(',')
            buildingbox_url = f"https://file.greensketch.ai/maps/au/sale_agent/image/metromap_latest/image_{lon}_{lat}_buildingbox.jpg"
        else:
            buildingbox_url = None
        
        return image_drawed_url if image_drawed_url else None, buildingbox_url
    except Exception as e:
        print(f"  ✗ 读取 GIS 文件失败: {e}")
        return None, None


def add_urls_to_excel(data_dir: Path, excel_file: Path, output_file: Path):
    """从已有数据中提取 URL 并添加到 Excel 表格"""
    print(f"读取 Excel 文件: {excel_file}")
    
    # 读取现有的 Excel 文件
    df = pd.read_excel(excel_file, engine='openpyxl')
    
    print(f"共 {len(df)} 行数据")
    print("开始提取 URL...")
    
    # 添加 URL 列
    image_drawed_urls = []
    buildingbox_urls = []
    
    for idx, row in df.iterrows():
        project_id = str(row['项目ID'])
        gis_file = data_dir / project_id / 'detect_building.json'
        
        if gis_file.exists():
            image_url, buildingbox_url = extract_urls_from_gis(gis_file)
            image_drawed_urls.append(image_url)
            buildingbox_urls.append(buildingbox_url)
        else:
            image_drawed_urls.append(None)
            buildingbox_urls.append(None)
        
        if (idx + 1) % 50 == 0:
            print(f"  已处理 {idx + 1}/{len(df)} 行...")
    
    # 在 image_drawed_path 后面插入 image_drawed_url
    if 'image_drawed_path' in df.columns:
        path_idx = df.columns.get_loc('image_drawed_path')
        df.insert(path_idx + 1, 'image_drawed_url', image_drawed_urls)
    else:
        df['image_drawed_url'] = image_drawed_urls
    
    # 在 buildingbox_path 后面插入 buildingbox_url
    if 'buildingbox_path' in df.columns:
        path_idx = df.columns.get_loc('buildingbox_path')
        df.insert(path_idx + 1, 'buildingbox_url', buildingbox_urls)
    else:
        df['buildingbox_url'] = buildingbox_urls
    
    # 保存新的 Excel 文件
    df.to_excel(output_file, index=False, engine='openpyxl')
    
    print(f"\n✓ 完成！新的 Excel 文件已保存到: {output_file}")
    print(f"  image_drawed_url: {sum(1 for x in image_drawed_urls if x)} 个")
    print(f"  buildingbox_url: {sum(1 for x in buildingbox_urls if x)} 个")


if __name__ == '__main__':
    data_dir = Path('../测试数据')
    excel_file = Path('../测试数据/batch_summary_all_projects.xlsx')
    output_file = Path('../测试数据/batch_summary_all_projects_with_urls.xlsx')
    
    add_urls_to_excel(data_dir, excel_file, output_file)
