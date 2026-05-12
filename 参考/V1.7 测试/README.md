# V1.7 测试 - 系统组成与投资回报计算

## 概述

本目录包含V1.7版本的测试工具，用于：
1. 下载测试数据
2. 计算系统组成（基于方案B的目标容量规则）
3. 计算投资回报（IRR、回本期等财务指标）

## 目录结构

```
V1.7 测试/
├── 脚本/
│   ├── download_data.py          # 数据下载工具
│   ├── system_composition.py     # 系统组成计算
│   └── roi_calculation.py        # 投资回报计算
├── 变量获取/
│   ├── 相关变量数据.md           # 数据源说明
│   └── 解析结果/                 # 数据解析示例
├── 计算步骤/
│   ├── 系统组成计算.md           # 计算逻辑说明
│   └── 投资回报计算.md           # ROI计算说明
└── README.md                     # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
pip install requests
```

### 2. 下载测试数据

```bash
cd 脚本

# 下载单个案例
python3 download_data.py 5421 --output-dir ../data

# 下载多个案例
python3 download_data.py 5094 5421 --output-dir ../data
```

下载的数据包括：
- `request.json` - 计算请求参数
- `panel_location.json` - 面板位置和发电量数据
- `detect_building.json` - GIS楼宇检测结果
- `maxValue_panel_location.json` - 最大价值方案面板位置
- `mostPopular_panel_location.json` - 最受欢迎方案面板位置
- `customFit_panel_location.json` - 定制方案面板位置
- `*_cashflow.json` - 各方案的现金流数据

### 3. 计算系统组成

```bash
# 处理所有案例
python3 system_composition.py --data-dir ../data --output-dir ../output

# 处理指定案例
python3 system_composition.py --data-dir ../data --output-dir ../output --case-ids 5421
```

**方案B的目标容量规则**：
- 若屋顶初始 PV 容量 > 15kW，目标设为 **13.2kW**
- 若屋顶初始 PV 容量 ≤ 15kW，目标设为 **10.12kW**

输出文件：`output/{case_id}/system_composition.json`

### 4. 计算投资回报

```bash
# 使用默认参数
python3 roi_calculation.py --data-dir ../output --output-dir ../output

# 使用自定义配置
python3 roi_calculation.py --data-dir ../output --output-dir ../output --config financial_config.json
```

输出文件：`output/{case_id}/roi_calculation.json`

## 配置文件

### 财务参数配置 (financial_config.json)

创建一个JSON文件来自定义财务参数：

```json
{
  "buyPricePerKwh": 0.35,
  "feedInTariffPerKwh": 0.08,
  "dailyFixedFee": 1.0,
  "priceInflationRate": 0.03,
  "panelDegradationYear1": 0.02,
  "panelDegradationAfterYear1": 0.005,
  "selfConsumptionRate": 0.4,
  "batteryCapacityKwh": 0.0,
  "costPerKw": 1500.0,
  "batteryCostPerKwh": 1000.0,
  "subsidyPerKw": 1000.0,
  "years": 20
}
```

**参数说明**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `buyPricePerKwh` | 零售电价 ($/kWh) | 0.35 |
| `feedInTariffPerKwh` | 上网电价 ($/kWh) | 0.08 |
| `dailyFixedFee` | 每日固定费用 ($) | 1.0 |
| `priceInflationRate` | 电价年增长率 | 0.03 (3%) |
| `panelDegradationYear1` | 第一年面板衰减率 | 0.02 (2%) |
| `panelDegradationAfterYear1` | 后续年份衰减率 | 0.005 (0.5%) |
| `selfConsumptionRate` | 自用比例 | 0.4 (40%) |
| `batteryCapacityKwh` | 电池容量 (kWh) | 0.0 |
| `costPerKw` | 每kW系统成本 ($) | 1500.0 |
| `batteryCostPerKwh` | 每kWh电池成本 ($) | 1000.0 |
| `subsidyPerKw` | 每kW补贴 ($) | 1000.0 |
| `years` | 计算年限 | 20 |

## 输出文件说明

### system_composition.json

系统组成计算结果：

```json
{
  "projectInfo": {
    "id": 5421,
    "address": "...",
    "state": "VIC",
    ...
  },
  "buildingInfo": {
    "area": 128.14,
    "mapType": "metromap_latest"
  },
  "systemComposition": {
    "initialPanelCount": 25,
    "initialCapacityKw": 11.25,
    "targetCapacityKw": 10.12,
    "selectedPanelCount": 22,
    "actualCapacityKw": 9.9,
    "totalAnnualGenerationKwh": 12143.5,
    "capacityUtilization": 0.88
  },
  "selectedPanels": [...]
}
```

