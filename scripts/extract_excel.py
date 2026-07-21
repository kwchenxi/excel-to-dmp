#!/usr/bin/env python3
"""本地 Excel 数据提取工具 - 从 .xlsx 文件中提取缺陷数据

用法：
    python scripts/extract_excel.py --input defects.xlsx --config config.yaml
"""

import os
import sys
import argparse
import shutil

# 将 scripts/ 加入 path 以导入 utils
sys.path.insert(0, os.path.dirname(__file__))
from utils import load_config, build_defect_data, save_results


def find_column_indices(ws, column_names):
    """根据列名找到列索引（第一行为表头）"""
    print(f"\n=== 查找列索引 ===")
    headers = []
    for cell in ws[1]:
        headers.append(str(cell.value).strip() if cell.value else "")
    
    indices = {}
    for name, col_name in column_names.items():
        try:
            idx = headers.index(col_name)
            indices[name] = idx
            print(f"  {name}: 列{chr(65+idx)} = '{col_name}'")
        except ValueError:
            print(f"  ⚠️ 列 '{col_name}' 未找到，跳过 {name}")
    
    return indices


def read_excel_data(ws, column_indices, images_dir=None):
    """读取 Excel 数据"""
    print(f"\n=== 读取 Excel 数据 ===")
    defects = []
    
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=False), start=2):
        values = [str(cell.value).strip() if cell.value is not None else "" for cell in row]
        
        # 跳过空行
        if not any(values):
            continue
        
        defect = {"row": row_idx}
        has_data = False
        
        for field, col_idx in column_indices.items():
            if col_idx < len(values):
                defect[field] = values[col_idx]
                if defect[field]:
                    has_data = True
            else:
                defect[field] = ""
        
        # 处理本地图片：检查是否有 "问题截图" 和 "设计稿参考" 目录
        if images_dir and os.path.isdir(images_dir):
            for field in ["screenshot", "design_ref"]:
                pattern = f"r{row_idx}_{field}_"
                matching = [f for f in os.listdir(images_dir) if f.startswith(pattern)]
                if matching:
                    defect[f"{field}_files"] = [os.path.join(images_dir, f) for f in matching]
                    print(f"  📎 row{row_idx} {field}: {len(matching)} 张图片")
        
        if has_data and defect.get("description"):
            defects.append(defect)
    
    print(f"  ✅ 共提取 {len(defects)} 条缺陷数据")
    return defects


def main():
    parser = argparse.ArgumentParser(description="从本地 Excel 提取缺陷数据")
    parser.add_argument("--input", required=True, help="Excel 文件路径 (.xlsx)")
    parser.add_argument("--config", default="config.yaml", help="配置文件路径")
    parser.add_argument("--output", default="pending_defects.json", help="输出文件路径")
    parser.add_argument("--images-dir", default="images", help="本地图片目录（可选，按 r{行号}_{字段}_ 命名）")
    parser.add_argument("--sheet", default=0, type=int, help="工作表索引（默认第一个）")
    args = parser.parse_args()
    
    # 检查文件
    if not os.path.isfile(args.input):
        print(f"❌ 文件不存在: {args.input}")
        return
    
    # 检查 openpyxl
    try:
        from openpyxl import load_workbook
    except ImportError:
        print("❌ 缺少 openpyxl，请运行: pip install openpyxl")
        return
    
    config = load_config(args.config)
    
    print(f"\n=== 打开 Excel: {args.input} ===")
    wb = load_workbook(args.input, data_only=True)
    
    if args.sheet >= len(wb.sheetnames):
        print(f"❌ 工作表索引 {args.sheet} 超出范围，共 {len(wb.sheetnames)} 个")
        return
    
    ws = wb[wb.sheetnames[args.sheet]]
    print(f"  📋 工作表: {wb.sheetnames[args.sheet]}")
    
    column_names = config.get("feishu_columns", {})
    column_indices = find_column_indices(ws, column_names)
    
    defects = read_excel_data(ws, column_indices, args.images_dir)
    results = build_defect_data(defects, config)
    
    save_results(results, args.output)
    
    print(f"\n=== 完成 ===")
    print(f"✅ 共 {len(results)} 条缺陷待创建")


if __name__ == "__main__":
    main()
