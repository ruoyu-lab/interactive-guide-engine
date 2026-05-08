import type {
  TutorialCursorStyle,
  TutorialEffect,
  TutorialEngine,
  TutorialContext,
  TutorialResolvedTarget,
  TutorialSnapshot,
  TutorialTarget,
  TutorialTypeTextEffect,
} from '../../engine/src'

export type DomTutorialCursorHotspot = {
  x: number
  y: number
}

export type DomTutorialCursorStyleName = TutorialCursorStyle

export type DomTutorialCursorStyleConfig = {
  html?: string
  className?: string
  hotspot?: DomTutorialCursorHotspot
  rippleColor?: string
}

export type DomTutorialCursorStyle = DomTutorialCursorStyleName | DomTutorialCursorStyleConfig

export type DomTutorialEffectsOptions = {
  mount?: HTMLElement
  targetResolver?: (target: TutorialTarget) => Element | DOMRect | TutorialResolvedTarget | null | undefined
  zIndex?: number
  autoPlay?: boolean
  cursor?: DomTutorialCursorStyle
  cursorStyles?: Record<string, DomTutorialCursorStyleConfig>
}

type TargetState = {
  element?: Element
  rect: DOMRect
}

type CursorPoint = DomTutorialCursorHotspot

const defaultEffectDurationMs = 520
const defaultTypeSpeedMs = 72
const defaultCursorStyleName = 'macos'
const defaultCursorHtml = '<span class="tutorial-cursor-arrow"></span>'
const defaultCursorHotspot: CursorPoint = { x: 5, y: 4 }
const defaultRippleColor = '#007aff'
const defaultCursorStyles: Record<string, DomTutorialCursorStyleConfig> = {
  macos: {
    html: defaultCursorHtml,
    className: 'tutorial-effect-cursor--macos',
    hotspot: defaultCursorHotspot,
    rippleColor: defaultRippleColor,
  },
  'macos-dark': {
    html: defaultCursorHtml,
    className: 'tutorial-effect-cursor--macos-dark',
    hotspot: defaultCursorHotspot,
    rippleColor: '#0a84ff',
  },
  glass: {
    html: '<span class="tutorial-cursor-glass"><span></span></span>',
    className: 'tutorial-effect-cursor--glass',
    hotspot: { x: 18, y: 18 },
    rippleColor: '#64d2ff',
  },
  ring: {
    html: '<span class="tutorial-cursor-ring"></span>',
    className: 'tutorial-effect-cursor--ring',
    hotspot: { x: 16, y: 16 },
    rippleColor: '#5e5ce6',
  },
  touch: {
    html: '<span class="tutorial-cursor-touch"><span></span></span>',
    className: 'tutorial-effect-cursor--touch',
    hotspot: { x: 18, y: 18 },
    rippleColor: '#34c759',
  },
  dot: {
    html: '<span class="tutorial-cursor-dot"></span>',
    className: 'tutorial-effect-cursor--dot',
    hotspot: { x: 8, y: 8 },
    rippleColor: '#ff9f0a',
  },
}
let styleInstalled = false

export class DomTutorialEffects<TContext extends TutorialContext = TutorialContext> {
  private readonly root: HTMLDivElement
  private readonly cursor: HTMLDivElement
  private readonly cursorStyles = new Map<string, DomTutorialCursorStyleConfig>()
  private readonly unsubscribe: () => void
  private snapshot?: TutorialSnapshot<TContext>
  private currentStepId?: string
  private cursorPoint?: CursorPoint
  private cursorStyle: DomTutorialCursorStyle = defaultCursorStyleName
  private cursorHotspot = defaultCursorHotspot
  private cursorRippleColor = defaultRippleColor
  private runToken = 0
  private destroyed = false

