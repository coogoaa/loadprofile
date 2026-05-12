## 计算请求参数存储
路径模版：debug/%s/request.json
示例：

https://file.greensketch.ai/marketing/test/debug/5421/request.json

## preHandler 处理后面板位置（排序 / 过滤）
路径模板：debug/%s/panel_location.json
https://file.greensketch.ai/marketing/test/debug/5421/panel_location.json

## 计算完成后最终面板位置
路径模板：debug/%s/%s_panel_location.json
https://file.greensketch.ai/marketing/test/debug/5094/[后缀]_panel_location.json（注：第二个 % s 为自定义后缀，如 maxValue、mostPopular、customFit）

https://file.greensketch.ai/marketing/test/debug/5421/maxValue_panel_location.json
https://file.greensketch.ai/marketing/test/debug/5421/mostPopular_panel_location.json
https://file.greensketch.ai/marketing/test/debug/5421/customFit_panel_location.json

## 计算的现金流结果
路径模板：debug/%s/%s_cashflow.json
https://file.greensketch.ai/marketing/test/debug/5421/maxValue_cashflow.json
https://file.greensketch.ai/marketing/test/debug/5421/mostPopular_cashflow.json
https://file.greensketch.ai/marketing/test/debug/5421/customFit_cashflow.json

## GIS 楼宇检测结果
路径模板：debug/%s/detect_building.json
https://file.greensketch.ai/marketing/test/debug/5094/detect_building.json