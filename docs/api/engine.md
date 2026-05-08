# 核心 Engine API

`TutorialEngine` 负责教程状态、步骤切换、持久化、条件判断和订阅通知。它不负责怎么显示 UI。

## 创建

```ts
type SettingsContext = {
  role: 'admin' | 'user'
  saveStatus: 'idle' | 'success'
}

const engine = new TutorialEngine<SettingsContext>({
  id: 'settings',
  steps,
  context: {
    role: 'user',
    saveStatus: 'idle',
  },
  conditionHandlers: createDomConditionHandlers(),
})
```

`TutorialEngineOptions`：

- `id: string`：教程 ID，用于默认 storage key。
- `steps: TutorialStep<TContext>[]`：步骤列表。
- `context?: TContext`：外部业务状态，供 `state`、`showIf`、`skipIf` 判断。
- `storageKey?: string`：自定义进度存储 key。
- `storage?: TutorialStorage`：自定义存储，默认浏览器 `localStorage`。
- `conditionHandlers?: TutorialConditionHandlers`：扩展操作类型的处理器。
- `lifecycle?: TutorialLifecycleHandlers`：全局步骤生命周期回调。
- `onConditionError?: TutorialConditionErrorListener`：条件检查抛错时的回调。

## 方法

- `start()`：开始教程；已完成或跳过后会从第一步重新开始。
- `next()`：手动进入下一步；未满足 `waitFor` 时不会绕过。
- `prev()`：回到上一步。
- `pause()`：暂停当前步骤，清理当前等待条件并把状态设为 `paused`。
- `resume()`：恢复暂停步骤，重新挂载等待条件。
- `skip()`：跳过教程。
- `finish()`：完成教程。
- `goToStep(stepId)`：跳到指定步骤。
- `setSteps(steps, options?)`：动态替换步骤，可保留当前步骤或指定新步骤。
- `getCurrentStep()`：读取当前步骤。
- `getStatus()`：读取当前状态。
- `getSnapshot()`：读取完整快照。
- `onChange(listener)`：订阅快照变化，返回取消订阅函数。
- `updateContext(context)`：替换外部业务状态并重新检查 `state` 条件。
- `emit(name, payload?)`：发送自定义事件，供 `event` 条件使用。
- `reset()`：回到 `idle` 并清除进度。
- `destroy()`：清理监听器、等待条件和内部队列。

## 状态

`TutorialStatus`：

- `idle`
- `running`
- `waiting`
- `paused`
- `completed`
- `skipped`

`TutorialSnapshot`：

```ts
type TutorialSnapshot = {
  status: TutorialStatus
  currentStep?: TutorialStep
  currentStepIndex: number
  totalSteps: number
  canGoPrev: boolean
  canGoNext: boolean
}
```

## 步骤

```ts
type TutorialStep = {
  id: string
  title?: string
  content: string
  target?: TutorialTarget
  placement?: 'top' | 'bottom' | 'left' | 'right'
  waitFor?: TutorialCondition
  effects?: TutorialEffect[]
  showIf?: (context) => boolean
  skipIf?: (context) => boolean
  onEnter?: TutorialStepLifecycleListener
  onLeave?: TutorialStepLifecycleListener
  onComplete?: TutorialStepLifecycleListener
}
```

`effects` 是可选视觉演示配置，由具体 renderer/effects 实现消费。光标类效果支持 `delayMs`、`durationMs` 和 `cursorStyle`：

```ts
{
  type: 'cursorClick',
  target: '[data-guide="save"]',
  cursorStyle: 'macos-dark',
}
```

`typeText` 支持 `preview`、`ghost` 和 `perform`。其中 `ghost` 只显示输入动画，不修改真实输入框值，也不触发 `input`。

生命周期回调会收到：

```ts
type TutorialStepLifecycleEvent = {
  step: TutorialStep
  snapshot: TutorialSnapshot
  reason: 'start' | 'next' | 'prev' | 'goToStep' | 'setSteps' | 'resume' | 'pause' | 'skip' | 'finish' | 'reset' | 'timeout'
}
```

`showIf` 返回 `false` 时该步骤会被自动跳过；`skipIf` 返回 `true` 时该步骤会被自动跳过。它们适合权限、功能开关、用户已经完成某项设置等场景。

```ts
const steps: Array<TutorialStep<SettingsContext>> = [
  {
    id: 'admin-only',
    content: '只有管理员需要看这一步。',
    showIf: (context) => context.role === 'admin',
  },
  {
    id: 'save',
    content: '保存设置。',
    skipIf: (context) => context.saveStatus === 'success',
  },
]
```

## Target

`target` 支持字符串 selector，也支持对象形式：

```ts
type TutorialTarget =
  | string
  | { type: 'selector'; value: string }
  | { type: 'rect'; getRect: () => DOMRect | undefined | null }
  | { type: 'virtual'; id: string }
```

- 字符串和 `selector`：适合普通 DOM。
- `rect`：适合 Canvas、地图、图编辑器等只有坐标矩形的目标。
- `virtual`：适合由应用层 resolver 映射的虚拟节点。

`rect` 和 `virtual` 主要由 renderer 或 adapter 的 `targetResolver` 消费。

## 动态步骤

```ts
engine.setSteps(nextSteps, {
  currentStepId: 'advanced-settings',
})
```

`setSteps` 适合权限、A/B、用户选择导致步骤列表变化的场景。

## 自定义操作

```ts
const engine = new TutorialEngine({
  id: 'canvas-flow',
  steps: [
    {
      id: 'select-node',
      content: '选择画布节点。',
      waitFor: { type: 'custom', name: 'canvas-node-selected' },
    },
  ],
  conditionHandlers: {
    'canvas-node-selected': (_condition, controls) => {
      const unsubscribe = canvas.on('node:selected', () => {
        controls.complete()
      })

      return () => unsubscribe()
    },
  },
})
```

handler 返回的 cleanup 会在步骤切换、暂停、跳过、重置或销毁时调用。
