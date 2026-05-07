# DOM Adapter API

`dom-adapter` 把浏览器 DOM 事件和 DOM 状态转换为 engine 的条件完成信号。它是可选入口；不用默认 DOM 行为时，可以完全不引入。

## createDomConditionHandlers

```ts
import { createDomConditionHandlers } from 'interactive-guide-engine/dom-adapter'

const conditionHandlers = createDomConditionHandlers()
```

配置：

```ts
type DomConditionAdapterOptions = {
  root?: ParentNode
  window?: DomConditionWindow
  targetResolver?: (target: TutorialTarget) => Element | null
  pollIntervalMs?: number
}
```

说明：

- `root`：默认查询根节点，默认 `document`。
- `window`：指定 Window，适合 iframe。
- `targetResolver`：完全接管 `TutorialTarget` 到 Element 的解析，适合 Shadow DOM、虚拟节点映射、特殊容器。
- `pollIntervalMs`：`visible`、`exists`、`url`、`route` 的轮询间隔，默认 250ms。

## Shadow DOM 示例

```ts
const shadowRoot = host.shadowRoot!

const engine = new TutorialEngine({
  id: 'shadow-flow',
  steps,
  conditionHandlers: createDomConditionHandlers({
    root: shadowRoot,
    targetResolver: (target) => {
      if (typeof target === 'string') {
        return shadowRoot.querySelector(target)
      }

      if (target.type === 'selector') {
        return shadowRoot.querySelector(target.value)
      }

      return null
    },
  }),
})
```

## iframe 示例

```ts
const frameWindow = iframe.contentWindow!

const engine = new TutorialEngine({
  id: 'frame-flow',
  steps,
  conditionHandlers: createDomConditionHandlers({
    window: frameWindow,
    root: frameWindow.document,
  }),
})
```

## 虚拟目标示例

```ts
const engine = new TutorialEngine({
  id: 'graph-flow',
  steps: [
    {
      id: 'select-node',
      content: '选择节点。',
      target: { type: 'virtual', id: 'node-1' },
      waitFor: { type: 'click', target: { type: 'virtual', id: 'node-1' } },
    },
  ],
  conditionHandlers: createDomConditionHandlers({
    targetResolver: (target) => {
      if (typeof target !== 'string' && target.type === 'virtual') {
        return document.querySelector(`[data-node-id="${target.id}"]`)
      }

      return null
    },
  }),
})
```

## 自定义和覆盖

`conditionHandlers` 是普通对象，可以覆盖默认 DOM handler，也可以混入业务 handler：

```ts
const domHandlers = createDomConditionHandlers()

const engine = new TutorialEngine({
  id: 'mixed-flow',
  steps,
  conditionHandlers: {
    ...domHandlers,
    'canvas-node-selected': (_condition, controls) => {
      const unsubscribe = graph.on('select', () => controls.complete())
      return () => unsubscribe()
    },
  },
})
```