  constructor(
    private readonly engine: TutorialEngine<TContext>,
    private readonly options: DomTutorialEffectsOptions = {},
  ) {
    installDomEffectsStyle()

    this.root = document.createElement('div')
    this.root.className = 'tutorial-effects'
    if (options.zIndex !== undefined) {
      this.root.style.zIndex = String(options.zIndex)
    }

    this.cursor = document.createElement('div')
    this.cursor.className = 'tutorial-effect-cursor'
    this.root.append(this.cursor)
    this.installCursorStyles(options.cursorStyles)
    this.setCursorStyle(options.cursor ?? defaultCursorStyleName)

    const mount = options.mount ?? document.body
    mount.append(this.root)

    this.unsubscribe = this.engine.onChange((snapshot) => {
      this.snapshot = snapshot
      if (this.options.autoPlay === false) {
        return
      }

      this.playSnapshot(snapshot)
    })
  }

  playCurrent(): void {
    if (!this.snapshot) {
      return
    }

    this.playSnapshot(this.snapshot, { replay: true })
  }

  registerCursorStyle(name: string, config: DomTutorialCursorStyleConfig): void {
    this.cursorStyles.set(name, config)
  }

  setCursorStyle(style: DomTutorialCursorStyle): void {
    this.cursorStyle = style
    this.applyCursorStyle(style)
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.runToken += 1
    this.unsubscribe()
    this.root.remove()
    this.destroyed = true
  }

  private playSnapshot(snapshot: TutorialSnapshot<TContext>, options: { replay?: boolean } = {}): void {
    const step = snapshot.currentStep
    const active = snapshot.status === 'running' || snapshot.status === 'waiting'
    if (!active || !step?.effects?.length) {
      this.currentStepId = step?.id
      this.stop()
      return
    }

    if (!options.replay && this.currentStepId === step.id) {
      return
    }

    this.currentStepId = step.id
    void this.runEffects(step.effects, ++this.runToken)
  }

  private async runEffects(effects: TutorialEffect[], token: number): Promise<void> {
    this.clearDynamicNodes()

    for (const effect of effects) {
      if (!this.isCurrentRun(token)) {
        return
      }

      if (effect.delayMs) {
        await this.wait(effect.delayMs, token)
      }

      if (!this.isCurrentRun(token)) {
        return
      }

      await this.playEffect(effect, token)
    }

    if (this.isCurrentRun(token)) {
      this.applyCursorStyle(this.cursorStyle)
      this.cursor.classList.remove('dragging')
    }
  }

  private async playEffect(effect: TutorialEffect, token: number): Promise<void> {
    this.applyCursorStyle(effect.cursorStyle ?? this.cursorStyle)

    if (effect.type === 'cursorMove') {
      const target = this.getTarget(effect.target)
      if (target) {
        await this.moveCursorTo(this.centerOf(target.rect), effect.durationMs, token)
      }
      return
    }

    if (effect.type === 'cursorClick') {
      const target = this.getTarget(effect.target)
      if (target) {
        const point = this.centerOf(target.rect)
        await this.moveCursorTo(point, effect.durationMs, token)
        this.createRipple(point)
        this.markCursorClick()
        await this.wait(180, token)
      }
      return
    }

    if (effect.type === 'typeText') {
      await this.playTypeText(effect, token)
      return
    }

    if (effect.type === 'cursorDrag') {
      const source = this.getTarget(effect.source)
      const target = this.getTarget(effect.target)
      if (source && target) {
        await this.moveCursorTo(this.centerOf(source.rect), 260, token)
        this.cursor.classList.add('dragging')
        await this.moveCursorTo(this.centerOf(target.rect), effect.durationMs ?? 860, token)
        this.cursor.classList.remove('dragging')
        this.createRipple(this.centerOf(target.rect))
        await this.wait(180, token)
      }
      return
    }

    if (effect.type === 'pulse') {
      const target = this.getTarget(effect.target)
      if (target) {
        this.createPulse(target.rect, effect.durationMs)
        await this.wait(effect.durationMs ?? 920, token)
      }
      return
    }

    if (effect.type === 'shake') {
      const target = this.getTarget(effect.target)
      if (target) {
        await this.playShake(target, effect.durationMs, token)
      }
    }
  }

