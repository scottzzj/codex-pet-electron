# Codex Pet Electron

`Codex Pet Electron` 是一个独立运行的 Windows 桌宠项目，目标是复刻并扩展 Codex Pet 的悬浮宠物体验。项目基于 Electron 构建，提供可拖动的宠物主窗、活动面板、右键菜单、专注计时和独立的专注详情浮窗。

## 项目概述

这个项目的核心目标有四个：

- 提供一个脱离 Codex 官方客户端、可单独运行的桌宠程序
- 尽量贴近 Codex Pet 的悬浮形态、活动面板和状态反馈
- 在原始桌宠体验上增加本地专注计时能力
- 保持代码结构清晰，便于后续继续迭代动画、交互和桌面行为

当前项目已经完成从“大单文件原型”到“按职责拆分模块”的重构，适合继续扩展。

## 项目效果
<img width="203" height="229" alt="image" src="https://github.com/user-attachments/assets/aa8ee559-b1eb-4e27-8604-6205ea67cef1" />
<img width="853" height="450" alt="image" src="https://github.com/user-attachments/assets/97597418-f5d7-45da-b234-bf22114d80ea" />

## 当前功能

### 桌宠主窗

- 透明无边框悬浮窗口
- 默认常驻最前
- 支持拖动
- 支持悬停状态动画
- 支持读取 Codex 当前选中的自定义宠物贴图

### 活动面板

- 点击徽标可展开/收起
- 显示当前会话活动和专注活动
- 支持滚动
- 支持“返回最新”按钮逻辑
- 根据活动状态显示不同徽标颜色和状态文案

### 右键菜单

- 开始专注
- 5 / 10 / 30 / 45 / 60 分钟快捷时长
- 专注详情
- 收起动态 / 打开动态
- 关闭宠物

### 专注计时

- 右键选择时长后自动开始
- 选完时长后自动弹出专注详情窗
- 支持暂停、继续、结束
- 支持暂停次数限制
- 专注结束后优先播放 TickTick 提示音
- 如果本机没有 TickTick 音频，则使用内置蜂鸣兜底

### 专注详情浮窗

- 独立无边框透明窗口
- 支持拖动
- 自动停靠在宠物附近
- 支持关闭、暂停、继续、结束

## 项目结构

