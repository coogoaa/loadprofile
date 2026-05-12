"""
DE V1.13 全部参数常量
─────────────────────────────────────────────────────────────────
来源（请勿就地修改，需更新时同步以下源文件）：
- 参考/德国版 Emily 计算/德国参数/DE_基础参数.md
- 参考/德国版 Emily 计算/德国参数/DE_预设各州年用电量.md
- 参考/德国版 Emily 计算/德国参数/DE_兜底年发电系数.md
- 参考/德国版 Emily 计算/德国参数/DE_月度比例.md
- 参考/德国版 Emily 计算/德国参数/DE_月度发电兜底.md
- 参考/德国版 Emily 计算/德国参数/DE_小时比例.md
- 参考/德国版 Emily 计算/德国参数/DE_小时标记.md
- 参考/德国版 Emily 计算/德国参数/DE_暖通空调热负荷.md
- 参考/德国版 Emily 计算/德国参数/DE_用电强度系数.md
- 参考/德国版 Emily 计算/德国参数/GLOBAL_occupancy_factors.md
- 参考/德国版 Emily 计算/德国参数/GLOBAL_ev_params.md
- 参考/20260415-LoadProfile 验证/tools/de_v3.js
"""

# ────────────────────────────────────────────────
# 16 州：缩写 / 英文 / 中文 / 年用电 kWh / 年发电系数 kWh/kWp
# ────────────────────────────────────────────────
DE_STATES = [
    ('BW', 'Baden-Württemberg',       '巴登-符腾堡',    3210, 1123),
    ('BY', 'Bavaria',                  '拜仁',           3302, 1123),
    ('BE', 'Berlin',                   '柏林',           2469, 1055),
    ('BB', 'Brandenburg',              '勃兰登堡',       3082, 1052),
    ('HB', 'Bremen',                   '不来梅',         2944,  991),
    ('HH', 'Hamburg',                  '汉堡',           2740,  985),
    ('HE', 'Hesse',                    '黑森',           3327, 1079),
    ('NI', 'Lower Saxony',             '下萨克森',       3411, 1017),
    ('MV', 'Mecklenburg-Vorpommern',   '梅克伦堡-前波美', 2856, 1022),
    ('NW', 'North Rhine–Westphalia',   '北威',           3280, 1035),
    ('RP', 'Rhineland-Palatinate',     '莱普',           3321, 1100),
    ('SL', 'Saarland',                 '萨尔',           3321, 1089),
    ('SN', 'Saxony',                   '萨克森',         2845, 1067),
    ('ST', 'Saxony-Anhalt',            '萨安',           3133, 1074),
    ('SH', 'Schleswig-Holstein',       '石荷',           3221,  983),
    ('TH', 'Thuringia',                '图林根',         2994, 1041),
]
BASE  = {r[0]: r[3] for r in DE_STATES}  # 各州年用电基线 kWh
YIELD = {r[0]: r[4] for r in DE_STATES}  # 各州年发电系数 kWh/kWp
STATE_ZH = {r[0]: r[2] for r in DE_STATES}

# ────────────────────────────────────────────────
# 时间分布（DE_月度比例 / DE_月度发电兜底 / DE_小时比例）
# ────────────────────────────────────────────────
DE_MONTHLY     = [0.0789, 0.0791, 0.0773, 0.0822, 0.0839, 0.0876,
                  0.0917, 0.0887, 0.0853, 0.0838, 0.0819, 0.0796]
DE_GEN_MONTHLY = [0.0220, 0.0385, 0.0725, 0.1128, 0.1440, 0.1514,
                  0.1505, 0.1294, 0.0881, 0.0514, 0.0229, 0.0165]
DE_HOURLY      = [0.0301, 0.0258, 0.0239, 0.0232, 0.0236, 0.0252,
                  0.0300, 0.0358, 0.0410, 0.0446, 0.0474, 0.0518,
                  0.0513, 0.0481, 0.0459, 0.0454, 0.0475, 0.0535,
                  0.0587, 0.0591, 0.0556, 0.0508, 0.0451, 0.0366]
DAYS_IN_MONTH  = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_ZH       = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

# DE_月份标记：[idx, is_cool_month, is_heat_month, season]
MONTH_FLAGS = [
    (1,0,1,'Winter'), (2,0,1,'Winter'), (3,0,1,'Spring'), (4,0,1,'Spring'),
    (5,0,0,'Spring'), (6,1,0,'Summer'), (7,1,0,'Summer'), (8,1,0,'Summer'),
    (9,0,0,'Autumn'), (10,0,1,'Autumn'), (11,0,1,'Autumn'), (12,0,1,'Winter'),
]
COOL_M = [r[1] for r in MONTH_FLAGS]
HEAT_M = [r[2] for r in MONTH_FLAGS]

