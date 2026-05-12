#!/bin/bash

# DE V1.13 德国 Emily 计算 · 一键运行脚本
# 用途：解析 cases.md → 下载 GIS 数据 → LoadProfile → 系统组成 → 能量流 → ROI

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检查参数
if [ $# -eq 0 ]; then
    print_error "请提供 cases.md 路径"
    echo "用法: $0 <cases.md> [data_dir] [output_dir]"
    echo "示例: $0 ../配置/cases.md ../../../V1.7 测试/测试数据 ../输出"
    exit 1
fi

CASES_MD="$1"
DATA_DIR="${2:-../../../V1.7 测试/测试数据}"
OUTPUT_DIR="${3:-../输出}"

print_info "DE V1.13 德国 Emily 计算 - 完整工作流程"
echo "输入清单: $CASES_MD"
echo "数据目录: $DATA_DIR"
echo "输出目录: $OUTPUT_DIR"
echo ""

# 步骤 0：解析 cases.md 提取 case_id 列表
print_info "步骤 0/5: 解析 cases.md..."
python3 parse_cases.py "$CASES_MD" --json /tmp/cases.json
CASE_IDS=$(python3 -c "import json; print(' '.join(str(c['case_id']) for c in json.load(open('/tmp/cases.json'))))")
if [ -z "$CASE_IDS" ]; then
    print_error "未找到任何 case_id"
    exit 1
fi
echo "发现 case_ids: $CASE_IDS"
echo ""

# 步骤 1：下载数据（如果数据目录不存在或为空）
print_info "步骤 1/5: 下载数据..."
if [ ! -d "$DATA_DIR" ] || [ -z "$(ls -A $DATA_DIR)" ]; then
    python3 download_data.py $CASE_IDS --output-dir "$DATA_DIR"
else
    print_warning "数据目录已存在且非空，跳过下载"
fi
echo ""

# 步骤 2：Load Profile 计算
print_info "步骤 2/5: Load Profile 计算..."
python3 de_load_profile.py --cases "$CASES_MD" --data-dir "$DATA_DIR" --output-dir "$OUTPUT_DIR"
echo ""

# 步骤 3：系统组成计算
print_info "步骤 3/5: 系统组成计算..."
python3 de_system_composition.py --cases "$CASES_MD" --data-dir "$DATA_DIR" --output-dir "$OUTPUT_DIR"
echo ""

# 步骤 4：能量流模拟
print_info "步骤 4/5: 能量流模拟..."
python3 de_energy_flow.py --cases "$CASES_MD" --data-dir "$DATA_DIR" --output-dir "$OUTPUT_DIR"
echo ""

# 步骤 5：ROI 计算
print_info "步骤 5/5: ROI 计算..."
python3 de_roi_calculation.py --cases "$CASES_MD" --output-dir "$OUTPUT_DIR"
echo ""

print_info "所有步骤完成！"
echo ""
print_info "查看结果："
for case_id in $CASE_IDS; do
    if [ -d "$OUTPUT_DIR/$case_id/R" ]; then
        echo "  案例 $case_id (R 改造):"
        echo "    - LoadProfile: $OUTPUT_DIR/$case_id/01_load_profile.json / .md"
        echo "    - 系统组成: $OUTPUT_DIR/$case_id/R/02_system_composition.json / .md"
        echo "    - 能量流: $OUTPUT_DIR/$case_id/R/03_energy_flow.json / .md"
        echo "    - ROI: $OUTPUT_DIR/$case_id/R/04_roi.json / .md"
    fi
    if [ -d "$OUTPUT_DIR/$case_id/N" ]; then
        echo "  案例 $case_id (N 全新建):"
        echo "    - 系统组成: $OUTPUT_DIR/$case_id/N/02_system_composition.json / .md"
        echo "    - 能量流: $OUTPUT_DIR/$case_id/N/03_energy_flow.json / .md"
        echo "    - ROI: $OUTPUT_DIR/$case_id/N/04_roi.json / .md"
    fi
done
echo ""
print_info "快速查看 ROI 摘要："
for case_id in $CASE_IDS; do
    for mode in R N; do
        roi_file="$OUTPUT_DIR/$case_id/$mode/04_roi.json"
        if [ -f "$roi_file" ]; then
            echo ""
            echo "案例 $case_id ($mode):"
            python3 -c "
import json
with open('$roi_file') as f:
    d = json.load(f)
    cb = d['cost_breakdown']
    irr = d['IRR'] if d['IRR'] else None
    pb = d['payback_years'] if d['payback_years'] else None
    print(f\"  投资: €{cb['total']:,.0f}\")
    print(f\"  IRR: {irr*100:.2f}%\" if irr else \"  IRR: --\")
    print(f\"  NPV: €{d['NPV']:,.0f}\")
    print(f\"  回本期: {pb:.2f} 年\" if pb else \"  回本期: --\")
"
        fi
    done
done
