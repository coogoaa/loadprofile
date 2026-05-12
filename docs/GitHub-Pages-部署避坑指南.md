# GitHub Pages 部署避坑指南

> 记录 2026-05-06 排查 `https://coogoaa.github.io/loadprofile/tools/loadprofile_calculator_de_v2.html` 持续 404 的全过程，避免后续重复踩坑。

## 仓库结构（重要）

本工作区是**双仓库嵌套**结构：

| 层级 | 路径 | 远端 | 用途 |
|---|---|---|---|
| **外层仓库** | `/Users/paulgao/Documents/augment-projects/20260412-V1.12-LoadProfile/` | `coogoaa/loadprofile.git` | 本地工作空间，包含参数、脚本、文档 |
| **内层仓库**（Pages 仓库） | `参考/20260415-LoadProfile 验证/` | `coogoaa/loadprofile.git` | **GitHub Pages 实际发布的仓库** |

**两个仓库 remote 是同一个 URL**（历史遗留），但只有**内层仓库**会被 GitHub Pages 发布。

---

## 核心规则

### ❌ 永远不要做的事

1. **不要在外层仓库执行 `git add .` 后 push 到 origin**
   - git 会把内层仓库识别为 submodule（mode `160000` 的 gitlink）
   - 推送时会把这个 submodule 引用写入内层仓库历史
   - 但没有 `.gitmodules` 配置文件 → **GitHub Pages 构建直接失败**

2. **不要在外层仓库根目录创建 `.nojekyll` / `index.html` 等 Pages 配置文件**
   - Pages 不读外层仓库，放这里没用

### ✅ 正确做法

发布到 GitHub Pages 的所有文件必须在内层仓库里 commit & push：

```bash
cd "参考/20260415-LoadProfile 验证"
git add tools/your-file.html
git commit -m "feat: ..."
git push
```

外层仓库**只在本地用**，不需要 push。

---

## 故障案例：连续 5 次 Pages 构建失败

### 现象

- `https://coogoaa.github.io/loadprofile/tools/loadprofile_calculator_de_v2.html` 返回 404
- 同目录的 `loadprofile_calculator_zh_v3.html` 正常返回 200
- `raw.githubusercontent.com` 上文件确实存在（200）
- 浏览器 Console 没有有用错误（只有 youdao 词典插件噪音）

### 排查路径

1. **检查 Pages 配置**：Settings → Pages 已正确配置 `main` 分支 `/ (root)` → 排除
2. **检查文件是否在仓库**：`git ls-files` 显示文件存在 → 排除
3. **直接访问 raw URL**：`raw.githubusercontent.com/.../de_v2.js` 返回 200 → 文件已推上去
4. **对比 Pages URL**：新文件全部 404，旧文件 200 → **Pages 卡在了旧版本**
5. **查看 Actions 构建日志**：`https://github.com/coogoaa/loadprofile/actions`
   ```
   ❌ pages build and deployment #6~#10 全部失败
   错误信息：
   No url found for submodule path '参考/20260415-LoadProfile 验证' in .gitmodules
   The process '/usr/bin/git' failed with exit code 128
   ```

### 根因

外层仓库某次 `git add .` + `git push` 把内层仓库当成 submodule 提交进了**内层仓库自己**的历史里：

```bash
$ git ls-tree -r HEAD | grep 160000
160000 commit 7915543...  "参考/20260415-LoadProfile 验证"
```

这条 mode `160000`（gitlink）记录指向一个 submodule，但根本没有 `.gitmodules` 文件来描述它的 URL，导致 GitHub Pages 构建器执行 `git submodule init` 时崩溃。

### 修复

在内层仓库执行：

```bash
cd "参考/20260415-LoadProfile 验证"
git rm --cached "参考/20260415-LoadProfile 验证"
git commit -m "fix: remove ghost submodule reference that broke pages build"
git push
```

`--cached` 只移除 git 索引中的引用，不动工作目录里的实际文件。

---

## 快速诊断 checklist

如果将来 Pages 又访问不了，按顺序排查：

### 1. 文件确实推上去了吗？
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://raw.githubusercontent.com/coogoaa/loadprofile/main/<文件路径>"
```
- 200：文件在仓库里
- 404：还没 push，回到内层仓库 push

### 2. Pages 上能访问吗？
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://coogoaa.github.io/loadprofile/<文件路径>"
```

### 3. 如果 raw 200 但 Pages 404 → Pages 构建失败

打开：`https://github.com/coogoaa/loadprofile/actions`

看最近的 `pages build and deployment` 是不是红色 ❌，点进去看具体错误。

### 4. 检查内层仓库有没有幽灵 submodule

```bash
cd "参考/20260415-LoadProfile 验证"
git ls-tree -r HEAD | grep "^160000"
```

如果有输出，说明又混进了 gitlink 引用，按上面"修复"步骤删除。

### 5. 强制触发重新部署
```bash
cd "参考/20260415-LoadProfile 验证"
git commit --allow-empty -m "chore: trigger pages rebuild"
git push
```

---

## 工作流约定

| 任务 | 操作位置 |
|---|---|
| 修改本地参数、脚本、文档 | 外层仓库（不 push） |
| 新增/修改要发布的 HTML/JS/CSS | **内层仓库**（`参考/20260415-LoadProfile 验证/`），commit + push |
| 任何 Pages 相关配置（`.nojekyll`、`_config.yml`、`index.html`） | **内层仓库根目录** |

### 推荐：在内层仓库设一个工作目录别名

在 `~/.zshrc` 加：
```bash
alias cdpages='cd "/Users/paulgao/Documents/augment-projects/20260412-V1.12-LoadProfile/参考/20260415-LoadProfile 验证"'
```

以后发布前 `cdpages` 一下，确保自己在 Pages 仓库里再 commit。

---

## 相关 commit

- `a047386` fix: remove ghost submodule reference that broke pages build
- `4048067` chore: add .nojekyll to serve JS/CSS without Jekyll processing
- `c34be2c` feat: 新增德国负荷计算器 v2 和电话号码校验工具
