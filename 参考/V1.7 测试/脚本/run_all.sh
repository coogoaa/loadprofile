#!/bin/bash

# V1.7 测试 - 一键运行脚本
# 用途：下载数据 -> 计算系统组成 -> 计算投资回报

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
    print_error "请提供至少一个案例ID"
    echo "用法: $0 <case_id1> [case_id2] [case_id3] ..."
    echo "示例: $0 5421"
    echo "示例: $0 5094 5421"
    exit 1
fi

CASE_IDS="$@"
DATA_DIR="../data"
OUTPUT_DIR="../output"
CONFIG_FILE="financial_config.json"

print_info "V1.7 测试 - 完整工作流程"
echo "案例ID: $CASE_IDS"
echo "数据目录: $DATA_DIR"
echo "输出目录: $OUTPUT_DIR"
echo "配置文件: $CONFIG_FILE"
echo ""

# 步骤1: 下载数据
print_info "步骤 1/3: 下载测试数据..."
python3 download_data.py $CASE_IDS --output-dir "$DATA_DIR"

if [ $? -ne 0 ]; then
    print_error "数据下载失败"
    exit 1
fi

echo ""

# 步骤2: 计算系统组成
print_info "步骤 2/3: 计算系统组成..."
python3 system_composition.py --data-dir "$DATA_DIR" --output-dir "$OUTPUT_DIR"

if [ $? -ne 0 ]; then
    print_error "系统组成计算失败"
    exit 1
fi

echo ""

# 步骤3: 计算投资回报
print_info "步骤 3/3: 计算投资回报..."

if [ -f "$CONFIG_FILE" ]; then
    print_info "使用配置文件: $CONFIG_FILE"
    python3 roi_calculation.py --data-dir "$OUTPUT_DIR" --output-dir "$OUTPUT_DIR" --config "$CONFIG_FILE"
else
    print_warning "未找到配置文件，使用默认参数"
    python3 roi_calculation.py --data-dir "$OUTPUT_DIR" --output-dir "$OUTPUT_DIR"
fi

if [ $? -ne 0 ]; then
    print_error "投资回报计算失败"
    exit 1
fi

echo ""
print_info "所有步骤完成！"
echo ""
print_info "查看结果："

for case_id in $CASE_IDS; do
    echo "  案例 $case_id:"
    echo "    - 系统组成: $OUTPUT_DIR/$case_id/system_composition.json"
    echo "    - 投资回报: $OUTPUT_DIR/$case_id/roi_calculation.json"
done

echo ""
print_info "快速查看结果："
for case_id in $CASE_IDS; do
    if [ -f "$OUTPUT_DIR/$case_id/roi_calculation.json" ]; then
        echo ""
        echo "案例 $case_id 摘要:"
        python3 -c "
import json
with open('$OUTPUT_DIR/$case_id/roi_calculation.json') as f:
    data = json.load(f)
    comp = data['systemComposition']
    roi = data['roiMetrics']
    print(f\"  系统容量: {comp['actualCapacityKw']:.2f} kW\")
    print(f\"  年发电量: {comp['totalAnnualGenerationKwh']:.2f} kWh\")
    print(f\"  前期投资: \${roi['upfrontInvestment']:.2f}\")
    print(f\"  政府补贴: \${roi['subsidy']:.2f}\")
    print(f\"  净投资: \${roi['netInvestment']:.2f}\")
    print(f\"  IRR: {roi['irr']*100:.2f}%\")
    if roi['paybackPeriod']:
        print(f\"  回本期: {roi['paybackPeriod']:.2f} 年\")
    print(f\"  ROI: {roi['roi']*100:.2f}%\")
"
    fi
done
