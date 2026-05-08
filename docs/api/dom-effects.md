# DOM Effects API

`DomTutorialEffects` 是可选动画层。它订阅 engine 的步骤变化，并播放步骤上的 `effects` 配置。它不负责推进教程，也不会默认替用户完成操作。

## 创建

```ts
import { DomTutorialEffects } from 'interactive-guide-engine/dom-effects'

const effects = new DomTutorialEffects(engine, {
  cursor: 'macos',
})
```

卸载：

```ts
effects.destroy()
```

运行时替换光标：

```ts
effects.setCursorStyle('glass')
effects.playCurrent()
```

## 步骤配置

```ts
const steps = [
  {
    id: 'enter-name',
    content: '输入 guide-user。',
    target: '[data-guide="username"]',
    effects: [
      { type: 'cursorClick', target: '[data-guide="username"]' },
      {
        type: 'typeText',
        target: '[data-guide="username"]',
        text: 'guide-user',
        mode: 'ghost',
      },
    ],
    waitFor: {
      type: 'input',
      target: '[data-guide="username"]',
      value: 'guide-user',
    },
  },
]
```

## 支持效果

- `cursorMove`：光标移动到目标。
- `cursorClick`：光标移动到目标并显示点击波纹。
- `typeText`：演示输入内容。
- `cursorDrag`：光标从源目标拖到目标。
- `pulse`：目标脉冲高亮。
- `shake`：目标抖动提示。

每个光标类效果都支持 `cursorStyle` 临时覆盖：

```ts
{
  type: 'cursorClick',
  target: '[data-guide="save"]',
  cursorStyle: 'ring',
}
```

## typeText

`typeText` 支持三种模式：

- `preview`：默认值，在输入框外层显示演示文字，不修改输入框值。
- `ghost`：在输入框内部显示镜像文字和插入光标，不修改真实 `value`，也不派发 `input` 事件。
- `perform`：真实写入输入框并派发 input 事件。

```ts
{
  type: 'typeText',
  target: '[data-guide="username"]',
  text: 'guide-user',
  speedMs: 80,
  mode: 'ghost',
}
```

推荐用 `ghost` 做输入演示，它的观感接近真实输入，但不会影响业务状态。只有明确需要自动演示完整流程时，再使用 `perform`。

## 拖动

```ts
{
  type: 'cursorDrag',
  source: '[data-guide="drag-card"]',
  target: '[data-guide="drop-zone"]',
  durationMs: 900,
}
```

`cursorDrag` 只是视觉演示，不会触发真实 drag/drop 事件。真实推进仍由 `waitFor` 的 `drag` / `drop` 条件或业务事件决定。

## 光标样式

内置样式：

- `macos`：默认白色箭头，接近 macOS 指针。
- `macos-dark`：深色箭头。
- `glass`：玻璃拟态圆形光标。
- `ring`：精确定位光环。
- `touch`：触控点。
- `dot`：小圆点。

构造时设置默认光标：

```ts
const effects = new DomTutorialEffects(engine, {
  cursor: 'macos-dark',
})
```

注册自定义光标：

```ts
const effects = new DomTutorialEffects(engine, {
  cursorStyles: {
    brand: {
      html: '<span class="brand-guide-cursor"></span>',
      hotspot: { x: 18, y: 18 },
      rippleColor: '#ff2d55',
    },
  },
  cursor: 'brand',
})
```

也可以运行时注册和切换：

```ts
effects.registerCursorStyle('brand', {
  html: '<span class="brand-guide-cursor"></span>',
  hotspot: { x: 18, y: 18 },
  rippleColor: '#ff2d55',
})

effects.setCursorStyle('brand')
```

`html` 会被渲染到 `.tutorial-effect-cursor` 内部；如果传自定义 class，需要在业务 CSS 中提供对应样式。`hotspot` 是实际点击点在光标元素内的坐标。

## 配置

```ts
type DomTutorialEffectsOptions = {
  mount?: HTMLElement
  targetResolver?: (target: TutorialTarget) => Element | DOMRect | TutorialResolvedTarget | null | undefined
  zIndex?: number
  autoPlay?: boolean
  cursor?: DomTutorialCursorStyle
  cursorStyles?: Record<string, DomTutorialCursorStyleConfig>
}
```

- `mount`：效果层挂载位置，默认 `document.body`。
- `targetResolver`：接管目标解析，适合 Shadow DOM、iframe、virtual target 或 Canvas rect。
- `zIndex`：覆盖默认层级。
- `autoPlay`：是否在步骤变化时自动播放，默认 `true`。设为 `false` 后可以手动调用 `playCurrent()`。
- `cursor`：默认光标样式，支持内置样式名或自定义配置对象。
- `cursorStyles`：注册可复用的自定义光标样式。
