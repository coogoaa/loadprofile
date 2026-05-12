"""
从 CSV 文件中提取所有有效的项目ID
"""
import pandas as pd
from pathlib import Path

def extract_project_ids(csv_path: str) -> list:
    """从CSV文件中提取所有有效的项目ID"""
    df = pd.read_csv(csv_path, encoding='utf-8')
    
    # 提取项目ID列，过滤掉空值
    project_ids = df['项目ID'].dropna().astype(int).astype(str).tolist()
    
    return project_ids

if __name__ == '__main__':
    csv_path = '../CSV/V1.9版本 - 测试环境（官）(临时复制）_副本.csv'
    project_ids = extract_project_ids(csv_path)
    
    print(f"共找到 {len(project_ids)} 个项目ID:")
    print(' '.join(project_ids))
