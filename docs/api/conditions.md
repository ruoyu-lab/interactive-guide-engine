# 等待条件和操作类型

每个步骤可以通过 `waitFor` 声明推进条件。没有 `waitFor` 的步骤处于 `running`，可以通过 `next()` 手动进入下一步；有 `waitFor` 的步骤处于 `waiting`，条件满足后自动推进。

## 核心条件

核心 engine 内置这些条件，不依赖 DOM：

```ts
{ type: 'event', name: 'ready' }
{ type: 'state', check: (context) => context.ready === true }
{ type: 'allOf', conditions: [conditionA, conditionB] }
{ type: 'anyOf', conditions: [conditionA, conditionB] }
{ type: 'custom', name: 'my-handler', data: {} }
```

说明：

- `event`：由 `engine.emit(name, payload)` 触发。
- `state`：由 `engine.updateContext(context)` 后重新检查。
- `allOf`：全部子条件满足才推进。
- `anyOf`：任意一个子条件满足就推进。
- `custom`：交给 `conditionHandlers[name]` 处理。

## 超时

所有条件都可以配置 `timeoutMs` 和 `onTimeout`：

```ts
{
  type: 'event',
  name: 'ready',
  timeoutMs: 10000,
  onTimeout: 'skipStep',
}
```

`onTimeout` 支持：

- `stay`：保持当前步骤，默认行为，并通过 `onConditionError` 或 `console.error` 报告。
- `complete`：把当前条件视为完成。
- `skipStep`：跳过当前步骤，不触发该步骤的 `onComplete`。
- `skipTutorial`：跳过整个教程。

## DOM 操作条件

下面这些类型由 `createDomConditionHandlers()` 提供。使用前需要在 engine 中注册：

```ts
new TutorialEngine({
  id,
  steps,
  conditionHandlers: createDomConditionHandlers(),
})
```

支持类型：

- `click`：点击目标元素或其子元素。
- `input`：输入框、文本域、下拉框输入；默认要求非空。
- `change`：控件 change，适合 select、checkbox、radio。
- `focus`：目标获得焦点。
- `blur`：目标失去焦点。
- `submit`：表单提交。
- `hover`：鼠标或 pointer 进入目标。
- `keyboard`：按键，例如 `{ key: 'Enter' }` 或 `{ code: 'KeyS' }`。
- `visible`：目标存在且有可见尺寸。
- `exists`：目标出现在 DOM 中。
- `url`：完整 URL 匹配。
- `route`：`pathname + search + hash` 匹配。
- `drag`：拖动源元素，可选要求落到目标。
- `drop`：在目标上 drop，可选要求指定源。

## 示例

```ts
const steps: TutorialStep[] = [
  {
    id: 'open-settings',
    content: '点击设置按钮。',
    target: '[data-guide="settings"]',
    waitFor: { type: 'click', target: '[data-guide="settings"]' },
  },
  {
    id: 'enter-name',
    content: '输入非空名称。',
    target: '[data-guide="name"]',
    waitFor: { type: 'input', target: '[data-guide="name"]', value: /\S+/ },
  },
  {
    id: 'enable-switch',
    content: '打开开关。',
    target: '[data-guide="enabled"]',
    waitFor: { type: 'change', target: '[data-guide="enabled"] input', value: true },
  },
  {
    id: 'save',
    content: '点击保存，并等待保存成功。',
    target: '[data-guide="save"]',
    waitFor: {
      type: 'allOf',
      conditions: [
        { type: 'click', target: '[data-guide="save"]' },
        { type: 'state', check: (context) => context.saveStatus === 'success' },
      ],
    },
  },
  {
    id: 'wait-for-job',
    content: '等待任务完成，超时则跳过该步骤。',
    waitFor: {
      type: 'event',
      name: 'job:done',
      timeoutMs: 15000,
      onTimeout: 'skipStep',
    },
  },
]
```

## 匹配值

`input` 和 `change` 的 `value` 支持：

- `string`
- `number`
- `boolean`
- `RegExp`

checkbox 和 radio 会读取 `checked` 布尔值；其他表单元素读取 `value`。
