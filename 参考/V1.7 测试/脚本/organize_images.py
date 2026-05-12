"""
整理图片到统一文件夹
将所有项目的图片复制到一个文件夹，并按照 "项目ID_图片类别" 的方式命名
"""
import shutil
from pathlib import Path
from typing import List
import argparse


def organize_images(data_dir: Path, output_dir: Path, project_ids: List[str]):
    """
    整理图片到统一文件夹
    
    Args:
        data_dir: 测试数据目录
        output_dir: 输出图片目录
        project_ids: 项目ID列表
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    stats = {
        'total': len(project_ids),
        'image_drawed': 0,
        'buildingbox': 0,
        'failed': 0
    }
    
    print(f"开始整理 {len(project_ids)} 个项目的图片...")
    print(f"输出目录: {output_dir.absolute()}")
    print("=" * 60)
    
    for i, project_id in enumerate(project_ids, 1):
        project_dir = data_dir / project_id
        
        if not project_dir.exists():
            print(f"[{i}/{len(project_ids)}] ⚠ 项目 {project_id} 目录不存在")
            stats['failed'] += 1
            continue
        
        # 处理 image_drawed
        image_drawed_files = list(project_dir.glob("image_drawed.*"))
        if image_drawed_files:
            src = image_drawed_files[0]
            ext = src.suffix
            dst = output_dir / f"{project_id}_image_drawed{ext}"
            try:
                shutil.copy2(src, dst)
                stats['image_drawed'] += 1
            except Exception as e:
                print(f"[{i}/{len(project_ids)}] ✗ 复制 image_drawed 失败 {project_id}: {e}")
        
        # 处理 buildingbox
        buildingbox_files = list(project_dir.glob("buildingbox.*"))
        if buildingbox_files:
            src = buildingbox_files[0]
            ext = src.suffix
            dst = output_dir / f"{project_id}_buildingbox{ext}"
            try:
                shutil.copy2(src, dst)
                stats['buildingbox'] += 1
            except Exception as e:
                print(f"[{i}/{len(project_ids)}] ✗ 复制 buildingbox 失败 {project_id}: {e}")
        
        if (i % 50 == 0) or (i == len(project_ids)):
            print(f"[{i}/{len(project_ids)}] 已处理 {i} 个项目...")
    
    print("\n" + "=" * 60)
    print("整理完成！")
    print("=" * 60)
    print(f"统计信息:")
    print(f"  总项目数: {stats['total']}")
    print(f"  image_drawed: {stats['image_drawed']} 张")
    print(f"  buildingbox: {stats['buildingbox']} 张")
    print(f"  失败: {stats['failed']} 个")
    print(f"\n输出目录: {output_dir.absolute()}")


def main():
    parser = argparse.ArgumentParser(description='整理图片到统一文件夹')
    parser.add_argument('--data-dir', default='../测试数据', help='测试数据目录')
    parser.add_argument('--output-dir', default='../图片汇总', help='输出图片目录')
    parser.add_argument('--csv-file', default='../CSV/V1.9版本 - 测试环境（官）(临时复制）_副本.csv',
                       help='CSV 文件路径（用于提取项目ID）')
    
    args = parser.parse_args()
    
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    
    # 从 CSV 提取项目ID
    import pandas as pd
    try:
        df = pd.read_csv(args.csv_file, encoding='utf-8')
        project_ids = df['项目ID'].dropna().astype(int).astype(str).tolist()
        print(f"从 CSV 文件读取到 {len(project_ids)} 个项目ID")
    except Exception as e:
        print(f"✗ 读取 CSV 文件失败: {e}")
        return
    
    organize_images(data_dir, output_dir, project_ids)


if __name__ == '__main__':
    main()
