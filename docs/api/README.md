# API 文档

这个目录放公开 API 说明。README 只保留快速入口，详细用法以这里为准。

## 包入口

```ts
import { TutorialEngine } from 'interactive-guide-engine'
import { createDomConditionHandlers } from 'interactive-guide-engine/dom-adapter'
import { DomTutorialEffects } from 'interactive-guide-engine/dom-effects'
import { DomTutorialRenderer } from 'interactive-guide-engine/dom-renderer'
import 'interactive-guide-engine/dom-renderer/style.css'
```

入口说明：

- `interactive-guide-engine`：核心状态机，不包含 DOM 渲染逻辑。
- `interactive-guide-engine/dom-adapter`：浏览器 DOM 操作条件处理器，例如 click、input、change、visible、route。
- `interactive-guide-engine/dom-effects`：可选 DOM 动画层，例如光标点击、输入预览、拖动轨迹，以及可替换光标样式。
- `interactive-guide-engine/dom-renderer`：默认 DOM 高亮和气泡渲染器。
- `interactive-guide-engine/dom-renderer/style.css`：默认 renderer 样式。

## 文档索引

- [核心 Engine API](./engine.md)
- [等待条件和操作类型](./conditions.md)
- [DOM Adapter API](./dom-adapter.md)
- [DOM Effects API](./dom-effects.md)
- [DOM Renderer API](./dom-renderer.md)

## 推荐组合

普通 Web 应用使用：

```ts
const engine = new TutorialEngine({
  id: 'settings',
  steps,
  context,
  conditionHandlers: createDomConditionHandlers(),
})

const renderer = new DomTutorialRenderer(engine)
const effects = new DomTutorialEffects(engine)
engine.start()
```

非 DOM 场景，例如 Canvas、游戏、节点编辑器，可以不用 `dom-adapter`，只通过 `event`、`state` 或 `custom` handler 推进。高亮目标可以用 `target: { type: 'rect', getRect }` 或 `target: { type: 'virtual', id }` 交给 renderer 解析。
