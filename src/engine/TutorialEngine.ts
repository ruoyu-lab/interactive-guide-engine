import type {
  TutorialChangeListener,
  TutorialCondition,
  TutorialContext,
  TutorialEngineOptions,
  TutorialSnapshot,
  TutorialStatus,
  TutorialStep,
} from './types'

type StoredProgress = {
  status: TutorialStatus
  currentStepId?: string
}

export class TutorialEngine {
  private readonly steps: TutorialStep[]
  private readonly storageKey: string
  private readonly listeners = new Set<TutorialChangeListener>()
  private readonly eventQueue = new Map<string, unknown[]>()
  private status: TutorialStatus = 'idle'
  private currentStepIndex = -1
  private context: TutorialContext
  private conditionCleanup?: () => void
  private conditionMet = false
  private destroyed = false
  private stateCheckToken = 0

  constructor(options: TutorialEngineOptions) {
    this.steps = options.steps
    this.context = options.context ?? {}
    this.storageKey = options.storageKey ?? `tutorial:${options.id}:progress`
    this.restoreProgress()

    if (this.status === 'running' || this.status === 'waiting') {
      this.enterCurrentStep({ save: false, notify: false })
    }
  }

  start(): void {
    if (this.destroyed || this.steps.length === 0) {
      return
    }

    if (this.currentStepIndex < 0 || this.status === 'completed' || this.status === 'skipped') {
      this.currentStepIndex = 0
    }

    this.enterCurrentStep()
  }

  next(): void {
    if (this.destroyed) {
      return
    }

    const currentStep = this.getCurrentStep()
    if (!currentStep) {
      this.start()
      return
    }

    if (currentStep.waitFor && !this.conditionMet) {
      this.status = 'waiting'
      this.saveProgress()
      this.notify()
      return
    }

    this.advance()
  }

  prev(): void {
    if (this.destroyed || this.currentStepIndex <= 0) {
      return
    }

    this.currentStepIndex -= 1
    this.enterCurrentStep()
  }

  skip(): void {
    if (this.destroyed) {
      return
    }

    this.clearCondition()
    this.status = 'skipped'
    this.saveProgress()
    this.notify()
  }

  finish(): void {
    if (this.destroyed) {
      return
    }

    this.clearCondition()
    this.status = 'completed'
    this.saveProgress()
    this.notify()
  }

  goToStep(stepId: string): void {
    if (this.destroyed) {
      return
    }

    const index = this.steps.findIndex((step) => step.id === stepId)
    if (index === -1) {
      return
    }

    this.currentStepIndex = index
    this.enterCurrentStep()
  }

  getCurrentStep(): TutorialStep | undefined {
    return this.steps[this.currentStepIndex]
  }

  getStatus(): TutorialStatus {
    return this.status
  }

  getSnapshot(): TutorialSnapshot {
    return {
      status: this.status,
      currentStep: this.getCurrentStep(),
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.steps.length,
      canGoPrev: this.currentStepIndex > 0 && (this.status === 'running' || this.status === 'waiting'),
      canGoNext: this.canGoNext(),
    }
  }

  onChange(listener: TutorialChangeListener): () => void {
    if (this.destroyed) {
      return () => undefined
    }

    this.listeners.add(listener)
    listener(this.getSnapshot())

    return () => {
      this.listeners.delete(listener)
    }
  }

  updateContext(context: TutorialContext): void {
    if (this.destroyed) {
      return
    }

    this.context = context
    void this.evaluateStateCondition()
  }

  emit(name: string, payload?: unknown): void {
    if (this.destroyed) {
      return
    }

    const currentStep = this.getCurrentStep()
    if (currentStep?.waitFor?.type === 'event' && currentStep.waitFor.name === name) {
      this.completeCondition()
      return
    }

    const queuedEvents = this.eventQueue.get(name) ?? []
    queuedEvents.push(payload)
    this.eventQueue.set(name, queuedEvents)
  }

  reset(): void {
    if (this.destroyed) {
      return
    }

    this.clearCondition()
    this.currentStepIndex = -1
    this.status = 'idle'
    this.conditionMet = false
    window.localStorage.removeItem(this.storageKey)
    this.notify()
  }

  destroy(): void {
    this.clearCondition()
    this.listeners.clear()
    this.eventQueue.clear()
    this.destroyed = true
  }