  private async playTypeText(effect: TutorialTypeTextEffect, token: number): Promise<void> {
    const target = this.getTarget(effect.target)
    if (!target) {
      return
    }

    await this.moveCursorTo(this.centerOf(target.rect), effect.durationMs ?? 320, token)
    this.createRipple(this.centerOf(target.rect))
    this.markCursorClick()

    if (effect.mode === 'perform') {
      await this.performTypeText(effect, target, token)
      return
    }

    if (effect.mode === 'ghost') {
      await this.ghostTypeText(effect, target, token)
      return
    }

    await this.previewTypeText(effect, target, token)
  }

  private async previewTypeText(effect: TutorialTypeTextEffect, target: TargetState, token: number): Promise<void> {
    const preview = document.createElement('div')
    preview.className = 'tutorial-effect-type-preview'
    preview.style.left = `${target.rect.left}px`
    preview.style.top = `${target.rect.top}px`
    preview.style.width = `${target.rect.width}px`
    preview.style.height = `${target.rect.height}px`
    preview.textContent = ''
    this.root.append(preview)

    for (const character of effect.text) {
      if (!this.isCurrentRun(token)) {
        return
      }

      preview.textContent += character
      await this.wait(effect.speedMs ?? defaultTypeSpeedMs, token)
    }

    await this.wait(560, token)
    preview.remove()
  }

  private async ghostTypeText(effect: TutorialTypeTextEffect, target: TargetState, token: number): Promise<void> {
    const element = target.element
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      await this.previewTypeText({ ...effect, mode: 'preview' }, target, token)
      return
    }

    element.focus({ preventScroll: true })

    const ghost = document.createElement('div')
    const text = document.createElement('span')
    const caret = document.createElement('span')
    const rect = element.getBoundingClientRect()
    const computed = window.getComputedStyle(element)

    ghost.className = 'tutorial-effect-type-ghost'
    text.className = 'tutorial-effect-type-ghost-text'
    caret.className = 'tutorial-effect-type-ghost-caret'
    ghost.append(text, caret)
    this.applyGhostTypeStyles(ghost, element, rect, computed)
    this.root.append(ghost)

    for (const character of effect.text) {
      if (!this.isCurrentRun(token)) {
        return
      }

      text.textContent += character
      await this.wait(effect.speedMs ?? defaultTypeSpeedMs, token)
    }

