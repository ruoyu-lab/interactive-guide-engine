import type {
  TutorialEngine,
  TutorialContext,
  TutorialPlacement,
  TutorialResolvedTarget,
  TutorialSnapshot,
  TutorialStep,
  TutorialTarget,
} from '../../engine/src'

export type DomTutorialRendererOptions = {
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

export type DomTutorialRendererControls = {
  back: boolean
  skip: boolean
  next: boolean
  reset: boolean
}

export type DomTutorialRendererKeyboard = {
  escape: boolean
  navigation: boolean
}

export type DomTutorialRendererLabels = {
  defaultTitle: string
  progress: (current: number, total: number) => string
  waitingForAction: string
  canContinue: string
  targetUnavailable: string
  completedTitle: string
  completedContent: string
  back: string
  skip: string
  next: string
  reset: string
}

const defaultLabels: DomTutorialRendererLabels = {
  defaultTitle: '教程',
  progress: (current, total) => `第 ${current} / ${total} 步`,
  waitingForAction: '等待你完成高亮区域中的真实操作...',
  canContinue: '当前步骤可以继续。',
  targetUnavailable: '目标区域暂时不可见，教程会在它出现后继续定位。',
  completedTitle: '教程完成',
  completedContent: '教程已经完成。',
  back: '上一步',
  skip: '跳过',
  next: '下一步',
  reset: '重置',
}

const defaultControls: DomTutorialRendererControls = {
  back: true,
  skip: true,
  next: true,
  reset: true,
}

const defaultKeyboard: DomTutorialRendererKeyboard = {
  escape: true,
  navigation: true,
}

type TargetState = {
  element?: Element
  rect: DOMRect
}

type BubblePlacementCandidate = {
  placement: TutorialPlacement
  left: number
  top: number
  overflow: number
}

let rendererId = 0

export class DomTutorialRenderer<TContext extends TutorialContext = TutorialContext> {
  private readonly root: HTMLDivElement
  private readonly highlight: HTMLDivElement
  private readonly bubble: HTMLDivElement
  private readonly unsubscribe: () => void
  private readonly labels: DomTutorialRendererLabels
  private readonly titleId: string
  private readonly contentId: string
  private readonly statusId: string
  private readonly targetUnavailableId: string
  private readonly resizeObserver?: ResizeObserver
  private readonly mutationObserver?: MutationObserver
  private observedTarget?: Element
  private snapshot?: TutorialSnapshot<TContext>
  private currentStepId?: string
  private lastAutoScrolledStepId?: string
  private lastAutoScrolledTarget?: Element
  private targetWasAvailable = false
  private renderFrame = 0
  private destroyed = false

  constructor(
    private readonly engine: TutorialEngine<TContext>,
    private readonly options: DomTutorialRendererOptions = {},
  ) {
    this.labels = { ...defaultLabels, ...options.labels }
    const id = ++rendererId
    this.titleId = `tutorial-renderer-${id}-title`
    this.contentId = `tutorial-renderer-${id}-content`
    this.statusId = `tutorial-renderer-${id}-status`
    this.targetUnavailableId = `tutorial-renderer-${id}-target-unavailable`

    this.root = document.createElement('div')
    this.root.className = 'tutorial-renderer'
    if (options.zIndex !== undefined) {
      this.root.style.zIndex = String(options.zIndex)
    }

    this.highlight = document.createElement('div')
    this.highlight.className = 'tutorial-highlight'

    this.bubble = document.createElement('div')
    this.bubble.className = 'tutorial-bubble'
    this.bubble.setAttribute('role', 'region')
    this.bubble.setAttribute('aria-live', 'polite')
    this.bubble.setAttribute('aria-atomic', 'true')

    this.root.append(this.highlight, this.bubble)
    const mount = options.mount ?? document.body
    mount.append(this.root)

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.scheduleRender)
    }

    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(this.handleMutations)
      this.mutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['aria-hidden', 'class', 'hidden', 'style'],
        childList: true,
        subtree: true,
      })
    }

    this.unsubscribe = this.engine.onChange((snapshot) => {
      this.snapshot = snapshot
      this.render()
    })

    window.addEventListener('resize', this.scheduleRender)
    window.addEventListener('scroll', this.scheduleRender, true)
    document.addEventListener('keydown', this.handleKeyDown)
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.unsubscribe()
    window.removeEventListener('resize', this.scheduleRender)
    window.removeEventListener('scroll', this.scheduleRender, true)
    document.removeEventListener('keydown', this.handleKeyDown)
    this.resizeObserver?.disconnect()
    this.mutationObserver?.disconnect()
    if (this.renderFrame) {
      this.cancelRenderFrame(this.renderFrame)
      this.renderFrame = 0
    }
    this.root.remove()
    this.destroyed = true
  }

  private render = (): void => {
    if (this.destroyed || !this.snapshot) {
      return
    }

    const { status, currentStep } = this.snapshot

    this.root.dataset.status = status

    if (status === 'idle' || status === 'skipped') {
      this.updateObservedTarget(undefined)
      this.root.hidden = true
      return
    }

    this.root.hidden = false

    if (status === 'completed') {
      this.updateObservedTarget(undefined)
      this.renderCompleted()
      return
    }

    if (!currentStep) {
      this.updateObservedTarget(undefined)
      this.root.hidden = true
      return
    }

    this.renderStep(currentStep)
  }

  private renderStep(step: TutorialStep<TContext>): void {
    this.resetStepStateIfNeeded(step.id)

    const target = this.getTarget(step.target)
    const targetMissing = Boolean(step.target) && !target

    this.updateObservedTarget(target?.element)
    this.scrollTargetIntoView(step, target)

    if (target) {
      this.positionHighlight(target.rect)
      this.highlight.hidden = false
    } else {
      this.highlight.hidden = true
    }

    this.bubble.hidden = false
    this.bubble.innerHTML = ''

    const title = document.createElement('h2')
    title.id = this.titleId
    title.textContent = step.title ?? this.labels.defaultTitle

    const content = document.createElement('p')
    content.id = this.contentId
    content.textContent = step.content

    const progress = document.createElement('div')
    progress.className = 'tutorial-progress'
    progress.textContent = this.labels.progress(
      this.snapshot!.currentStepIndex + 1,
      this.snapshot!.totalSteps,
    )

    const actions = this.createActions()
    const waiting = document.createElement('div')
    waiting.id = this.statusId
    waiting.className = 'tutorial-waiting'
    waiting.textContent = step.waitFor ? this.labels.waitingForAction : this.labels.canContinue

    const describedByIds = [this.contentId, this.statusId]

    this.bubble.append(progress, title, content, waiting)

    if (targetMissing) {
      const targetUnavailable = document.createElement('div')
      targetUnavailable.id = this.targetUnavailableId
      targetUnavailable.className = 'tutorial-target-unavailable'
      targetUnavailable.textContent = this.labels.targetUnavailable
      this.bubble.append(targetUnavailable)
      describedByIds.push(this.targetUnavailableId)
    }

    this.bubble.append(actions)
    this.setBubbleAccessibility(this.titleId, describedByIds)
    this.positionBubble(target?.rect, step.placement ?? 'bottom')
  }

  private renderCompleted(): void {
    this.highlight.hidden = true
    this.bubble.hidden = false
    this.bubble.innerHTML = ''
    this.bubble.style.left = '50%'
    this.bubble.style.top = '50%'
    this.bubble.style.transform = 'translate(-50%, -50%)'
    delete this.bubble.dataset.placement

    const title = document.createElement('h2')
    title.id = this.titleId
    title.textContent = this.options.completedTitle ?? this.labels.completedTitle

    const content = document.createElement('p')
    content.id = this.contentId
    content.textContent = this.options.completedContent ?? this.labels.completedContent

    const actions = document.createElement('div')
    actions.className = 'tutorial-actions'

    const reset = this.createButton(this.labels.reset, () => this.engine.reset(), 'secondary')
    actions.append(reset)

    this.bubble.append(title, content, actions)
    this.setBubbleAccessibility(this.titleId, [this.contentId])
  }

  private createActions(): HTMLDivElement {
    const actions = document.createElement('div')
    actions.className = 'tutorial-actions'

    const previous = this.createButton(this.labels.back, () => this.engine.prev(), 'secondary')
    previous.disabled = !this.snapshot!.canGoPrev

    const skip = this.createButton(this.labels.skip, () => this.engine.skip(), 'secondary')
    const next = this.createButton(this.labels.next, () => this.engine.next(), 'primary')
    next.disabled = !this.snapshot!.canGoNext

    const reset = this.createButton(this.labels.reset, () => this.engine.reset(), 'secondary')

    if (this.isControlEnabled('back')) {
      actions.append(previous)
    }

    if (this.isControlEnabled('skip')) {
      actions.append(skip)
    }

    if (this.isControlEnabled('next')) {
      actions.append(next)
    }

    if (this.isControlEnabled('reset')) {
      actions.append(reset)
    }

    return actions
  }

  private createButton(label: string, onClick: () => void, variant: 'primary' | 'secondary'): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `tutorial-button tutorial-button-${variant}`
    button.textContent = label
    button.title = label
    button.setAttribute('aria-label', label)
    button.addEventListener('click', onClick)
    return button
  }

  private getTarget(target?: TutorialTarget): TargetState | undefined {
    if (!target) {
      return undefined
    }

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

    if (this.isResolvedTarget(resolvedTarget)) {
      return resolvedTarget.rect ? resolvedTarget : undefined
    }

    const rect = resolvedTarget
    if (rect.width === 0 && rect.height === 0) {
      return undefined
    }

    return { rect }
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

  private isResolvedTarget(target: Element | DOMRect | TutorialResolvedTarget): target is TutorialResolvedTarget {
    return 'rect' in target
  }

  private positionHighlight(rect: DOMRect): void {
    const padding = 8
    this.highlight.style.left = `${Math.max(rect.left - padding, 8)}px`
    this.highlight.style.top = `${Math.max(rect.top - padding, 8)}px`
    this.highlight.style.width = `${rect.width + padding * 2}px`
    this.highlight.style.height = `${rect.height + padding * 2}px`
  }

  private positionBubble(rect: DOMRect | undefined, placement: TutorialPlacement): void {
    const bubbleRect = this.bubble.getBoundingClientRect()
    const gap = 18
    const margin = 16
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (!rect) {
      this.bubble.style.left = '50%'
      this.bubble.style.top = '50%'
      this.bubble.style.transform = 'translate(-50%, -50%)'
      delete this.bubble.dataset.placement
      return
    }

    const candidate = this.pickBubblePlacement(rect, bubbleRect, placement, gap, margin, viewportWidth, viewportHeight)
    const left = this.clamp(candidate.left, margin, Math.max(margin, viewportWidth - bubbleRect.width - margin))
    const top = this.clamp(candidate.top, margin, Math.max(margin, viewportHeight - bubbleRect.height - margin))

    this.bubble.style.left = `${left}px`
    this.bubble.style.top = `${top}px`
    this.bubble.style.transform = ''
    this.bubble.dataset.placement = candidate.placement
  }

  private pickBubblePlacement(
    targetRect: DOMRect,
    bubbleRect: DOMRect,
    preferredPlacement: TutorialPlacement,
    gap: number,
    margin: number,
    viewportWidth: number,
    viewportHeight: number,
  ): BubblePlacementCandidate {
    const placements = this.getPlacementOrder(preferredPlacement)
    const candidates = placements.map((placement) => (
      this.createBubblePlacementCandidate(
        targetRect,
        bubbleRect,
        placement,
        gap,
        margin,
        viewportWidth,
        viewportHeight,
      )
    ))

    return candidates.reduce((best, candidate) => {
      if (candidate.overflow === 0 && best.overflow !== 0) {
        return candidate
      }

      if (candidate.overflow === best.overflow) {
        return best
      }

      return candidate.overflow < best.overflow ? candidate : best
    })
  }

  private createBubblePlacementCandidate(
    targetRect: DOMRect,
    bubbleRect: DOMRect,
    placement: TutorialPlacement,
    gap: number,
    margin: number,
    viewportWidth: number,
    viewportHeight: number,
  ): BubblePlacementCandidate {
    let left = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2
    let top = targetRect.bottom + gap

    if (placement === 'top') {
      top = targetRect.top - bubbleRect.height - gap
    }

    if (placement === 'left') {
      left = targetRect.left - bubbleRect.width - gap
      top = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2
    }

    if (placement === 'right') {
      left = targetRect.right + gap
      top = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2
    }

    const overflowLeft = Math.max(0, margin - left)
    const overflowTop = Math.max(0, margin - top)
    const overflowRight = Math.max(0, left + bubbleRect.width + margin - viewportWidth)
    const overflowBottom = Math.max(0, top + bubbleRect.height + margin - viewportHeight)

    return {
      placement,
      left,
      top,
      overflow: overflowLeft + overflowTop + overflowRight + overflowBottom,
    }
  }

  private getPlacementOrder(preferredPlacement: TutorialPlacement): TutorialPlacement[] {
    if (preferredPlacement === 'top') {
      return ['top', 'bottom', 'right', 'left']
    }

    if (preferredPlacement === 'left') {
      return ['left', 'right', 'bottom', 'top']
    }

    if (preferredPlacement === 'right') {
      return ['right', 'left', 'bottom', 'top']
    }

    return ['bottom', 'top', 'right', 'left']
  }

  private resetStepStateIfNeeded(stepId: string): void {
    if (this.currentStepId === stepId) {
      return
    }

    this.currentStepId = stepId
    this.lastAutoScrolledStepId = undefined
    this.lastAutoScrolledTarget = undefined
    this.targetWasAvailable = false
  }

  private scrollTargetIntoView(step: TutorialStep<TContext>, target: TargetState | undefined): void {
    if (!target?.element) {
      this.targetWasAvailable = false
      return
    }

    const hadAvailableTarget = this.targetWasAvailable
    this.targetWasAvailable = true

    if (this.options.autoScroll === false) {
      return
    }

    const shouldScroll =
      !hadAvailableTarget ||
      this.lastAutoScrolledStepId !== step.id ||
      this.lastAutoScrolledTarget !== target.element

    if (!shouldScroll) {
      return
    }

    if (typeof target.element.scrollIntoView !== 'function') {
      return
    }

    target.element.scrollIntoView({
      behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
      inline: 'center',
    })
    this.lastAutoScrolledStepId = step.id
    this.lastAutoScrolledTarget = target.element
    this.scheduleRender()
  }

  private updateObservedTarget(target: Element | undefined): void {
    if (this.observedTarget === target) {
      return
    }

    if (this.observedTarget) {
      this.resizeObserver?.unobserve(this.observedTarget)
    }

    this.observedTarget = target

    if (target) {
      this.resizeObserver?.observe(target)
    }
  }

  private setBubbleAccessibility(labelledById: string, describedByIds: string[]): void {
    this.bubble.setAttribute('aria-labelledby', labelledById)
    this.bubble.setAttribute('aria-describedby', describedByIds.join(' '))
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || this.destroyed || !this.snapshot || this.root.hidden) {
      return
    }

    if (!this.isKeyboardEnabled()) {
      return
    }

    if (event.key === 'Escape' && this.isActiveStep() && this.isKeyboardEscapeEnabled()) {
      event.preventDefault()
      this.engine.skip()
      return
    }

    if (this.shouldIgnoreShortcutTarget(event.target)) {
      return
    }

    if (!this.isKeyboardNavigationEnabled()) {
      return
    }

    if (event.key === 'ArrowLeft' && this.snapshot.canGoPrev) {
      event.preventDefault()
      this.engine.prev()
      return
    }

    if ((event.key === 'ArrowRight' || event.key === 'Enter') && this.snapshot.canGoNext) {
      event.preventDefault()
      this.engine.next()
    }
  }

  private handleMutations = (mutations: MutationRecord[]): void => {
    if (!this.snapshot?.currentStep?.target || !this.isActiveStep()) {
      return
    }

    const onlyRendererMutations = mutations.every((mutation) => (
      mutation.target instanceof Node && this.root.contains(mutation.target)
    ))

    if (!onlyRendererMutations) {
      this.scheduleRender()
    }
  }

  private scheduleRender = (): void => {
    if (this.destroyed || this.renderFrame) {
      return
    }

    const render = () => {
      this.renderFrame = 0
      this.render()
    }

    this.renderFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(render)
      : window.setTimeout(render, 0)
  }

  private isActiveStep(): boolean {
    return this.snapshot?.status === 'running' || this.snapshot?.status === 'waiting'
  }

  private shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false
    }

    if (this.observedTarget?.contains(target)) {
      return true
    }

    if (target instanceof HTMLElement && target.isContentEditable) {
      return true
    }

    const interactiveTarget = target.closest(
      'a, button, input, textarea, select, summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="link"], [role="textbox"]',
    )

    return Boolean(interactiveTarget)
  }

  private prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  private isControlEnabled(control: keyof DomTutorialRendererControls): boolean {
    return this.options.controls?.[control] ?? defaultControls[control]
  }

  private isKeyboardEnabled(): boolean {
    return this.options.keyboard !== false
  }

  private isKeyboardEscapeEnabled(): boolean {
    if (typeof this.options.keyboard === 'object') {
      return this.options.keyboard.escape ?? defaultKeyboard.escape
    }

    return defaultKeyboard.escape
  }

  private isKeyboardNavigationEnabled(): boolean {
    if (typeof this.options.keyboard === 'object') {
      return this.options.keyboard.navigation ?? defaultKeyboard.navigation
    }

    return defaultKeyboard.navigation
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  private cancelRenderFrame(frame: number): void {
    if (typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(frame)
    }

    window.clearTimeout(frame)
  }
}