  private enterCurrentStep(options: { save?: boolean; notify?: boolean } = {}): void {
    const shouldSave = options.save ?? true
    const shouldNotify = options.notify ?? true
    const currentStep = this.getCurrentStep()

    this.clearCondition()
    this.conditionMet = false

    if (!currentStep) {
      this.finish()
      return
    }

    this.status = currentStep.waitFor ? 'waiting' : 'running'
    this.setupCondition(currentStep.waitFor)

    if (shouldSave) {
      this.saveProgress()
    }

    if (shouldNotify) {
      this.notify()
    }
  }

  private setupCondition(condition?: TutorialCondition): void {
    if (!condition) {
      return
    }

    if (condition.type === 'click') {
      const handleClick = (event: MouseEvent) => {
        if (this.matchesTarget(event.target, condition.target)) {
          this.completeConditionAfterCurrentEvent()
        }
      }

      document.addEventListener('click', handleClick, true)
      this.conditionCleanup = () => {
        document.removeEventListener('click', handleClick, true)
      }
      return
    }

    if (condition.type === 'input') {
      const handleInput = (event: Event) => {
        if (!this.matchesTarget(event.target, condition.target)) {
          return
        }

        const element = event.target
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
          return
        }

        if (this.valueMatches(element.value, condition.value)) {
          this.completeConditionAfterCurrentEvent()
        }
      }

      document.addEventListener('input', handleInput, true)
      document.addEventListener('change', handleInput, true)
      this.conditionCleanup = () => {
        document.removeEventListener('input', handleInput, true)
        document.removeEventListener('change', handleInput, true)
      }
      return
    }

    if (condition.type === 'event') {
      const queuedEvents = this.eventQueue.get(condition.name)
      if (queuedEvents?.length) {
        queuedEvents.shift()
        this.completeCondition()
      }
      return
    }

    void this.evaluateStateCondition()
  }

  private async evaluateStateCondition(): Promise<void> {
    const currentStep = this.getCurrentStep()
    const condition = currentStep?.waitFor
    if (!condition || condition.type !== 'state' || this.status !== 'waiting') {
      return
    }

    const token = ++this.stateCheckToken
    const result = await condition.check(this.context)

    if (!this.destroyed && token === this.stateCheckToken && result) {
      this.completeCondition()
    }
  }

  private completeCondition(): void {
    if (this.destroyed || this.conditionMet || this.status !== 'waiting') {
      return
    }

    this.conditionMet = true
    this.advance()
  }

  private completeConditionAfterCurrentEvent(): void {
    window.setTimeout(() => this.completeCondition(), 0)
  }

  private advance(): void {
    this.clearCondition()

    if (this.currentStepIndex >= this.steps.length - 1) {
      this.finish()
      return
    }

    this.currentStepIndex += 1
    this.enterCurrentStep()
  }

  private clearCondition(): void {
    this.stateCheckToken += 1
    this.conditionCleanup?.()
    this.conditionCleanup = undefined
  }

  private notify(): void {
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private saveProgress(): void {
    const currentStep = this.getCurrentStep()
    const progress: StoredProgress = {
      status: this.status,
      currentStepId: currentStep?.id,
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(progress))
  }

  private restoreProgress(): void {
    const rawProgress = window.localStorage.getItem(this.storageKey)
    if (!rawProgress) {
      return
    }

    const progress = JSON.parse(rawProgress) as StoredProgress
    this.status = progress.status
    this.currentStepIndex = progress.currentStepId
      ? this.steps.findIndex((step) => step.id === progress.currentStepId)
      : -1

    if (this.currentStepIndex === -1 && (this.status === 'running' || this.status === 'waiting')) {
      this.status = 'idle'
    }
  }

  private canGoNext(): boolean {
    const currentStep = this.getCurrentStep()

    if (!currentStep || this.status !== 'running') {
      return false
    }

    return !currentStep.waitFor || this.conditionMet
  }

  private matchesTarget(target: EventTarget | null, selector: string): boolean {
    if (!(target instanceof Element)) {
      return false
    }

    return Boolean(target.closest(selector))
  }

  private valueMatches(value: string, expected?: string | RegExp): boolean {
    if (expected === undefined) {
      return value.length > 0
    }

    if (expected instanceof RegExp) {
      return expected.test(value)
    }

    return value === expected
  }
}
