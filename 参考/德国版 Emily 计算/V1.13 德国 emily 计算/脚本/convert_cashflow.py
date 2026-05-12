#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将下载的现金流 JSON 文件转换为纵列表格格式
"""

import json
import sys
from pathlib import Path


def load_cashflow(file_path):
    """加载现金流 JSON 文件"""
    with open(file_path, 'r') as f:
        return json.load(f)


def convert_to_table(case_id, data_dir):
    """将三个现金流文件转换为纵列表格"""
    
    # 读取三个现金流文件
    designs = ['maxValue', 'mostPopular', 'customFit']
    cashflows = {}
    
    for design in designs:
        cf_file = Path(data_dir) / case_id / f"{design}_cashflow.json"
        if cf_file.exists():
            cashflows[design] = load_cashflow(cf_file)
            print(f"✓ 已加载 {design}_cashflow.json")
        else:
            print(f"✗ 未找到 {design}_cashflow.json")
    
    if not cashflows:
        print("错误：未找到任何现金流文件")
        return
    
    # 找到最长的现金流长度
    max_len = max(len(cf) for cf in cashflows.values())
    
    # 生成表格
    print("\n" + "=" * 100)
    print(f"现金流对比表 (case_id: {case_id})")
    print("=" * 100)
    print(f"{'年份':<8}", end="")
    for design in designs:
        if design in cashflows:
            print(f"{design:<25}", end="")
    print()
    print("-" * 100)
    
    for year in range(max_len):
        print(f"{year:<8}", end="")
        for design in designs:
            if design in cashflows and year < len(cashflows[design]):
                val = cashflows[design][year]
                print(f"{val:>20,.2f} EUR".replace(",", " ").replace(".", ",")[:25], end="")
            else:
                print(f"{'-':>25}", end="")
        print()
    
    print("=" * 100)
    
    # 输出为 CSV 格式
    output_file = Path(data_dir) / case_id / "cashflow_comparison.csv"
    with open(output_file, 'w') as f:
        # 表头
        f.write("Year")
        for design in designs:
            if design in cashflows:
                f.write(f",{design}")
        f.write("\n")
        
        # 数据行
        for year in range(max_len):
            f.write(str(year))
            for design in designs:
                if design in cashflows and year < len(cashflows[design]):
                    f.write(f",{cashflows[design][year]}")
                else:
                    f.write(",")
            f.write("\n")
    
    print(f"\n✓ 已保存 CSV 文件: {output_file}")


def main():
    if len(sys.argv) != 3:
        print("用法: python convert_cashflow.py <case_id> <data_dir>")
        print("示例: python convert_cashflow.py 11176 ../../../V1.7 测试/测试数据")
        sys.exit(1)
    
    case_id = sys.argv[1]
    data_dir = sys.argv[2]
    
    convert_to_table(case_id, data_dir)


if __name__ == "__main__":
    main()
