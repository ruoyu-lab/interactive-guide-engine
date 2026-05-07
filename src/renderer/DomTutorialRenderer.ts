import type { TutorialEngine } from '../engine'
import type { TutorialPlacement, TutorialSnapshot, TutorialStep } from '../engine'

export type DomTutorialRendererOptions = {
  completedTitle?: string
  completedContent?: string
}

export class DomTutorialRenderer {
  private readonly root: HTMLDivElement
  private readonly highlight: HTMLDivElement
  private readonly bubble: HTMLDivElement
  private readonly unsubscribe: () => void
  private snapshot?: TutorialSnapshot
  private destroyed = false

  constructor(
    private readonly engine: TutorialEngine,
    private readonly options: DomTutorialRendererOptions = {},
  ) {
    this.root = document.createElement('div')
    this.root.className = 'tutorial-renderer'

    this.highlight = document.createElement('div')
    this.highlight.className = 'tutorial-highlight'

    this.bubble = document.createElement('div')
    this.bubble.className = 'tutorial-bubble'

    this.root.append(this.highlight, this.bubble)
    document.body.append(this.root)

    this.unsubscribe = this.engine.onChange((snapshot) => {
      this.snapshot = snapshot
      this.render()
    })

    window.addEventListener('resize', this.render)
    window.addEventListener('scroll', this.render, true)
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.unsubscribe()
    window.removeEventListener('resize', this.render)
    window.removeEventListener('scroll', this.render, true)
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
      this.root.hidden = true
      return
    }

    this.root.hidden = false

    if (status === 'completed') {
      this.renderCompleted()
      return
    }

    if (!currentStep) {
      this.root.hidden = true
      return
    }

    this.renderStep(currentStep)
  }

  private renderStep(step: TutorialStep): void {
    const targetRect = this.getTargetRect(step.target)

    if (targetRect) {
      this.positionHighlight(targetRect)
      this.highlight.hidden = false
    } else {
      this.highlight.hidden = true
    }

    this.bubble.hidden = false
    this.bubble.innerHTML = ''

    const title = document.createElement('h2')
    title.textContent = step.title ?? 'Tutorial'

    const content = document.createElement('p')
    content.textContent = step.content

    const progress = document.createElement('div')
    progress.className = 'tutorial-progress'
    progress.textContent = `Step ${this.snapshot!.currentStepIndex + 1} of ${this.snapshot!.totalSteps}`

    const actions = this.createActions()
    const waiting = document.createElement('div')
    waiting.className = 'tutorial-waiting'
    waiting.textContent = step.waitFor ? 'Waiting for the highlighted action...' : 'You can continue when ready.'

    this.bubble.append(progress, title, content, waiting, actions)
    this.positionBubble(targetRect, step.placement ?? 'bottom')
  }

  private renderCompleted(): void {
    this.highlight.hidden = true
    this.bubble.hidden = false
    this.bubble.innerHTML = ''
    this.bubble.style.left = '50%'
    this.bubble.style.top = '50%'
    this.bubble.style.transform = 'translate(-50%, -50%)'

    const title = document.createElement('h2')
    title.textContent = this.options.completedTitle ?? 'Tutorial completed'

    const content = document.createElement('p')
    content.textContent = this.options.completedContent ?? 'The tutorial is complete.'

    const actions = document.createElement('div')
    actions.className = 'tutorial-actions'

    const reset = this.createButton('Reset', () => this.engine.reset(), 'secondary')
    actions.append(reset)

    this.bubble.append(title, content, actions)
  }

  private createActions(): HTMLDivElement {
    const actions = document.createElement('div')
    actions.className = 'tutorial-actions'

    const previous = this.createButton('Back', () => this.engine.prev(), 'secondary')
    previous.disabled = !this.snapshot!.canGoPrev

    const skip = this.createButton('Skip', () => this.engine.skip(), 'secondary')
    const next = this.createButton('Next', () => this.engine.next(), 'primary')
    next.disabled = !this.snapshot!.canGoNext

    const reset = this.createButton('Reset', () => this.engine.reset(), 'secondary')

    actions.append(previous, skip, next, reset)
    return actions
  }

  private createButton(label: string, onClick: () => void, variant: 'primary' | 'secondary'): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `tutorial-button tutorial-button-${variant}`
    button.textContent = label
    button.addEventListener('click', onClick)
    return button
  }

  private getTargetRect(selector?: string): DOMRect | undefined {
    if (!selector) {
      return undefined
    }

    const target = document.querySelector(selector)
    if (!target) {
      return undefined
    }

    const rect = target.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      return undefined
    }

    return rect
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

    if (!rect) {
      this.bubble.style.left = '50%'
      this.bubble.style.top = '50%'
      this.bubble.style.transform = 'translate(-50%, -50%)'
      return
    }

    let left = rect.left
    let top = rect.bottom + gap
    let transform = ''

    if (placement === 'top') {
      top = rect.top - bubbleRect.height - gap
    }

    if (placement === 'left') {
      left = rect.left - bubbleRect.width - gap
      top = rect.top + rect.height / 2 - bubbleRect.height / 2
    }

    if (placement === 'right') {
      left = rect.right + gap
      top = rect.top + rect.height / 2 - bubbleRect.height / 2
    }

    if (placement === 'bottom' || placement === 'top') {
      left = rect.left + rect.width / 2 - bubbleRect.width / 2
    }

    left = Math.min(Math.max(left, margin), window.innerWidth - bubbleRect.width - margin)
    top = Math.min(Math.max(top, margin), window.innerHeight - bubbleRect.height - margin)

    this.bubble.style.left = `${left}px`
    this.bubble.style.top = `${top}px`
    this.bubble.style.transform = transform
  }
}
