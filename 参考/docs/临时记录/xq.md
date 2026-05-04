
对文档的几个疑问
1. 澳洲各州冷暖季定义：
```
3.2 新规则

引入12个月动态占比，受两个因素影响：
1. 季节乘数：冷暖季月份的电量占比被放大
2. 热力额外电量按季节权重分配：供暖季/制冷季月份分配更多热力电量

澳洲各州冷暖季定义：

州
冷季（制冷）
暖季（供暖）
NSW/VIC/SA/WA
Dec–Mar
Jun–Aug
QLD
Oct–Apr（长达7个月）
Jun–Jul
NT
Sep–Apr
—（无供暖）
TAS
Jan–Feb
May–Sep
ACT
Dec–Feb
May–Sep
```
这个表格对应的参数表（参考/docs/presets 目录）是哪一个？跟德国版的参数格式是否是统一的？


2. 月度计算公式，请帮我在详细解释一下，以给小白讲的角度
```
3.3 月度计算公式（完整步骤）

对每个月 m：
① 季节乘数
SeasonalMult[m] = 1
  + IF(系统含AC或热泵 AND m∈冷季, CoolMonthMult - 1, 0)
  + IF(系统含电采暖或热泵 AND m∈暖季, HeatMonthMult - 1, 0)

② 重塑基准电量
ReshapedBase[m] = 基础年电量 × BaseMonthlyShare[m] × SeasonalMult[m]

③ 归一化回基础年电量
NormBase[m] = ReshapedBase[m] / SUM(ReshapedBase[所有月]) × 基础年电量

④ 热力额外分配（按季节权重）
ThermalWeight[m]:
  - Electric heating：IF(m∈暖季, BaseShare[m] × HeatMonthMult, 0)
  - Heat pump：IF(m∈冷季, BaseShare[m] × CoolMonthMult, 0)
              + IF(m∈暖季, BaseShare[m] × HeatMonthMult, 0)
  - AC / No system：0
ThermalAlloc[m] = 热力额外年电量 × ThermalWeight[m] / SUM(ThermalWeight[所有月])

⑤ EV额外均分
EVAlloc[m] = EV额外年电量 / 12

⑥ 最终月电量
FinalKWh[m] = NormBase[m] + ThermalAlloc[m] + EVAlloc[m]
FinalShare[m] = FinalKWh[m] / 最终年电量

```
给详细的示例，一步一步的。

3. 你整体吧各种情况的用户输入 以使用的预设数据，能覆盖到的所有的示例。一步一步的 使用公式和注释说明，给我讲清楚，新出一个完整的文档。不要吝啬 token。
  

