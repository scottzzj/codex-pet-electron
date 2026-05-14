# Codex Pet Electron

`Codex Pet Electron` 是一个独立运行的 Windows 桌宠项目，目标是在不依赖官方 Codex 客户端的前提下，尽量还原 Codex Pet 的主界面体验，并在此基础上补充本地专注计时能力。

项目当前同时提供两种使用方式：

- 桌面应用：基于 Electron 运行，适合本机长期使用
- 静态预览：基于 `docs/` 提供 GitHub Pages 预览，适合给别人直接看效果

## 项目特点

- 透明、无边框、可拖动的宠物主窗口
- 活动托盘展开 / 收起
- 右键菜单
- 专注计时与独立详情浮窗
- 支持本地保存宠物形象，并兼容读取本机 Codex 自定义宠物
- 提供 `docs/` 静态预览页面，可直接发布到 GitHub Pages

## 当前功能

### 主窗口

- 透明无边框悬浮窗
- 默认置顶
- 支持鼠标拖动
- 支持悬停状态动画
- 支持本地宠物形象切换与记忆
- 兼容读取 Codex 当前选中的自定义宠物贴图

### 活动面板

- 点击徽标展开 / 收起
- 显示活动数量徽标
- 支持滚动
- 支持“回到最新”按钮逻辑
- 根据状态切换徽标和状态标签样式

### 右键菜单

- 切换形象
- 导入形象包
- 开始专注
- 5 / 10 / 30 / 45 / 60 分钟快捷时长
- 专注详情
- 打开动态 / 收起动态
- 关闭宠物

### 宠物形象管理

- 没有安装 Codex 也可以直接运行
- 应用内置默认宠物
- 可通过右键 `切换形象` 查看可用形象
- 可通过右键 `切换形象 -> 导入 ZIP 形象包` 直接导入下载好的宠物压缩包
- 当前选中的宠物会保存到本地配置，下次启动自动恢复

### 专注计时

- 右键选择时长后立即开始
- 开始后自动弹出专注详情窗
- 支持暂停、继续、结束
- 支持暂停次数限制
- 专注结束后播放提示音

### 专注详情浮窗

- 独立透明窗口
- 支持拖动
- 显示倒计时
- 支持暂停 / 继续 / 结束 / 关闭

## 静态预览

项目包含一套可直接发布到 GitHub Pages 的静态预览页面：

- 入口文件：[docs/index.html](./docs/index.html)
- 预览资源目录：[docs/preview](./docs/preview)

这套静态预览的目标是：

- 页面结构尽量接近真实主页面
- 不依赖 Electron
- 不依赖本机 `.codex` 环境
- 不需要运行桌面程序

当前静态预览内置了一份可直接展示的宠物资源：

- [docs/preview/codex-puppy.webp](./docs/preview/codex-puppy.webp)

### 本地预览静态页

本地查看 `docs/` 时，不建议直接双击 `index.html`，应使用本地静态服务。

例如：

```powershell
python -m http.server 4174 --directory docs
```

然后打开：

```text
http://127.0.0.1:4174/
```

### 发布到 GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 打开仓库 `Settings`
3. 进入 `Pages`
4. 选择 `Deploy from a branch`
5. 选择 `main` 分支
6. 选择 `/docs` 目录
7. 保存

发布后访问：

```text
https://<你的用户名>.github.io/<仓库名>/
```

## 项目结构

```text
codex-pet-electron/
├─ assets/
│  ├─ codex-spritesheet.webp
│  └─ sounds/
├─ docs/
│  ├─ index.html
│  └─ preview/
│     ├─ app-static.js
│     ├─ pet-bridge-static.js
│     ├─ styles.css
│     ├─ preview.css
│     ├─ codex-puppy.webp
│     └─ ...
├─ dist/
├─ scripts/
├─ src/
│  ├─ main.js
│  ├─ preload.js
│  └─ renderer/
│     ├─ index.html
│     ├─ styles.css
│     ├─ app.js
│     ├─ constants.js
│     ├─ state.js
│     ├─ animation.js
│     ├─ activities.js
│     ├─ focus.js
│     ├─ menu.js
│     ├─ interactions.js
│     ├─ focus-detail.html
│     ├─ focus-detail.css
│     └─ focus-detail.js
├─ package.json
└─ README.md
```

## 运行环境

- Windows
- Node.js
- Electron 31

## 安装依赖

```powershell
npm.cmd install
```

## 本地启动桌宠

```powershell
npm.cmd start
```

## 打包

生成目录版应用：

```powershell
npm.cmd run package
```

生成目录压缩包：

```powershell
npm.cmd run package:zip
```

当前打包命令来自 [package.json](./package.json)：

```powershell
electron-packager . CodexPetReplica --platform=win32 --arch=x64 --out=dist --overwrite --prune=true
```

默认输出目录：

```text
dist/CodexPetReplica-win32-x64/
```

默认压缩包：

```text
dist/CodexPetReplica-win32-x64.zip
```

## 数据来源

### 本地配置

应用会把自己的配置写入：

```text
%APPDATA%\codex-pet-electron\pet-settings.json
```

其中包括：

- 当前选择的宠物形象 `selectedPetKey`
- 自定义提示音路径 `customFocusSoundPath`

导入的本地宠物目录会保存到：

```text
%APPDATA%\codex-pet-electron\pets\
```

### Codex 全局状态

项目会尝试读取：

```text
%USERPROFILE%\.codex\.codex-global-state.json
```

用于兼容恢复：

- 宠物窗口位置
- 动态面板开关状态
- 当前选中的 Codex 自定义宠物

### 宠物资源来源

优先级如下：

1. 应用本地已保存的 `selectedPetKey`
2. 本机 Codex 当前选中的自定义宠物
3. 应用内置默认宠物

### 自定义宠物资源

如果本机 Codex 当前选中了自定义宠物，项目会读取：

```text
%USERPROFILE%\.codex\pets\<pet-id>\
```

读取失败时，会回退到项目内置资源：

- [assets/codex-spritesheet.webp](./assets/codex-spritesheet.webp)

### 提示音

默认提示音资源目录：

```text
assets/sounds/
```

如果没有可用提示音文件，则使用浏览器 `AudioContext` 生成简单提示音兜底。

## 已知限制

### 主窗口拖动仍然是高敏感区域

透明窗口下的拖动体验仍然受 Electron、Windows 和渲染帧率影响，这部分后续还可以继续优化。

### 当前主要面向 Windows

透明窗口、桌宠行为和打包流程目前都按 Windows 优先设计。

### 静态预览不是完整桌面能力

`docs/` 预览页只能还原页面视觉和部分交互，不能还原：

- 透明桌面悬浮行为
- 原生右键菜单
- Electron 独立窗口能力
- 系统级置顶与拖动行为

### 当前没有安装器和自动更新

项目目前提供的是 Electron 打包目录和压缩包，没有安装器、自动更新和日志上报体系。

## 仓库地址

- [https://github.com/scottzzj/codex-pet-electron](https://github.com/scottzzj/codex-pet-electron)
