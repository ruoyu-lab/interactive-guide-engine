# Interactive Guide Engine

Universal Interactive Guide Engine 是一个通用交互式教程引导引擎。它不是普通的“下一步弹窗教程”，核心流程是：

```txt
显示提示 -> 等待用户完成真实操作 -> 判断操作是否正确 -> 自动进入下一步
```

项目当前包含框架无关的核心 engine、可替换的 DOM adapter、基础 DOM renderer，以及一个 Vue demo。核心包不绑定游戏、节点编辑器、交易系统、后台系统或任何特定业务领域。

## 安装与 CSS

包产物通过 `npm run build:package` 输出到 `dist/package`。发布或本地 tarball 安装后这样使用：

```ts
import { TutorialEngine, type TutorialStep } from 'interactive-guide-engine'
import { createDomConditionHandlers } from 'interactive-guide-engine/dom-adapter'
import { DomTutorialRenderer } from 'interactive-guide-engine/dom-renderer'
import 'interactive-guide-engine/dom-renderer/style.css'
```

如果只使用核心 engine，可以不引入 DOM adapter、DOM renderer 和 CSS。只要使用 `DomTutorialRenderer`，就需要引入 `interactive-guide-engine/dom-renderer/style.css`，否则遮罩、高亮和气泡没有默认样式。

完整 API 文档在 [`docs/api`](./docs/api/README.md)。

## API 使用示例

```ts
import { TutorialEngine, type TutorialStep } from 'interactive-guide-engine'
import { createDomConditionHandlers } from 'interactive-guide-engine/dom-adapter'
import { DomTutorialRenderer } from 'interactive-guide-engine/dom-renderer'
import 'interactive-guide-engine/dom-renderer/style.css'

type SettingsContext = {
  notificationsEnabled: boolean
  saveStatus: 'idle' | 'success'
}

const steps: TutorialStep[] = [
  {
    id: 'open-settings',
    title: '打开设置',
    content: '点击设置按钮。',
    target: '[data-guide="open-settings"]',
    waitFor: { type: 'click', target: '[data-guide="open-settings"]' },
  },
  {
    id: 'enter-name',
    title: '输入名称',
    content: '输入任意非空名称。',
    target: '[data-guide="name"]',
    waitFor: { type: 'input', target: '[data-guide="name"]', value: /\S+/ },
  },
  {
    id: 'enable-notifications',
    title: '打开通知',
    content: '打开通知开关。',
    target: '[data-guide="notifications"]',
    waitFor: {
      type: 'state',
      check: (context) => Boolean((context as SettingsContext).notificationsEnabled),
    },
  },
]

const engine = new TutorialEngine({
  id: 'settings-onboarding',
  steps,
  context: {
    notificationsEnabled: false,
    saveStatus: 'idle',
  },
  conditionHandlers: createDomConditionHandlers(),
})

const renderer = new DomTutorialRenderer(engine)

engine.onChange((snapshot) => {
  console.log(snapshot.status, snapshot.currentStep?.id)
})

engine.start()

// 当业务状态变化时，把最新状态交回 engine。
engine.updateContext({
  notificationsEnabled: true,
  saveStatus: 'idle',
})

// 单页应用卸载时调用，清理 DOM 和事件监听。
function disposeTutorial(): void {
  renderer.destroy()
  engine.destroy()
}
```

核心 API 包括 `start()`、`next()`、`prev()`、`pause()`、`resume()`、`skip()`、`finish()`、`goToStep()`、`setSteps()`、`onChange()`、`updateContext()`、`emit()`、`reset()` 和 `destroy()`。等待条件支持 `event`、`state`、`allOf`、`anyOf`、`custom`，并支持 `timeoutMs` / `onTimeout`。步骤支持 `showIf` / `skipIf`，目标支持 selector、virtual target 和 rect target。DOM adapter 额外提供 `click`、`input`、`change`、`focus`、`blur`、`submit`、`hover`、`keyboard`、`visible`、`exists`、`url`、`route`、`drag`、`drop`。

详细说明见 [`docs/api/engine.md`](./docs/api/engine.md) 和 [`docs/api/conditions.md`](./docs/api/conditions.md)。

## Vue 集成

Vue 中推荐把 engine 和 renderer 作为组件生命周期资源创建和销毁，把业务状态通过 `watch` 同步给 engine：

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { TutorialEngine } from 'interactive-guide-engine'
import { createDomConditionHandlers } from 'interactive-guide-engine/dom-adapter'
import { DomTutorialRenderer } from 'interactive-guide-engine/dom-renderer'
import 'interactive-guide-engine/dom-renderer/style.css'

const settings = reactive({
  notificationsEnabled: false,
  theme: 'default',
})

let engine: TutorialEngine | undefined
let renderer: DomTutorialRenderer | undefined
let unsubscribe: (() => void) | undefined

onMounted(() => {
  engine = new TutorialEngine({
    id: 'vue-settings',
    steps: createSettingsSteps(),
    context: { ...settings },
    conditionHandlers: createDomConditionHandlers(),
  })

  unsubscribe = engine.onChange((snapshot) => {
    console.log(snapshot.currentStep?.id)
  })

  renderer = new DomTutorialRenderer(engine)
})

watch(settings, () => engine?.updateContext({ ...settings }), { deep: true })

