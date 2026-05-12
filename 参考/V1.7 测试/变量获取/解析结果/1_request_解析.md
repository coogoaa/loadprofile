# Request.json 数据解析

## 数据来源
- URL: https://file.greensketch.ai/marketing/test/debug/5421/request.json
- 用途: 计算请求参数存储

## 数据结构概览

### 1. panelLocations (面板位置数组)
包含 25 个面板位置信息，每个位置包含：

#### 字段说明
- **positions**: `[x, y, z]` 三维坐标数组
  - x: 东西方向坐标
  - y: 南北方向坐标  
  - z: 高度坐标
  
- **aspect**: 方位角（度）
  - 表示面板朝向，0° 为正北，顺时针增加
  - 示例值: 7.12°, 184.89°, 275.35°
  
- **slope**: 倾斜角（弧度）
  - 表示面板与水平面的夹角
  - 示例值: 0.39 - 0.44 弧度（约 22° - 25°）
  
- **positionIndexList**: 位置索引数组
  - **roofId**: 屋顶编号（字符串："0", "1", "2", "3"）
  - **x**: 在该屋顶上的 x 索引
  - **y**: 在该屋顶上的 y 索引（0 或 1，表示行数）

### 2. project (项目信息)

#### 基本信息
- **id**: 5421
- **projectCode**: "7ef6df1c-6631-48da-a417-eb91aca60a28"
- **type**: 1（项目类型）
- **installerCode**: "gscode"

#### 地址信息
- **address**: "29 Red Hill Rd, Springvale VIC 3171, Australia"
- **analysisAddress**: "29 Red Hill Rd, Springvale VIC 3171, Australia"
- **siteStreet**: "29 Red Hill Road"
- **city**: "Springvale"
- **state/siteRegion**: "VIC"
- **siteZip**: "3171"
- **countryCode**: "AU"
- **siteCountry**: "Australia"

#### 地理坐标
- **longitude/longitudeStr**: 145.1486042
- **latitude/latitudeStr**: -37.9608336

#### 地图信息
- **mapType**: "metromap_latest"
- **gisMapType**: "metromap_latest"
- **mapLink**: "https://gs-api.onesimpleway.com/marketing/client/gis/agent/google_map?center_lon=145.1486042&center_lat=-37.9608336"

#### rowLayout
包含完整的面板布局信息（JSON 字符串格式），与 panelLocations 数组内容一致

## 屋顶分布统计

### Roof 0
- 面板数量: 5 个
- 方位角: 7.12°（接近正北）
- 位置索引: x=5-9, y=0
- 高度: 约 1.5m

### Roof 1  
- 面板数量: 11 个
- 方位角: 184.89°（接近正南）
- 位置索引: x=4-9, y=0-1（两行）
- 高度: 8.4m - 10.5m

### Roof 2
- 面板数量: 5 个
- 方位角: 275.35°（接近正西）
- 位置索引: x=2-5, y=0-1（两行）
- 高度: 8.0m - 10.1m

### Roof 3
- 面板数量: 4 个
- 方位角: 184.89°（接近正南）
- 位置索引: x=1-4, y=0
- 高度: 约 3.7m
- 特点: 倾斜角很小（0.01-0.02 弧度，约 0.6°-1.2°），接近平面

## 关键观察

1. **多屋顶布局**: 项目包含 4 个不同的屋顶区域
2. **方位多样性**: 包含北向、南向、西向三个主要朝向
3. **高度分层**: 面板分布在 1.5m - 10.5m 的不同高度
4. **Roof 3 特殊性**: 几乎平坦的屋顶，可能是平台或特殊结构
5. **总面板数**: 25 块面板

## 数据用途
此数据作为计算引擎的输入参数，包含：
- 初始面板位置信息
- 项目地理和地址信息
- 用于后续的发电量计算、遮挡分析、优化布局等
