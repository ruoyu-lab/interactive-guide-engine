# Interactive Guide Engine

Universal Interactive Guide Engine 是一个通用交互式教程引导引擎。

它不是普通的“下一步弹窗教程”。它的核心流程是：

```txt
显示提示 -> 等待用户完成真实操作 -> 判断操作是否正确 -> 自动进入下一步
```

本项目当前是 MVP：核心引擎、基础 DOM Renderer 和一个可直接运行的通用 Web 设置流程 demo。项目不绑定游戏、节点编辑器、交易系统、后台系统或任何特定业务领域。

## 如何运行 demo

```bash
npm install
npm run dev
```

启动后打开终端输出的本地地址，通常是：

```txt
http://localhost:5173
```

## 核心理念

- 核心 engine 只负责教程状态、步骤流转、条件判断、事件通知、进度保存和副作用清理。
- DOM renderer 只负责遮罩、高亮、提示气泡、按钮和进度显示。
- demo 业务只负责页面元素、真实交互和 demo 状态。
- 业务状态检查通过 `waitFor.state.check(context)` 传入，核心 engine 不知道 `username`、`theme`、`notification` 等业务字段。
- 带 `waitFor` 的步骤不能通过“下一步”按钮绕过，必须等真实操作满足条件后自动推进。

## Demo 教程流程

页面标题是 `Interactive Guide Engine Demo`，demo 展示一个通用 Web 应用设置流程：

1. 点击“打开设置”按钮，设置面板打开后自动进入下一步。
2. 在用户名输入框输入任意非空内容后自动进入下一步。
3. 打开通知开关后自动进入下一步。
4. 将主题下拉框从默认值改为其他选项后自动进入下一步。
5. 点击保存按钮，保存状态变成 `success` 后自动完成教程。

完成后会显示：

```txt
教程完成：你已经完成了一个真实交互流程。
```

## 当前 MVP 支持能力

核心 API：

- `start()`
- `next()`
- `prev()`
- `skip()`
- `finish()`
- `goToStep(stepId)`
- `getCurrentStep()`
- `getStatus()`
- `onChange(listener)`
- `destroy()`
- `reset()`
- `updateContext(context)`
- `emit(eventName, payload)`

教程状态：

- `idle`
- `running`
- `waiting`
- `completed`
- `skipped`

条件类型：

- 点击目标元素：`{ type: 'click', target: string }`
- 输入目标元素：`{ type: 'input', target: string, value?: string | RegExp }`
- 接收通用事件：`{ type: 'event', name: string }`
- 检查外部状态：`{ type: 'state', check: (context) => boolean | Promise<boolean> }`

DOM Renderer 支持：

- 遮罩层
- 高亮目标元素
- 提示气泡
- 标题和内容
- 当前步骤进度
- 上一步、跳过、下一步、重置按钮
- 完成状态提示

进度保存：

- 教程状态和当前步骤会保存到 `localStorage`。
- 刷新页面后可以恢复当前教程进度。
- “重置教程”会清空教程进度，便于反复测试。

## 后续路线图

- 抽离 engine 和 renderer 的公开包入口。
- 增加单元测试覆盖状态流转、条件判断和进度恢复。
- 增加更完善的定位策略，例如碰撞避让和滚动定位。
- 增加可插拔 renderer，让 Vue、React、Svelte 或纯 DOM 项目都能复用核心 engine。
- 增加多教程实例管理和命名空间存储策略。
- 准备 npm 包构建配置、类型声明输出和最小发布文档。