onBeforeUnmount(() => {
  unsubscribe?.()
  renderer?.destroy()
  engine?.destroy()
})
</script>
```

当前 demo 的完整 Vue 接入在 `examples/vue-demo/src/App.vue`，教程步骤在 `examples/vue-demo/src/demo/tutorialSteps.ts`。

## 纯 DOM 集成

纯 DOM 页面可以直接创建 engine 与 renderer，并在原生事件里更新业务状态：

```ts
import { TutorialEngine } from 'interactive-guide-engine'
import { createDomConditionHandlers } from 'interactive-guide-engine/dom-adapter'
import { DomTutorialRenderer } from 'interactive-guide-engine/dom-renderer'
import 'interactive-guide-engine/dom-renderer/style.css'

const state = {
  theme: 'default',
  saveStatus: 'idle',
}

const engine = new TutorialEngine({
  id: 'plain-dom-settings',
  steps: [
    {
      id: 'choose-theme',
      content: '选择一个非默认主题。',
      target: '[data-guide="theme"]',
      waitFor: {
        type: 'state',
        check: (context) => context.theme !== 'default',
      },
    },
  ],
  context: state,
  conditionHandlers: createDomConditionHandlers(),
})

const renderer = new DomTutorialRenderer(engine)

document.querySelector('[data-guide="theme"]')?.addEventListener('change', (event) => {
  state.theme = (event.target as HTMLSelectElement).value
  engine.updateContext({ ...state })
})

document.querySelector('[data-guide="start"]')?.addEventListener('click', () => {
  engine.start()
})

window.addEventListener('beforeunload', () => {
  renderer.destroy()
  engine.destroy()
})
```

## Demo 教程流程

页面标题是 `Interactive Guide Engine Demo`，demo 展示一个通用 Web 应用设置流程：

1. 点击“打开设置”按钮，设置面板打开后自动进入下一步。
2. 在用户名输入框输入固定内容 `guide-user` 后自动进入下一步；如果输入框失去焦点，也会跳过该输入步骤。
3. 打开通知开关后自动进入下一步。
4. 将主题下拉框从默认值改为其他选项后自动进入下一步。
5. 把操作卡片拖到投放区，验证 DOM adapter 的 `drag` 条件。
6. 点击保存按钮，保存状态变成 `success` 后自动完成教程。

完成后会显示：

```txt
教程完成：你已经完成了一个真实交互流程。
```

教程状态和当前步骤会保存到 `localStorage`。刷新页面后可以恢复当前教程进度；demo 业务状态也会保存，便于验证刷新恢复。

## 目录结构

```txt
packages/
  engine/                 # 通用教程引擎，不依赖 demo 或 UI 框架
  dom-adapter/            # DOM 操作条件处理器，可替换 target resolver
  dom-renderer/           # 基础 DOM 渲染层，依赖 engine 的公开类型
docs/
  api/                    # 独立 API 文档
examples/
  vue-demo/               # Vue demo，只负责示例页面和示例业务状态
tests/
  engine/                 # 核心 engine 单元测试
  smoke/                  # Playwright smoke 用例
dist/
  demo/                   # npm run build 输出的 demo 产物
  package/                # npm run build:package 输出的包产物
playwright.smoke.config.ts
vite.config.ts            # demo 开发、构建、预览配置
vite.pack.config.ts       # npm 包构建配置
tsconfig.pack.json        # npm 包声明文件构建配置
```

demo 通过 Vite alias 引用 `packages` 源码，核心 engine 不从 demo 目录反向引用任何内容。

## 本地命令

```bash
npm install
npm run dev
```

启动 demo 开发服务器后打开终端输出的本地地址，通常是 `http://localhost:5173`。

运行单元测试：

```bash
npm test
```

构建 demo：

```bash
npm run build
```

运行 Playwright smoke：

```bash
npm run smoke
```

`npm run smoke` 会先执行 `npm run build`，再通过 `vite preview` 预览 `dist/demo`，不会要求启动 `npm run dev`。如果本机还没有 Playwright 浏览器，需要先安装 Chromium：

```bash
npx playwright install chromium
```

本地查看预览产物：

```bash
npm run preview:demo
```

预览 npm 包内容：

```bash
npm run pack:dry
```

生成本地 tarball 安装包：

```bash
npm run pack
```

`npm run pack:dry` 会先构建 `dist/package`，再执行 `npm pack --dry-run`，只检查 tarball 内会包含哪些文件。`npm run pack` 会生成类似 `interactive-guide-engine-0.1.0.tgz` 的本地安装包，不会发布到 npm。

## 发布准备与版本策略

包已经移除 `private`，并补齐 `description`、`keywords`、`license`、`main`、`module`、`types`、`exports`、`files` 和 `engines`。当前发布准备策略是“可 pack，不自动发布”：

1. 修改代码和文档后运行 `npm test` 与 `npm run smoke`。
2. 运行 `npm run pack:dry`，检查 dry-run 输出中只包含 `dist/package`、`docs/api`、`README.md`、`CHANGELOG.md` 和 `package.json` 等必要文件。
3. 按 Semantic Versioning 更新 `package.json` 和 `CHANGELOG.md`。
4. 运行 `npm run pack` 生成 `.tgz`，确认 tarball 内容、API 文档和变更记录后，才手动执行发布命令。

版本策略：

- `0.1.0`：首个可 pack 的 MVP 包版本。
- `0.x`：API 仍可能调整，minor 版本可以包含破坏性变更，但必须记录在 `CHANGELOG.md`。
- `patch`：仅用于向后兼容的 bug fix、文档修正或 smoke 脚本修正。
- `1.0.0`：核心 engine API、DOM renderer API 和 CSS 入口稳定后再发布。

## 后续路线图

- 增加单元测试覆盖更多 DOM adapter 条件和 renderer 定位策略。
- 增加更完善的定位策略，例如碰撞避让和滚动定位。
- 增加多教程实例管理和命名空间存储策略。
- 增加 tarball 安装验证。
