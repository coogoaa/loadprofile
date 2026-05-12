我 提供一批项目 ID，帮我批量 下载对应的

1. 吧 gis 返回 中 with_pv 为 false 或者 true 的 区分出来。
2. 每个项目 id，把对应的 image_drawed 的图片下载下来
3. 每个项目 id 对应的buildingbox 图片下载下来。地址形式为：
https://file.greensketch.ai/maps/au/sale_agent/image/metromap_latest/image_148.3046274_-36.5065032_buildingbox.jpg
4. 统计下每个房子的面积，面积信息在 gis 返回里面。area信息


还需需要汇总一个表格
项目 ID，面积（area），边框图(image_drawed)，buildingbox图,with_pv,is_old
还要根据项目 ID 关联我提供的 csv 表格的其他信息。
V1.7 测试/CSV/V1.9版本 - 测试环境（官）(临时复制）_副本.csv
需要关联
项目ID	lat_分析	lon_分析		屋顶检测		整体效果		问题分类		面板铺设		电池墙	掩码分割	备注信息	标注人