# DE_小时标记：[hour, daytime, evening_peak, morning_peak, day_window, night_window]
HOUR_FLAGS = [
    (0,0,0,0,0,0),(1,0,0,0,0,0),(2,0,0,0,0,0),(3,0,0,0,0,0),
    (4,0,0,0,0,0),(5,0,0,0,0,0),(6,0,0,1,0,0),(7,0,0,1,0,0),
    (8,0,0,1,1,0),(9,1,0,1,1,0),(10,1,0,0,1,0),(11,1,0,0,0,0),
    (12,1,0,0,0,0),(13,1,0,0,0,0),(14,1,1,0,0,0),(15,1,1,0,0,0),
    (16,1,1,0,0,0),(17,1,1,0,0,0),(18,0,1,1,0,1),(19,0,1,1,0,1),
    (20,0,0,1,0,1),(21,0,0,1,0,0),(22,0,0,1,0,0),(23,0,0,0,0,0),
]
DAY_HOURS         = {r[0] for r in HOUR_FLAGS if r[1]}  # 白天
EVE_PEAK_HOURS    = {r[0] for r in HOUR_FLAGS if r[2]}  # 傍晚高峰（用于制冷峰加成）
MORN_PEAK_HOURS   = {r[0] for r in HOUR_FLAGS if r[3]}  # 早晚高峰（用于制热峰加成）

# ────────────────────────────────────────────────
# HVAC / 使用强度 / 在家因子 / EV 充电时段（与 de_v3.js HVAC/UC/OCC/EVP 一致）
# ────────────────────────────────────────────────
HVAC = {
    'no_system':       0,
    'air_con':         0,
    'electric_heat':   3000,
    'heat_pump':       2000,
}
HVAC_ZH = {
    'no_system':     '无冷暖设备',
    'air_con':       '空调',
    'electric_heat': '电暖',
    'heat_pump':     '热泵（冷暖两用）',
}
# de_v3.js 中 CMM/HMM/CPM/HPM 命名约定：
#   am  = 年总量乘子
#   cmm = 制冷月乘子 / hmm = 制热月乘子
#   cpm = 制冷峰小时乘子 / hpm = 制热峰小时乘子
UC = {
    'low':       {'am':0.7, 'cmm':1.05, 'hmm':1.08, 'cpm':1.10, 'hpm':1.08},
    'medium':    {'am':1.0, 'cmm':1.10, 'hmm':1.15, 'cpm':1.20, 'hpm':1.15},
    'high':      {'am':1.3, 'cmm':1.20, 'hmm':1.25, 'cpm':1.35, 'hpm':1.25},
    'very_high': {'am':1.6, 'cmm':1.35, 'hmm':1.40, 'cpm':1.50, 'hpm':1.40},
}
USE_ZH = {'low':'低','medium':'中','high':'高','very_high':'非常高'}

# 在家因子（占空比；白天乘数）— GLOBAL_occupancy_factors.md
OCC = {
    'mostly_away':       0.6,  # 白天大多不在家
    'working_from_home': 1.4,  # 在家办公
    'someone_at_home':   1.2,  # 家中常有人
}
OCC_ZH = {'mostly_away':'白天大多不在家','working_from_home':'在家办公','someone_at_home':'家中常有人'}

EV_KWH_PER_KM = 0.18  # GLOBAL_ev_params.md
# EV 充电时段分布（24h，sum=1）
EV_PROFILE = {
    'mostly_overnight':    [0.125,0.125,0.125,0.125,0.125,0.125,0,0,0,0,0,0, 0,0,0,0,0,0,0,0,0,0,0.125,0.125],
    'mixed_day_and_night': [0.075,0.075,0.075,0.075,0.075,0.075,0,0,0,0,0.067,0.067, 0.067,0.067,0.067,0.067,0,0,0,0,0,0,0.075,0.075],
    'mostly_daytime':      [0,0,0,0,0,0,0,0,0,0,0.167,0.167, 0.167,0.167,0.167,0.167,0,0,0,0,0,0,0,0],
    'solar_optimized':     [0.025,0.025,0.025,0.025,0.025,0.025,0,0,0,0.04,0.072,0.104, 0.128,0.136,0.128,0.104,0.088,0,0,0,0,0,0.025,0.025],
}

# 暖通系统对应的 "冷/热" 启用标志
COOL_SYS = {'air_con', 'heat_pump'}
HEAT_SYS = {'electric_heat', 'heat_pump'}