```text
codex-pet-electron/
├─ assets/
│  └─ codex-spritesheet.webp
├─ dist/
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

## 架构说明

### 主进程

主进程入口文件：

- [src/main.js](./src/main.js)

主进程职责：

- 创建宠物主窗
- 创建和管理专注详情浮窗
- 控制窗口尺寸、位置和置顶状态
- 构建 Electron 原生右键菜单
- 处理渲染层发起的 IPC 调用
- 处理单实例逻辑
- 负责 Windows 侧原生拖动相关实验逻辑
- 处理窗口位置钳制，避免宠物跑出屏幕

### 预加载层

预加载文件：

- [src/preload.js](./src/preload.js)

预加载层职责：

- 向渲染层暴露 `window.petBridge`
- 封装 IPC 调用
- 读取 Codex 全局状态
- 读取当前选中的自定义宠物
- 读取 TickTick 提示音文件

### 渲染层

渲染层目录：

- [src/renderer](./src/renderer)

当前已经按功能拆分为多个模块：

#### 启动与编排

- [src/renderer/app.js](./src/renderer/app.js)

职责：

- 初始化各模块
- 组装共享状态
- 触发首次渲染
- 恢复面板状态、窗口位置、自定义宠物和音频资源

#### 常量配置

- [src/renderer/constants.js](./src/renderer/constants.js)

职责：

- 精灵图行列配置
- 动画帧定义
- 拖动阈值
- 状态文案
- 活动优先级和过期时间
- 专注时长预设

#### 状态与 DOM 引用

- [src/renderer/state.js](./src/renderer/state.js)

职责：

- 收集页面元素引用
- 创建全局 `petState`
- 管理拖拽、悬停、活动列表、专注状态、窗口位置等共享状态

#### 动画模块

- [src/renderer/animation.js](./src/renderer/animation.js)

职责：

- 根据状态构建帧动画
- 控制 sprite sheet 背景位置
- 支持 idle / running-left / running-right / waving / jumping 等状态动画

#### 活动面板模块

- [src/renderer/activities.js](./src/renderer/activities.js)

职责：

- 归一化状态优先级
- 过滤过期活动
- 排序活动列表
- 渲染托盘内容
- 处理 latest bar 与滚动联动

#### 专注模块

- [src/renderer/focus.js](./src/renderer/focus.js)

职责：

- 管理专注计时状态机
- 开始 / 暂停 / 继续 / 停止 / 完成
- 生成专注 activity
- 生成详情窗状态 payload
- 执行倒计时刷新
- 专注完成后播放提示音

#### 右键菜单模块

- [src/renderer/menu.js](./src/renderer/menu.js)

职责：

- 构建右键菜单项
- 根据专注状态切换菜单内容
- 分发菜单点击动作

#### 交互模块

- [src/renderer/interactions.js](./src/renderer/interactions.js)

职责：

- 处理左键拖动
- 处理右键菜单
- 处理悬停动画
- 处理托盘滚动同步
- 处理 badge 点击开关面板
- 负责 native drag 与 JS drag 的衔接

#### 专注详情浮窗

- [src/renderer/focus-detail.html](./src/renderer/focus-detail.html)
- [src/renderer/focus-detail.css](./src/renderer/focus-detail.css)
- [src/renderer/focus-detail.js](./src/renderer/focus-detail.js)

职责：

- 渲染专注详情卡片
- 展示标题、倒计时和动作按钮
- 支持暂停 / 继续 / 结束 / 关闭
- 支持拖动整个详情浮窗

## 数据来源与本地依赖

### Codex 全局状态

项目会读取下面的本地文件：

```text
%USERPROFILE%\.codex\.codex-global-state.json
```

用途包括：

- 恢复宠物主窗位置
- 恢复活动面板开关状态
- 读取当前选中的自定义宠物

### 自定义宠物资源

如果当前 Codex 选中了自定义宠物，会读取：

```text
%USERPROFILE%\.codex\pets\<pet-id>\
```

如果读取失败，则回退到项目内置贴图：

- [assets/codex-spritesheet.webp](./assets/codex-spritesheet.webp)

### TickTick 提示音

项目会优先读取用户手动选择的提示音文件。

如果没有手动选择，则会继续读取项目内置默认提示音目录：

```text
assets/sounds/
```

支持的默认文件名包括：

- `focus-default.wav`
- `focus-default.mp3`
- `focus-default.ogg`
- `focus-default.m4a`

如果没有可用音频文件，则使用浏览器 AudioContext 生成简单提示音兜底。

## 运行环境

项目当前主要面向：

- Windows
- Electron 31
- Node.js

其中桌宠拖动体验、透明窗口和原生行为主要围绕 Windows 做了处理。

## 安装依赖

```powershell
npm.cmd install
```

## 本地启动

```powershell
npm.cmd start
```

## 打包

```powershell
npm.cmd run package
```

如果你要发布给别人使用，推荐直接生成文件夹压缩包：

```powershell
npm.cmd run package:zip
```

`package.json` 中当前打包命令如下：

```powershell
electron-packager . CodexPetReplica --platform=win32 --arch=x64 --out=dist --overwrite --prune=true
```

打包后可执行文件默认位于：

```text
dist/CodexPetReplica-win32-x64/CodexPetReplica.exe
```

打包后的压缩包默认位于：

```text
dist/CodexPetReplica-win32-x64.zip
```

## Git 与发布

当前 GitHub 仓库：

- [https://github.com/scottzzj/codex-pet-electron](https://github.com/scottzzj/codex-pet-electron)

推荐发布流程：

1. 更新 [package.json](./package.json) 中的版本号
2. 本地验证主窗、右键菜单、专注详情和打包结果
3. 执行打包
4. 提交代码并推送
5. 创建对应 tag
6. 创建 GitHub Release
7. 优先上传 `CodexPetReplica-win32-x64.zip` 压缩包

## 当前已知限制

### 1. 主窗拖动仍然是高风险区域

当前项目为了逼近原始 Codex Pet 的体验，在透明窗口下尝试了原生拖动和 JS 拖动兜底。  
这部分依然是项目最敏感的交互区域，后续还需要继续验证和打磨。

### 2. 主要面向 Windows

当前的透明窗口、桌宠行为和打包流程基本都围绕 Windows 设计。  
如果后续要支持 macOS 或 Linux，需要单独做平台适配。

### 3. 仍有部分中英混用文案

虽然右键菜单和专注详情已经逐步汉化，但活动面板和部分状态文案仍然存在英文残留，后续可以继续统一。

### 4. 依赖本地 Codex 与 TickTick 环境

如果本机没有 `.codex` 状态目录或没有 TickTick 音频文件，部分能力会降级为默认行为或兜底逻辑。

### 5. 当前没有安装器和自动更新

项目目前只提供 Electron 打包目录和 `.exe`，没有安装器、自动更新、日志系统和错误上报体系。

## 后续优化方向

- 继续优化桌宠主窗拖动体验
- 统一所有界面中文文案
- 提升主窗和详情窗的动画还原度
- 增加设置项，例如：
  - 是否启用自定义宠物
  - 是否启用提示音
  - 是否总在最前
  - 默认专注时长
- 增加变更日志与版本说明

## 开发建议

如果后续继续扩展这个项目，建议优先遵守两条：

- 主进程只处理窗口和 IPC，不把业务状态机重新塞回 `main.js`
- 渲染层继续按职责拆分，不要再回到单文件膨胀状态

当前项目已经从单一大文件拆成多模块结构，新增功能建议优先落到对应模块中，而不是继续堆到 [src/renderer/app.js](./src/renderer/app.js)。