    await this.wait(720, token)
    ghost.remove()
  }

  private async performTypeText(effect: TutorialTypeTextEffect, target: TargetState, token: number): Promise<void> {
    const element = target.element
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      await this.previewTypeText({ ...effect, mode: 'preview' }, target, token)
      return
    }

    element.focus()
    element.value = ''
    for (const character of effect.text) {
      if (!this.isCurrentRun(token)) {
        return
      }

      element.value += character
      element.dispatchEvent(new InputEvent('input', { bubbles: true, data: character }))
      await this.wait(effect.speedMs ?? defaultTypeSpeedMs, token)
    }
  }

  private applyGhostTypeStyles(
    ghost: HTMLDivElement,
    element: HTMLInputElement | HTMLTextAreaElement,
    rect: DOMRect,
    computed: CSSStyleDeclaration,
  ): void {
    const borderLeft = this.toPixelNumber(computed.borderLeftWidth)
    const borderRight = this.toPixelNumber(computed.borderRightWidth)
    const borderTop = this.toPixelNumber(computed.borderTopWidth)
    const borderBottom = this.toPixelNumber(computed.borderBottomWidth)

    ghost.style.left = `${rect.left + borderLeft}px`
    ghost.style.top = `${rect.top + borderTop}px`
    ghost.style.width = `${Math.max(0, rect.width - borderLeft - borderRight)}px`
    ghost.style.height = `${Math.max(0, rect.height - borderTop - borderBottom)}px`
    ghost.style.padding = computed.padding
    ghost.style.borderTopLeftRadius = this.innerBorderRadius(computed.borderTopLeftRadius, borderLeft, borderTop)
    ghost.style.borderTopRightRadius = this.innerBorderRadius(computed.borderTopRightRadius, borderRight, borderTop)
    ghost.style.borderBottomRightRadius = this.innerBorderRadius(
      computed.borderBottomRightRadius,
      borderRight,
      borderBottom,
    )
    ghost.style.borderBottomLeftRadius = this.innerBorderRadius(
      computed.borderBottomLeftRadius,
      borderLeft,
      borderBottom,
    )
    ghost.style.color = computed.color
    ghost.style.background = computed.backgroundColor
    ghost.style.font = computed.font
    ghost.style.fontFeatureSettings = computed.fontFeatureSettings
    ghost.style.fontKerning = computed.fontKerning
    ghost.style.letterSpacing = computed.letterSpacing
    ghost.style.lineHeight = computed.lineHeight
    ghost.style.textAlign = computed.textAlign
    ghost.style.textTransform = computed.textTransform
    ghost.style.alignItems = element instanceof HTMLTextAreaElement ? 'flex-start' : 'center'
  }

  private async playShake(target: TargetState, durationMs = 520, token: number): Promise<void> {
    if (target.element instanceof HTMLElement) {
      const animation = target.element.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-7px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(0)' },
      ], {
        duration: durationMs,
        easing: 'ease-in-out',
      })
      await this.finishAnimation(animation, token)
      return
    }

    const overlay = this.createRectOverlay(target.rect, 'tutorial-effect-shake-box')
    const animation = overlay.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-7px)' },
      { transform: 'translateX(7px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(0)' },
    ], {
      duration: durationMs,
      easing: 'ease-in-out',
    })
    await this.finishAnimation(animation, token)
    overlay.remove()
  }

  private async moveCursorTo(point: CursorPoint, durationMs = defaultEffectDurationMs, token: number): Promise<void> {
    this.cursor.classList.add('visible')
    const start = this.cursorPoint ?? { x: point.x - 96, y: point.y - 80 }
    this.cursorPoint = point

    const animation = this.cursor.animate([
      { transform: this.cursorTransform(start) },
      { transform: this.cursorTransform(point) },
    ], {
      duration: this.prefersReducedMotion() ? 0 : durationMs,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards',
    })

    await this.finishAnimation(animation, token)
    this.cursor.style.transform = this.cursorTransform(point)
  }

  private createRipple(point: CursorPoint): void {
    const ripple = document.createElement('div')
    ripple.className = 'tutorial-effect-ripple'
    ripple.style.left = `${point.x}px`
    ripple.style.top = `${point.y}px`
    ripple.style.setProperty('--tutorial-effect-ripple-color', this.cursorRippleColor)
    this.root.append(ripple)
    globalThis.setTimeout(() => ripple.remove(), 620)
  }

  private createPulse(rect: DOMRect, durationMs = 920): void {
    const pulse = this.createRectOverlay(rect, 'tutorial-effect-pulse')
    pulse.style.animationDuration = `${durationMs}ms`
    globalThis.setTimeout(() => pulse.remove(), durationMs + 80)
  }

  private createRectOverlay(rect: DOMRect, className: string): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = className
    overlay.style.left = `${rect.left}px`
    overlay.style.top = `${rect.top}px`
    overlay.style.width = `${rect.width}px`
    overlay.style.height = `${rect.height}px`
    this.root.append(overlay)
    return overlay
  }

  private stop(): void {
    this.runToken += 1
    this.cursor.classList.remove('visible', 'dragging', 'clicking')
    this.clearDynamicNodes()
  }

  private clearDynamicNodes(): void {
    Array.from(this.root.children).forEach((child) => {
      if (child !== this.cursor) {
        child.remove()
      }
    })
  }

  private getTarget(target: TutorialTarget): TargetState | undefined {
    if (typeof target !== 'string' && target.type === 'rect') {
      const rect = target.getRect()
      return rect ? { rect } : undefined
    }

    const resolvedTarget = this.options.targetResolver?.(target) ?? this.querySelectorTarget(target)
    if (!resolvedTarget) {
      return undefined
    }

    if (resolvedTarget instanceof Element) {
      const rect = resolvedTarget.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        return undefined
      }

      return { element: resolvedTarget, rect }
    }

    if ('rect' in resolvedTarget) {
      return resolvedTarget
    }

    return { rect: resolvedTarget }
  }

  private querySelectorTarget(target: TutorialTarget): Element | undefined {
    const selector = this.getTargetSelector(target)
    return selector ? document.querySelector(selector) ?? undefined : undefined
  }

  private getTargetSelector(target: TutorialTarget): string | undefined {
    if (typeof target === 'string') {
      return target
    }

    if (target.type === 'selector') {
      return target.value
    }

    return undefined
  }

  private centerOf(rect: DOMRect): CursorPoint {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }

  private installCursorStyles(styles: Record<string, DomTutorialCursorStyleConfig> | undefined): void {
    Object.entries(defaultCursorStyles).forEach(([name, config]) => {
      this.cursorStyles.set(name, config)
    })

    if (!styles) {
      return
    }

    Object.entries(styles).forEach(([name, config]) => {
      this.cursorStyles.set(name, config)
    })
  }

  private applyCursorStyle(style: DomTutorialCursorStyle): void {
    const config = this.resolveCursorStyle(style)
    const visible = this.cursor.classList.contains('visible')
    const dragging = this.cursor.classList.contains('dragging')
    const clicking = this.cursor.classList.contains('clicking')
    const classNames = ['tutorial-effect-cursor']

    if (typeof style === 'string') {
      classNames.push(`tutorial-effect-cursor--${this.toClassName(style)}`)
    }

    if (config.className) {
      classNames.push(...config.className.split(/\s+/).filter(Boolean))
    }

    if (visible) {
      classNames.push('visible')
    }

    if (dragging) {
      classNames.push('dragging')
    }

    if (clicking) {
      classNames.push('clicking')
    }

    this.cursor.className = classNames.join(' ')
    this.cursor.innerHTML = config.html ?? defaultCursorHtml
    this.cursorHotspot = config.hotspot ?? defaultCursorHotspot
    this.cursorRippleColor = config.rippleColor ?? defaultRippleColor
    this.cursor.style.setProperty('--tutorial-cursor-ripple-color', this.cursorRippleColor)

    if (this.cursorPoint) {
      this.cursor.style.transform = this.cursorTransform(this.cursorPoint)
    }
  }

  private resolveCursorStyle(style: DomTutorialCursorStyle): DomTutorialCursorStyleConfig {
    if (typeof style !== 'string') {
      return style
    }

    return this.cursorStyles.get(style) ?? this.cursorStyles.get(defaultCursorStyleName) ?? defaultCursorStyles.macos
  }

  private markCursorClick(): void {
    this.cursor.classList.add('clicking')
    globalThis.setTimeout(() => {
      if (!this.destroyed) {
        this.cursor.classList.remove('clicking')
      }
    }, 180)
  }

  private cursorTransform(point: CursorPoint): string {
    return `translate(${point.x - this.cursorHotspot.x}px, ${point.y - this.cursorHotspot.y}px)`
  }

  private toClassName(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '-')
  }

  private toPixelNumber(value: string): number {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private innerBorderRadius(value: string, horizontalBorder: number, verticalBorder: number): string {
    const radius = this.toPixelNumber(value)
    if (radius === 0) {
      return value
    }

    return `${Math.max(0, radius - Math.max(horizontalBorder, verticalBorder))}px`
  }

  private async finishAnimation(animation: Animation, token: number): Promise<void> {
    try {
      await animation.finished
    } catch {
      return
    }

    if (!this.isCurrentRun(token)) {
      animation.cancel()
    }
  }

  private wait(ms: number, token: number): Promise<void> {
    return new Promise((resolve) => {
      globalThis.setTimeout(() => {
        if (this.isCurrentRun(token)) {
          resolve()
          return
        }

        resolve()
      }, this.prefersReducedMotion() ? Math.min(ms, 40) : ms)
    })
  }

  private isCurrentRun(token: number): boolean {
    return !this.destroyed && token === this.runToken
  }

  private prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
}

