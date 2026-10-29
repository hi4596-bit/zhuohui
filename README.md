# Zhuohui Floral — 本地后台 + Git 发布

这是基于现有卓辉 HTML 网站建立的第一版可运行内容管理后台。网站前台仍是静态 HTML/CSS，商品和首页内容统一存放在 JSON 文件中；本地 Python 服务只负责管理文件、图片上传和备份。

## 项目结构

```text
zhuohui-admin-project/
├─ zhuohui-floral-site/          # GitHub Pages 发布目录
│  ├─ index.html
│  ├─ products.html
│  ├─ product-detail.html
│  ├─ flower-walls.html
│  ├─ shop-by-color.html
│  ├─ custom.html / inspiration.html / about.html
│  ├─ site-content.js            # 前台统一 JSON 内容层
│  ├─ data/
│  │  ├─ products.json           # 商品主数据
│  │  ├─ colors.json             # 颜色主题
│  │  └─ homepage.json           # 首页模块设置
│  └─ assets/uploads/             # 后台上传图片
├─ admin-tools/
│  ├─ admin.html                 # 管理界面源文件
│  ├─ admin.js                   # 管理交互
│  └─ admin_server.py            # 本地 API（只监听 127.0.0.1）
├─ .github/workflows/pages.yml   # 自动发布网站目录
├─ .gitattributes                # 强制 .bat 用 CRLF 换行
├─ run-admin.bat                 # 启动后台
└─ git-publish.bat               # Git 提交并推送
```

## Windows 启动方式

1. 解压整个项目文件夹，保持上面的目录结构。
2. 安装 Python 3（无需额外 pip 依赖）。
3. 双击 `run-admin.bat`。
4. 浏览器打开 `http://127.0.0.1:8765/admin`；网站预览地址是 `http://127.0.0.1:8765/`。
5. 商品、颜色、首页模块保存后，会写入 `zhuohui-floral-site/data/*.json`。上传的图片会保存到 `zhuohui-floral-site/assets/uploads/`。
6. 关闭后台时，在命令行窗口按 `Ctrl+C`。

> 如果端口 8765 被占用，请先关闭之前运行的后台服务。服务仅绑定本机回环地址，不要把端口映射到公网。

## GitHub 发布

本项目的 GitHub Actions 工作流只发布 `zhuohui-floral-site/`，本地 Python 服务与后台源文件不会作为网站内容部署。

仓库地址：<https://github.com/hi4596-bit/zhuohui.git>（默认分支 `main`）

### 必须手动完成的唯一设置

GitHub 的 Pages 发布来源只有仓库管理员能改，脚本无法代劳：

1. 打开 <https://github.com/hi4596-bit/zhuohui/settings/pages>
2. 把 **Build and deployment → Source** 从 **Deploy from a branch** 改为 **GitHub Actions**
3. 保存后会重新触发一次部署，约 1-2 分钟后生效

> **为什么要改**：如果保持 "Deploy from a branch"（`main` / `/ (root)`），GitHub 会用 Jekyll 把仓库根目录当网站发布，结果是 README 被渲染成首页、`data/*.json` 和图片返回 404。改成 **GitHub Actions** 后，网站根目录就是 `zhuohui-floral-site/`，访问地址 `https://hi4596-bit.github.io/zhuohui/` 才是真实前台。
>
> ⚠️ **在改成 GitHub Actions 之前，`admin-tools/admin.html` 会被公开访问**（当前已验证 `https://hi4596-bit.github.io/zhuohui/admin-tools/admin.html` 返回 200）。该页面只是界面外壳、不含数据，但后台源文件不应出现在公网。切换为 GitHub Actions 后，只有 `zhuohui-floral-site/` 会被发布，这个问题自动消失。

### 日常发布流程

1. 双击 `run-admin.bat` 打开后台，改内容并保存（写入 `zhuohui-floral-site/data/*.json`）。
2. 双击 `git-publish.bat`，输入提交说明。脚本会 `git add -A`、`git commit`、`git push`。
3. 在 <https://github.com/hi4596-bit/zhuohui/actions> 查看部署状态。
4. 成功后刷新 `https://hi4596-bit.github.io/zhuohui/`。

### 换一台电脑同步

```bat
git clone https://github.com/hi4596-bit/zhuohui.git
```

克隆后双击 `run-admin.bat` 即可继续使用（只需装 Python 3）。

### 已修复的环境问题：.bat 换行符

原始压缩包里的 `run-admin.bat` / `git-publish.bat` 是 **LF（Unix）换行**，而 Windows `cmd.exe` 只认 **CRLF**，所以双击会一闪而过或报 "不是内部或外部命令"。

现已改为 CRLF，并新增 `.gitattributes` 强制 `*.bat text eol=crlf`，以后从仓库重新克隆也不会再坏。

## 数据结构概要

### products.json

每个商品包含 `id`、`name`、`description`、`image`、`category`、`colors`、`price`、`compareAt`、`status`、`featured`、`sortOrder`、`detailPage` 和 `tags`。`image` 使用相对路径，例如 `assets/img-01-06abd7b81a6a.webp`。

### colors.json

每个颜色主题包含 `id`、`name`、`season`、`description`、`heroImage`、`cardImage`、`swatches`、`tagline`、`active` 和 `sortOrder`。

### homepage.json

保存公告栏文案、网站名称和首页模块配置。模块包含 `id`、`title`、`subtitle`、`bannerImage`、`visible`、`sortOrder`、`type` 和 `productCategory`。

## 功能范围与限制

- 已实现：商品增删改、搜索/分类/状态筛选、复制商品、颜色主题编辑、首页模块标题/说明/Banner/显示状态/排序、图片上传、CSV/JSON 导出、JSON 自动备份、完整数据/上传图片备份 ZIP。
- 前台已接入统一数据层：首页商品卡片、Shop by Color 主题与商品、Flower Walls 目录及商品详情链接会读取 JSON。
- 首页推荐卡片由 `featured: true` 控制；隐藏商品由 `status: "hidden"` 控制。颜色主题由 `active: false` 停用。
- 价格可以留空，留空时展示询盘文案；不要把内部成本写入公开 JSON。
- 目前不是带账号的线上 CMS。管理 API 仅在本机使用；发布后访客只能访问静态网站。
- 商品详情页原有的规格/图库结构仍保留，第一版数据层仅同步标题、主图和简介。复杂规格、多图图库的可视化编辑可作为下一阶段。
- GitHub Pages 只发布静态文件，不能运行这个 Python 管理服务。

## 测试清单

1. 双击 `run-admin.bat`，确认后台和网站预览均能打开。
2. 新增一条测试商品，保存后检查 `zhuohui-floral-site/data/products.json` 是否出现对应 ID。
3. 将商品分类设为 Flower Walls，勾选首页推荐，确认首页出现该商品。
4. 上传一张 JPG/WebP，确认文件出现在 `assets/uploads/` 且后台返回相对路径。
5. 修改颜色主题名称或色卡，保存后刷新 Shop by Color 页面检查结果。
6. 修改首页模块标题或显示状态，保存后刷新首页检查。
7. 下载备份 ZIP，确认内含 JSON 数据和上传图片。
8. 配置 Git 远程仓库后执行发布脚本，在 GitHub Actions 检查 Pages 部署结果。

## 回滚

后台每次保存 JSON 时会在 `admin-tools/backups/` 生成带时间戳的 `.json.bak` 文件；此外建议定期提交 Git。`admin-tools/backups/` 已加入 `.gitignore`，避免自动把本地备份推到公开仓库。
