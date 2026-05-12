# 电话号码校验（libphonenumber）

针对留资表单 `[ 🇩🇪 +49 ▼ ][ input ]` 的国际电话号码校验方案。重点支持 🇦🇺 **澳大利亚** 与 🇩🇪 **德国**。

## 方案：`libphonenumber-js`

Google 官方 `libphonenumber` 的 JavaScript 移植版，**完全可用于浏览器前端**：

- 体积小（~145KB `max` 构建，含全部国家元数据）
- 支持 **AsYouType** 实时格式化（边输入边加空格/括号）
- 支持 **校验** (`isValidPhoneNumber`)、**可能性检查** (`isPossiblePhoneNumber`)、**号码类型** (手机 / 固话 / 免费号 …)
- 支持从 `+国家码` 自动识别国家

```bash
# 如果接入项目：
npm i libphonenumber-js
```

Demo 采用 CDN ESM 方式，无需构建：
```js
import { AsYouType, parsePhoneNumberFromString } from 'https://esm.sh/libphonenumber-js@1.11.17/max'
```

## 澳洲 / 德国号码规则速查

### 🇦🇺 澳大利亚 `+61`
| 类型 | 国内格式 | 国际格式 | 说明 |
|---|---|---|---|
| 手机 | `04XX XXX XXX`（10 位） | `+61 4XX XXX XXX` | 去掉前导 `0` |
| 固话 | `(0X) XXXX XXXX` | `+61 X XXXX XXXX` | 区号 2/3/7/8 |
| 免费 | `1800 XXX XXX` | — | 不加国家码直拨 |
| 服务 | `13 XX XX` / `1300 XXX XXX` | — | |

**校验要点**：国内号码必须有前导 `0`；转国际格式时去掉 `0`，补 `+61`。

### 🇩🇪 德国 `+49`
| 类型 | 国内格式 | 国际格式 | 说明 |
|---|---|---|---|
| 手机 | `015X / 016X / 017X XXXXXXX`（11 位） | `+49 15X XXXXXXX` | 去掉前导 `0` |
| 固话 | `0XX XXXXXXX`（区号 2–5 位，总 7–11 位不等） | `+49 XX XXXXXXX` | 号码长度可变 |
| 免费 | `0800 XXXXXXX` | — | |

**校验要点**：德国号码总长度可变（尤其固话），**不能只用正则判断长度**，必须用 libphonenumber 的完整元数据校验。

## Demo 功能

打开 `demo/index.html`（直接双击或用任意静态服务器打开）：

- 国家码选择器（带搜索、旗标、区号）
- 输入实时格式化（AsYouType）
- 校验结果：是否有效 / 是否可能 / 号码类型（中文）
- 多格式输出：E.164 / 国际 / 国内 / `tel:` URI
- 粘贴 `+61…` / `+49…` 自动识别并切换国家
- 每个国家附常见示例号码，点击即填

```bash
# 本地预览（任选其一）
open 参考/电话号码校验/demo/index.html
# 或
python3 -m http.server 8080 --directory 参考/电话号码校验
```

## 表单集成建议

1. **国家码必填**：下拉选择器默认 `DE`（或按用户 IP/浏览器语言）。
2. **输入框用 `AsYouType(country).input(value)` 实时格式化**，体验最佳。
3. **提交前校验**：
   ```js
   const phone = parsePhoneNumberFromString(input, country);
   if (!phone || !phone.isValid()) { /* 报错 */ }
   const e164 = phone.number; // 存入后端始终用 E.164
   ```
4. **后端入库统一 E.164 格式**（`+49151…`），展示时再 `formatNational()` / `formatInternational()`。
5. **可选**：若要限制只收手机号，用 `phone.getType() === 'MOBILE'` 过滤（澳洲/德国均能准确识别）。

## 参考

- libphonenumber-js: <https://github.com/catamphetamine/libphonenumber-js>
- Google libphonenumber: <https://github.com/google/libphonenumber>
- E.164 规范: ITU-T E.164