function installDomEffectsStyle(): void {
  if (styleInstalled) {
    return
  }

  const style = document.createElement('style')
  style.textContent = `
.tutorial-effects {
  position: fixed;
  inset: 0;
  z-index: 1001;
  pointer-events: none;
}

.tutorial-effect-cursor {
  position: fixed;
  left: 0;
  top: 0;
  width: 40px;
  height: 40px;
  opacity: 0;
  pointer-events: none;
  filter: drop-shadow(0 10px 18px rgb(15 23 42 / 18%));
  transition: opacity 140ms ease;
  will-change: transform, opacity;
}

.tutorial-effect-cursor.visible {
  opacity: 1;
}

.tutorial-effect-cursor.clicking > span {
  animation: tutorial-effect-cursor-click 180ms ease-out;
}

.tutorial-effect-cursor > span {
  position: absolute;
  display: block;
}

.tutorial-cursor-arrow {
  left: 0;
  top: 0;
  width: 20px;
  height: 28px;
  background: linear-gradient(145deg, #ffffff 0%, #f6f7fb 58%, #d8dde7 100%);
  clip-path: polygon(0 0, 0 100%, 39% 75%, 59% 100%, 78% 89%, 58% 66%, 100% 66%);
  filter:
    drop-shadow(0 0 0.6px rgb(0 0 0 / 70%))
    drop-shadow(0 4px 7px rgb(15 23 42 / 22%));
  transition: transform 180ms ease;
}

.tutorial-effect-cursor--macos-dark .tutorial-cursor-arrow {
  background: linear-gradient(145deg, #111827 0%, #2f3948 68%, #687184 100%);
  filter:
    drop-shadow(0 0 0.75px rgb(255 255 255 / 78%))
    drop-shadow(0 5px 10px rgb(15 23 42 / 26%));
}

.tutorial-cursor-glass {
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 999px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 82%), rgb(236 242 255 / 50%)),
    rgb(255 255 255 / 46%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 88%),
    inset 0 -10px 22px rgb(17 24 39 / 8%),
    0 12px 28px rgb(15 23 42 / 16%);
  backdrop-filter: blur(14px) saturate(1.25);
}

.tutorial-cursor-glass span {
  position: absolute;
  left: 14px;
  top: 14px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #0a84ff;
  box-shadow: 0 0 0 5px rgb(10 132 255 / 12%);
}

.tutorial-cursor-ring {
  left: 0;
  top: 0;
  width: 32px;
  height: 32px;
  border: 2px solid rgb(94 92 230 / 88%);
  border-radius: 999px;
  background: rgb(255 255 255 / 22%);
  box-shadow:
    0 0 0 6px rgb(94 92 230 / 10%),
    inset 0 0 0 1px rgb(255 255 255 / 58%);
  backdrop-filter: blur(8px);
}

.tutorial-cursor-ring::after {
  position: absolute;
  left: 12px;
  top: 12px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #5e5ce6;
  content: "";
}

.tutorial-cursor-touch {
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 999px;
  background: rgb(255 255 255 / 64%);
  box-shadow:
    0 0 0 8px rgb(52 199 89 / 13%),
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 10px 24px rgb(15 23 42 / 14%);
  backdrop-filter: blur(12px);
}

.tutorial-cursor-touch span {
  position: absolute;
  left: 12px;
  top: 12px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #34c759;
}

.tutorial-cursor-dot {
  left: 0;
  top: 0;
  width: 16px;
  height: 16px;
  border: 1px solid rgb(255 255 255 / 74%);
  border-radius: 999px;
  background: #ff9f0a;
  box-shadow:
    0 0 0 7px rgb(255 159 10 / 18%),
    0 10px 22px rgb(15 23 42 / 18%);
}

.tutorial-effect-cursor.dragging .tutorial-cursor-arrow {
  transform: scale(0.92) rotate(-7deg);
}

.tutorial-effect-cursor.dragging .tutorial-cursor-glass,
.tutorial-effect-cursor.dragging .tutorial-cursor-ring,
.tutorial-effect-cursor.dragging .tutorial-cursor-touch,
.tutorial-effect-cursor.dragging .tutorial-cursor-dot {
  transform: scale(0.92);
}

.tutorial-effect-ripple {
  position: fixed;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border: 2px solid var(--tutorial-effect-ripple-color, #007aff);
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgb(255 255 255 / 30%);
  animation: tutorial-effect-ripple 620ms ease-out forwards;
}

.tutorial-effect-type-preview {
  position: fixed;
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 12px;
  overflow: hidden;
  color: #0b3b60;
  background: rgb(255 255 255 / 82%);
  border: 1px solid rgb(255 255 255 / 72%);
  border-radius: 8px;
  font: inherit;
  font-weight: 800;
  white-space: nowrap;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 14px 34px rgb(15 23 42 / 14%);
  backdrop-filter: blur(16px) saturate(1.2);
}

.tutorial-effect-type-ghost {
  position: fixed;
  display: flex;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  pointer-events: none;
  white-space: pre;
}

.tutorial-effect-type-ghost-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
}

.tutorial-effect-type-ghost-caret {
  flex: 0 0 auto;
  width: 2px;
  height: 1.15em;
  margin-left: 2px;
  border-radius: 999px;
  background: #007aff;
  box-shadow: 0 0 0 2px rgb(0 122 255 / 10%);
  animation: tutorial-effect-type-caret 920ms steps(1, end) infinite;
}

.tutorial-effect-pulse,
.tutorial-effect-shake-box {
  position: fixed;
  border-radius: 8px;
  pointer-events: none;
}

.tutorial-effect-pulse {
  border: 1px solid rgb(10 132 255 / 66%);
  background: rgb(255 255 255 / 12%);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 45%),
    0 0 0 0 rgb(10 132 255 / 24%);
  animation: tutorial-effect-pulse 920ms ease-out forwards;
  backdrop-filter: blur(4px);
}

.tutorial-effect-shake-box {
  border: 1px solid rgb(255 159 10 / 76%);
  background: rgb(255 246 216 / 44%);
  box-shadow: 0 12px 28px rgb(15 23 42 / 12%);
  backdrop-filter: blur(4px);
}

@keyframes tutorial-effect-cursor-click {
  0% {
    transform: scale(1);
  }

  45% {
    transform: scale(0.88);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes tutorial-effect-ripple {
  from {
    opacity: 0.85;
    transform: scale(0.6);
  }

  to {
    opacity: 0;
    transform: scale(3.5);
  }
}

@keyframes tutorial-effect-type-caret {
  0%,
  48% {
    opacity: 1;
  }

  49%,
  100% {
    opacity: 0;
  }
}

@keyframes tutorial-effect-pulse {
  from {
    opacity: 0.9;
    transform: scale(0.98);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 48%),
      0 0 0 0 rgb(10 132 255 / 24%);
  }

  to {
    opacity: 0;
    transform: scale(1.04);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 0%),
      0 0 0 18px rgb(10 132 255 / 0%);
  }
}
`

  document.head.append(style)
  styleInstalled = true
}