# Q1 既有 PV 区间 → 代表 kWp（R-H 计算流程.md 步骤 0）
Q1_PV_MAP = {
    'under5':  4,
    '5-10':    7,
    '10-15':   12,
    '15-20':   17,
    '20+':     22,
}

# ────────────────────────────────────────────────
# PV 组件 / 屋顶 / 方案档（DE_基础参数.md）
# ────────────────────────────────────────────────
PANEL_KW       = 0.470            # 单块功率 kWp
PANEL_L_MM     = 1903             # 长 mm
PANEL_W_MM     = 1134             # 宽 mm
PANEL_AREA_M2  = 1.903 * 1.134    # ≈ 2.158 m²
ROOF_TILT_DEG  = 40               # 预设坡度
ROOF_USE_RATIO = 0.45             # 满铺利用率

# 方案档目标 / 触发上调 / 配储率
TIER_TARGET = {
    'A': {'base': 7.05,  'boost': 7.05,  'ratio': 0.7},
    'B': {'base': 10.34, 'boost': 13.16, 'ratio': 0.9},
    'C': {'base': 13.16, 'boost': 15.04, 'ratio': 1.2},
}

# PV 硬上限 / R-H 启用门槛 / 分支 2 反推 existing 封顶（v3）
PV_HARDCAP            = 25.0
REMAIN_MIN_RH         = 2.0
EXISTING_PV_BR2_CAP   = 13.16   # = TIER_TARGET['C']['base']

# ────────────────────────────────────────────────
# 逆变器 / 电池
# ────────────────────────────────────────────────
SCR_TARGET  = 1.30      # 目标容配比 130%
SCR_MAX     = 1.50      # 最大容配比 150%
INV_MAX_KW  = 24        # 三相硬上限（DE_基础参数.md）
INV_SPECS = {
    'A': [5, 6, 8, 10, 12, 15],
    'B': [5, 6, 8, 10, 12, 15],
    'C': [5, 6, 8, 10, 12, 15, 18, 20, 22],
}
BATT_SPECS = [5, 6.5, 9.6, 10, 13.5, 16, 20, 25, 30, 35, 40, 45, 50]
BATT_MIN   = 5
BATT_MAX   = 50
BATT_DOD   = 0.9
BATT_RTE   = 0.95
BATT_EFF   = BATT_DOD * BATT_RTE  # 0.855

# ────────────────────────────────────────────────
# 成本与经济（DE_基础参数.md）
# ────────────────────────────────────────────────
COST_PV_EUR_PER_KWP  = 550
COST_INV_EUR_PER_KW  = 330
COST_BATT_EUR_PER_KWH = 400
GST_RATE             = 0.0       # DE 0%

GRID_BUY_RATE        = 0.35      # EUR/kWh 购电
GRID_SELL_RATE       = 0.07      # EUR/kWh 馈网
DAILY_FIXED_CHARGE   = 0.7       # EUR/day 日固定费
ELEC_INFLATION_RATE  = 0.02      # 2%
CASH_INTEREST_RATE   = 0.035     # 3.5% 现金利率（也作 NPV 折现率）
N_BATTERY_REPLACE    = 0         # 不换电池
DEFAULT_ROI_YEARS    = 20

# ────────────────────────────────────────────────
# 工具函数
# ────────────────────────────────────────────────
def ceil_to_spec(value, specs):
    """向上取整到规格集中的最小可行规格；超出则取最大值。"""
    for s in specs:
        if s >= value:
            return s
    return specs[-1]


def is_trigger(hvac, ev_km):
    """方案档 base→boost 触发条件：EV>0 或 热泵/电暖。"""
    return (ev_km > 0) or (hvac in {'heat_pump', 'electric_heat'})


def q1_to_existing_kwp(q1_value):
    """Q1 区间字符串 → existing_pv kWp；'-'/未知 → -1（走分支2估算）。"""
    if q1_value in (None, '', '-'):
        return -1.0
    if q1_value in Q1_PV_MAP:
        return float(Q1_PV_MAP[q1_value])
    # 兼容直接传数字
    try:
        return float(q1_value)
    except (TypeError, ValueError):
        return -1.0


# 默认值（"跳过"时的兜底）
DEFAULTS = {
    'Q2_hvac':    'no_system',
    'Q3_usage':   'medium',
    'Q4_ev_km':   0,
    'Q5_ev_time': 'mostly_overnight',
    'Q6_occ':     'someone_at_home',  # cases.md 暂不收，预留
}
