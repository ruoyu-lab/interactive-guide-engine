# DOM Renderer API

`DomTutorialRenderer` 是默认 UI 层，负责遮罩、高亮、气泡、按钮、键盘快捷键和位置计算。它只消费 engine snapshot，不负责条件判断。

## 创建

```ts
import { DomTutorialRenderer } from 'interactive-guide-engine/dom-renderer'
import 'interactive-guide-engine/dom-renderer/style.css'

const renderer = new DomTutorialRenderer(engine)
```

卸载：

```ts
renderer.destroy()
```

## 配置

```ts
type DomTutorialRendererOptions = {
  mount?: HTMLElement
  targetResolver?: (target: TutorialTarget) => Element | DOMRect | TutorialResolvedTarget | null | undefined
  autoScroll?: boolean
  zIndex?: number
  controls?: Partial<DomTutorialRendererControls>
  keyboard?: boolean | Partial<DomTutorialRendererKeyboard>
  completedTitle?: string
  completedContent?: string
  labels?: Partial<DomTutorialRendererLabels>
}
```

说明：

- `mount`：renderer 根节点挂载位置，默认 `document.body`。
- `targetResolver`：接管高亮目标查找，适合 Shadow DOM、iframe 外壳、虚拟目标和 Canvas 坐标。
- `autoScroll`：是否自动滚动到目标，默认 `true`。
- `zIndex`：覆盖默认 z-index。
- `controls`：控制“上一步、跳过、下一步、重置”按钮显隐。
- `keyboard`：控制 Esc、方向键、Enter 快捷键。
- `completedTitle` / `completedContent`：完成态文案。
- `labels`：覆盖全部默认文案。

## 控制按钮

```ts
new DomTutorialRenderer(engine, {
  controls: {
    skip: false,
    reset: false,
  },
})
```

## 键盘快捷键

```ts
new DomTutorialRenderer(engine, {
  keyboard: {
    escape: false,
    navigation: true,
  },
})
```

设为 `keyboard: false` 可以关闭全部快捷键。

## 自定义目标解析

```ts
new DomTutorialRenderer(engine, {
  targetResolver: (target) => {
    if (typeof target === 'string') {
      return shadowRoot.querySelector(target)
    }

    if (target.type === 'selector') {
      return shadowRoot.querySelector(target.value)
    }

    return null
  },
})
```

注意：renderer 的 `targetResolver` 只影响高亮和气泡定位；操作条件的目标解析由 `dom-adapter` 的 `targetResolver` 控制。两者可以使用同一个函数。

## 矩形目标

Canvas、图编辑器、地图这类界面没有真实 DOM 节点时，可以直接给步骤返回矩形：

```ts
const steps = [
  {
    id: 'canvas-node',
    content: '点击画布节点。',
    target: {
      type: 'rect',
      getRect: () => canvasNodeBoundsToViewportRect('node-1'),
    },
    waitFor: { type: 'custom', name: 'canvas-node-clicked' },
  },
]
```

矩形目标可以被高亮和定位气泡，但不能自动滚动到元素；操作判断通常配合 `event`、`state` 或 `custom` handler。