### roi_calculation.json

投资回报计算结果：

```json
{
  "projectInfo": {...},
  "systemComposition": {...},
  "roiMetrics": {
    "upfrontInvestment": 14850.0,
    "subsidy": 9900.0,
    "netInvestment": 4950.0,
    "annualBillSavings": 1700.23,
    "totalSavings": 34004.6,
    "irr": 0.3425,
    "paybackPeriod": 2.91,
    "roi": 5.87,
    "npv": 18234.5,
    "years": 20,
    "cashflows": [-4950.0, 1700.23, ...],
    "annualSavings": [1700.23, 1749.24, ...]
  }
}
```

## 完整工作流程示例

```bash
# 1. 进入脚本目录
cd "/Users/paulgao/Documents/augment-projects/V1.5 测试 v2/V1.7 测试/脚本"

# 2. 下载案例数据
python3 download_data.py 5421 --output-dir ../data

# 3. 计算系统组成
python3 system_composition.py --data-dir ../data --output-dir ../output

# 4. 计算投资回报
python3 roi_calculation.py --data-dir ../output --output-dir ../output

# 5. 查看结果
cat ../output/5421/system_composition.json | python3 -m json.tool
cat ../output/5421/roi_calculation.json | python3 -m json.tool
```

## 与 roi_verify.py 的关系

本工具集复用了 `roi_verify.py` 的核心逻辑：

### 相同部分
- IRR计算算法
- 回本期计算方法
- 面板衰减模型
- 电价上涨模型
- 自用率模拟逻辑

### 不同部分
- **目标容量规则**：实现了方案B的特定规则（15kW阈值）
- **数据源**：从远程API下载数据，而非本地文件
- **简化模型**：使用简化的自用率模型，而非完整的小时级模拟
- **独立脚本**：分离为下载、系统组成、ROI三个独立步骤

## 数据来源

所有数据来自以下API端点：

```
https://file.greensketch.ai/marketing/test/debug/{case_id}/{filename}
```

详见 `变量获取/相关变量数据.md`

## 计算逻辑

### 系统组成计算

1. **读取面板数据**：从 `panel_location.json` 读取所有面板的位置和发电量
2. **计算初始容量**：面板数量 × 单块功率 (0.45kW)
3. **确定目标容量**：根据方案B规则选择 13.2kW 或 10.12kW
4. **选择面板**：按发电量排序，选择前N块面板达到目标容量
5. **输出结果**：保存选中的面板列表和系统参数

### 投资回报计算

1. **估算成本**：系统容量 × 单位成本 + 电池成本
2. **估算补贴**：系统容量 × 单位补贴
3. **模拟年度节省**：
   - 考虑面板衰减
   - 考虑电价上涨
   - 计算自用和上网收益
4. **计算财务指标**：
   - IRR：使用二分法求解
   - 回本期：累计现金流首次为正的时间
   - ROI：总收益 / 净投资
   - NPV：使用5%折现率

## 验证和测试

### 验证步骤

1. **数据完整性**：检查下载的文件是否完整
2. **容量规则**：验证目标容量是否符合方案B规则
3. **面板选择**：确认选中的面板是发电量最高的
4. **财务计算**：对比计算结果与预期值

### 测试案例

推荐使用以下案例进行测试：

- **5421**：VIC州，25块面板，初始容量11.25kW（应选10.12kW）
- **5094**：待补充

## 故障排除

### 问题1：下载失败

**检查网络连接**：
```bash
curl https://file.greensketch.ai/marketing/test/debug/5421/request.json
```

**检查案例ID**：确认案例ID是否正确

### 问题2：计算结果异常

**检查数据文件**：
```bash
python3 -m json.tool ../data/5421/panel_location.json
```

**检查参数配置**：确认财务参数是否合理

### 问题3：缺少依赖

```bash
pip install requests
```

## 后续工作

- [ ] 添加更多测试案例
- [ ] 实现完整的小时级自用率模拟
- [ ] 支持不同州的补贴政策
- [ ] 添加电池优化计算
- [ ] 生成详细的验证报告

## 参考文档

- [系统组成计算说明](./计算步骤/系统组成计算.md)
- [投资回报计算说明](./计算步骤/投资回报计算.md)
- [数据源说明](./变量获取/相关变量数据.md)
- [Request数据解析](./变量获取/解析结果/1_request_解析.md)
- [Panel Location数据解析](./变量获取/解析结果/2_panel_location_解析.md)

---

**版本**: 1.0  
**更新日期**: 2024-01  
**维护**: V1.7测试团队
