import type {
  TutorialChangeListener,
  TutorialCompositeCondition,
  TutorialCondition,
  TutorialConditionCleanup,
  TutorialConditionCompleteOptions,
  TutorialConditionControls,
  TutorialConditionErrorListener,
  TutorialConditionHandler,
  TutorialConditionHandlers,
  TutorialContext,
  TutorialEngineOptions,
  TutorialLifecycleHandlers,
  TutorialSetStepsOptions,
  TutorialSnapshot,
  TutorialStateCondition,
  TutorialStep,
  TutorialStepLifecycleReason,
  TutorialStorage,
  TutorialStatus,
} from './types'

type StoredProgress = {
  status: TutorialStatus
  currentStepId?: string
}

type EnterCurrentStepOptions = {
  save?: boolean
  notify?: boolean
  lifecycle?: boolean
  reason?: TutorialStepLifecycleReason
}

type CompleteCurrentStepOptions = {
  reason: TutorialStepLifecycleReason
  complete: boolean
}

type AdvanceOptions = {
  completeCurrentStep?: boolean
}

export class TutorialEngine<TContext extends TutorialContext = TutorialContext> {
  private steps: Array<TutorialStep<TContext>>
  private readonly storageKey: string
  private readonly storage: TutorialStorage
  private readonly conditionHandlers: TutorialConditionHandlers<TContext>
  private readonly lifecycle?: TutorialLifecycleHandlers<TContext>
  private readonly onConditionError?: TutorialConditionErrorListener<TContext>
  private readonly listeners = new Set<TutorialChangeListener<TContext>>()
  private readonly eventQueue = new Map<string, unknown[]>()
  private readonly eventWaiters = new Map<string, Set<(payload: unknown) => void>>()
  private readonly stateEvaluators = new Set<() => void>()
  private status: TutorialStatus = 'idle'
  private currentStepIndex = -1
  private context: TContext
  private conditionCleanup?: TutorialConditionCleanup
  private conditionMet = false
  private destroyed = false
  private stateCheckToken = 0

  constructor(options: TutorialEngineOptions<TContext>) {
    this.steps = options.steps
    this.context = options.context ?? ({} as TContext)
    this.storageKey = options.storageKey ?? `tutorial:${options.id}:progress`
    this.storage = options.storage ?? getDefaultStorage()
    this.conditionHandlers = options.conditionHandlers ?? {}
    this.lifecycle = options.lifecycle
    this.onConditionError = options.onConditionError
    this.restoreProgress()

    if (this.status === 'running' || this.status === 'waiting') {
      this.enterCurrentStep({ save: false, notify: false, lifecycle: false })
    }
  }

  start(): void {
    if (this.destroyed || this.steps.length === 0) {
      return
    }

    if (this.status === 'paused') {
      this.resume()
      return
    }

    if (this.currentStepIndex < 0 || this.status === 'completed' || this.status === 'skipped') {
      this.currentStepIndex = 0
    }

    this.enterCurrentStep({ reason: 'start' })
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

    this.advance('next')
  }

  prev(): void {
    if (this.destroyed || this.currentStepIndex <= 0) {
      return
    }

    this.clearCondition()
    this.completeCurrentStep({ reason: 'prev', complete: false })
    this.currentStepIndex -= 1
    this.enterCurrentStep({ reason: 'prev' })
  }

  pause(): void {
    if (this.destroyed || !this.isActiveStep()) {
      return
    }

    this.clearCondition()
    this.completeCurrentStep({ reason: 'pause', complete: false })
    this.status = 'paused'
    this.saveProgress()
    this.notify()
  }

  resume(): void {
    if (this.destroyed || this.status !== 'paused') {
      return
    }

    if (!this.getCurrentStep()) {
      this.status = 'idle'
      this.saveProgress()
      this.notify()
      return
    }

    this.enterCurrentStep({ reason: 'resume' })
  }

  skip(): void {
    if (this.destroyed) {
      return
    }

    this.clearCondition()
    this.completeCurrentStep({ reason: 'skip', complete: false })
    this.status = 'skipped'
    this.saveProgress()
    this.notify()
  }

  finish(): void {
    if (this.destroyed) {
      return
    }

    this.completeTutorial('finish', true)
  }

  goToStep(stepId: string): void {
    if (this.destroyed) {
      return
    }

    const index = this.steps.findIndex((step) => step.id === stepId)
    if (index === -1) {
      return
    }

    this.clearCondition()
    this.completeCurrentStep({ reason: 'goToStep', complete: false })
    this.currentStepIndex = index
    this.enterCurrentStep({ reason: 'goToStep' })
  }

  setSteps(steps: Array<TutorialStep<TContext>>, options: TutorialSetStepsOptions = {}): void {
    if (this.destroyed) {
      return
    }

    const currentStep = this.getCurrentStep()
    const currentStepId = options.currentStepId
      ?? (options.preserveCurrentStep === false ? undefined : currentStep?.id)
    const nextIndex = currentStepId ? steps.findIndex((step) => step.id === currentStepId) : -1

    this.clearCondition()
    this.completeCurrentStep({ reason: 'setSteps', complete: false })
    this.steps = steps
    this.currentStepIndex = nextIndex

    if (this.steps.length === 0) {
      this.currentStepIndex = -1
      this.status = 'idle'
      this.saveProgress()
      this.notify()
      return
    }

    if (this.currentStepIndex === -1 && this.isActiveOrPausedStatus()) {
      this.currentStepIndex = 0
    }

    if (this.status === 'running' || this.status === 'waiting') {
      this.enterCurrentStep({ reason: 'setSteps' })
      return
    }

    this.saveProgress()
    this.notify()
  }

  getCurrentStep(): TutorialStep<TContext> | undefined {
    return this.steps[this.currentStepIndex]
  }

  getStatus(): TutorialStatus {
    return this.status
  }

  getSnapshot(): TutorialSnapshot<TContext> {
    return {
      status: this.status,
      currentStep: this.getCurrentStep(),
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.steps.length,
      canGoPrev: this.currentStepIndex > 0 && (this.status === 'running' || this.status === 'waiting'),
      canGoNext: this.canGoNext(),
    }
  }

  onChange(listener: TutorialChangeListener<TContext>): () => void {
    if (this.destroyed) {
      return () => undefined
    }

    this.listeners.add(listener)
    listener(this.getSnapshot())

    return () => {
      this.listeners.delete(listener)
    }
  }

  updateContext(context: TContext): void {
    if (this.destroyed) {
      return
    }

    this.context = context
    this.stateEvaluators.forEach((evaluate) => evaluate())
  }

  emit(name: string, payload?: unknown): void {
    if (this.destroyed) {
      return
    }

    const waiters = this.eventWaiters.get(name)
    if (waiters?.size) {
      Array.from(waiters).forEach((listener) => listener(payload))
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
    this.completeCurrentStep({ reason: 'reset', complete: false })
    this.currentStepIndex = -1
    this.status = 'idle'
    this.conditionMet = false
    this.storage.removeItem(this.storageKey)
    this.notify()
  }

  destroy(): void {
    this.clearCondition()
    this.listeners.clear()
    this.eventQueue.clear()
    this.eventWaiters.clear()
    this.stateEvaluators.clear()
    this.destroyed = true
  }

  private enterCurrentStep(options: EnterCurrentStepOptions = {}): void {
    const shouldSave = options.save ?? true
    const shouldNotify = options.notify ?? true
    const shouldRunLifecycle = options.lifecycle ?? true
    const reason = options.reason ?? 'start'

    this.clearCondition()
    this.conditionMet = false
    this.skipUnavailableSteps()

    const currentStep = this.getCurrentStep()

    if (!currentStep) {
      this.completeTutorial(reason, false)
      return
    }

    this.status = currentStep.waitFor ? 'waiting' : 'running'
    this.conditionCleanup = this.setupCondition(currentStep.waitFor)

    if (shouldSave) {
      this.saveProgress()
    }

    if (shouldNotify) {
      this.notify()
    }

    if (shouldRunLifecycle) {
      this.runStepLifecycle(currentStep, reason, currentStep.onEnter, this.lifecycle?.onStepEnter)
    }
  }

  private skipUnavailableSteps(): void {
    while (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex]
      if (!this.shouldSkipStep(step)) {
        return
      }

      this.currentStepIndex += 1
    }
  }

  private shouldSkipStep(step: TutorialStep<TContext>): boolean {
    try {
      if (step.showIf && !step.showIf(this.context)) {
        return true
      }

      return Boolean(step.skipIf?.(this.context))
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error(error)
      }
      return false
    }
  }

  private setupCondition(
    condition?: TutorialCondition<TContext>,
    onComplete: (options?: TutorialConditionCompleteOptions) => void = (options) => this.completeCondition(options),
  ): TutorialConditionCleanup | undefined {
    if (!condition) {
      return undefined
    }

    const conditionCleanup = this.setupConditionCore(condition, onComplete)
    if (condition.timeoutMs === undefined) {
      return conditionCleanup
    }

    const timeoutId = globalThis.setTimeout(() => {
      this.handleConditionTimeout(condition, onComplete)
    }, condition.timeoutMs)

    return () => {
      globalThis.clearTimeout(timeoutId)
      conditionCleanup?.()
    }
  }

  private setupConditionCore(
    condition: TutorialCondition<TContext>,
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): TutorialConditionCleanup | undefined {
    if (condition.type === 'event') {
      return this.setupEventCondition(condition.name, onComplete)
    }

    if (condition.type === 'state') {
      return this.setupStateCondition(condition, onComplete)
    }

    if (condition.type === 'allOf' || condition.type === 'anyOf') {
      return this.setupCompositeCondition(condition, onComplete)
    }

    const handler = this.getConditionHandler(condition)
    if (!handler) {
      this.reportConditionError(
        new Error(`No condition handler registered for "${this.getConditionHandlerKey(condition)}".`),
        condition,
      )
      return undefined
    }

    return this.runConditionHandler(handler, condition, onComplete)
  }

  private handleConditionTimeout(
    condition: TutorialCondition<TContext>,
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): void {
    if (this.destroyed || this.status !== 'waiting' || this.conditionMet) {
      return
    }

    const action = condition.onTimeout ?? 'stay'
    if (action === 'complete') {
      onComplete()
      return
    }

    if (action === 'skipStep') {
      this.advance('timeout', { completeCurrentStep: false })
      return
    }

    if (action === 'skipTutorial') {
      this.clearCondition()
      this.completeCurrentStep({ reason: 'timeout', complete: false })
      this.status = 'skipped'
      this.saveProgress()
      this.notify()
      return
    }

    this.reportConditionError(new Error(`Tutorial condition timed out after ${condition.timeoutMs}ms.`), condition)
  }

  private setupEventCondition(
    name: string,
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): TutorialConditionCleanup | undefined {
    const queuedEvents = this.eventQueue.get(name)
    if (queuedEvents?.length) {
      queuedEvents.shift()
      onComplete({ defer: true })
      return undefined
    }

    const listener = () => onComplete()
    const listeners = this.eventWaiters.get(name) ?? new Set<(payload: unknown) => void>()
    listeners.add(listener)
    this.eventWaiters.set(name, listeners)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.eventWaiters.delete(name)
      }
    }
  }

  private setupStateCondition(
    condition: TutorialStateCondition<TContext>,
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): TutorialConditionCleanup {
    const evaluate = () => {
      void this.evaluateStateCondition(condition, onComplete)
    }

    this.stateEvaluators.add(evaluate)
    evaluate()

    return () => {
      this.stateEvaluators.delete(evaluate)
    }
  }

  private setupCompositeCondition(
    condition: TutorialCompositeCondition<TContext>,
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): TutorialConditionCleanup | undefined {
    if (condition.conditions.length === 0) {
      onComplete({ defer: true })
      return undefined
    }

    if (condition.type === 'anyOf') {
      let completed = false
      const cleanups = condition.conditions.map((childCondition) => this.setupCondition(childCondition, (options) => {
        if (completed) {
          return
        }

        completed = true
        onComplete(options)
      }))

      return () => cleanups.forEach((cleanup) => cleanup?.())
    }

    const completedIndexes = new Set<number>()
    const cleanups = condition.conditions.map((childCondition, index) => this.setupCondition(childCondition, (options) => {
      completedIndexes.add(index)
      if (completedIndexes.size === condition.conditions.length) {
        onComplete(options)
      }
    }))

    return () => cleanups.forEach((cleanup) => cleanup?.())
  }

  private async evaluateStateCondition(
    condition: TutorialStateCondition<TContext>,
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): Promise<void> {
    if (this.status !== 'waiting') {
      return
    }

    const token = ++this.stateCheckToken

    try {
      const result = await condition.check(this.context)

      if (!this.destroyed && token === this.stateCheckToken && this.status === 'waiting' && result) {
        onComplete()
      }
    } catch (error) {
      if (!this.destroyed && token === this.stateCheckToken) {
        this.reportConditionError(error, condition)
      }
    }
  }

  private runConditionHandler(
    handler: TutorialConditionHandler<TContext>,
    condition: TutorialCondition<TContext>,
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): TutorialConditionCleanup | undefined {
    try {
      return handler(condition, this.createConditionControls(onComplete)) ?? undefined
    } catch (error) {
      this.reportConditionError(error, condition)
      return undefined
    }
  }

  private createConditionControls(
    onComplete: (options?: TutorialConditionCompleteOptions) => void,
  ): TutorialConditionControls<TContext> {
    return {
      complete: onComplete,
      emit: (name, payload) => this.emit(name, payload),
      getContext: () => this.context,
      getSnapshot: () => this.getSnapshot(),
      updateContext: (context) => this.updateContext(context),
    }
  }

  private completeCondition(options: TutorialConditionCompleteOptions = {}): void {
    if (options.defer) {
      globalThis.setTimeout(() => this.completeCondition(), 0)
      return
    }

    if (this.destroyed || this.conditionMet || this.status !== 'waiting') {
      return
    }

    this.conditionMet = true
    this.advance('next')
  }

  private advance(reason: TutorialStepLifecycleReason, options: AdvanceOptions = {}): void {
    const shouldCompleteCurrentStep = options.completeCurrentStep ?? true

    this.clearCondition()

    if (this.currentStepIndex >= this.steps.length - 1) {
      this.completeTutorial(reason, shouldCompleteCurrentStep)
      return
    }

    this.completeCurrentStep({ reason, complete: shouldCompleteCurrentStep })
    this.currentStepIndex += 1
    this.enterCurrentStep({ reason })
  }

  private completeTutorial(reason: TutorialStepLifecycleReason, completeCurrentStep: boolean): void {
    this.clearCondition()
    this.completeCurrentStep({ reason, complete: completeCurrentStep })
    this.status = 'completed'
    this.saveProgress()
    this.notify()
  }

  private completeCurrentStep(options: CompleteCurrentStepOptions): void {
    const currentStep = this.getCurrentStep()
    if (!currentStep) {
      return
    }

    if (options.complete) {
      this.runStepLifecycle(currentStep, options.reason, currentStep.onComplete, this.lifecycle?.onStepComplete)
    }

    this.runStepLifecycle(currentStep, options.reason, currentStep.onLeave, this.lifecycle?.onStepLeave)
  }

  private clearCondition(): void {
    this.stateCheckToken += 1
    this.conditionCleanup?.()
    this.conditionCleanup = undefined
    this.eventWaiters.clear()
    this.stateEvaluators.clear()
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

    this.storage.setItem(this.storageKey, JSON.stringify(progress))
  }

  private restoreProgress(): void {
    const rawProgress = this.storage.getItem(this.storageKey)
    if (!rawProgress) {
      return
    }

    try {
      const progress = JSON.parse(rawProgress) as Partial<StoredProgress>
      if (!this.isStoredStatus(progress.status)) {
        this.storage.removeItem(this.storageKey)
        return
      }

      this.status = progress.status
      this.currentStepIndex = progress.currentStepId
        ? this.steps.findIndex((step) => step.id === progress.currentStepId)
        : -1

      if (this.currentStepIndex === -1 && this.isActiveOrPausedStatus()) {
        this.status = 'idle'
      }
    } catch {
      this.storage.removeItem(this.storageKey)
    }
  }

  private canGoNext(): boolean {
    const currentStep = this.getCurrentStep()

    if (!currentStep || this.status !== 'running') {
      return false
    }

    return !currentStep.waitFor || this.conditionMet
  }

  private getConditionHandler(condition: TutorialCondition<TContext>): TutorialConditionHandler<TContext> | undefined {
    return this.conditionHandlers[this.getConditionHandlerKey(condition)]
  }

  private getConditionHandlerKey(condition: TutorialCondition<TContext>): string {
    return condition.type === 'custom' ? condition.name : condition.type
  }

  private reportConditionError(error: unknown, condition: TutorialCondition<TContext>): void {
    if (this.onConditionError) {
      this.onConditionError(error, condition, this.getSnapshot())
      return
    }

    if (typeof console !== 'undefined') {
      console.error(error)
    }
  }

  private runStepLifecycle(
    step: TutorialStep<TContext>,
    reason: TutorialStepLifecycleReason,
    ...listeners: Array<TutorialStep<TContext>['onEnter']>
  ): void {
    const event = {
      step,
      snapshot: this.getSnapshot(),
      reason,
    }

    listeners.forEach((listener) => {
      if (!listener) {
        return
      }

      void Promise.resolve(listener(event)).catch((error) => {
        if (typeof console !== 'undefined') {
          console.error(error)
        }
      })
    })
  }

  private isActiveStep(): boolean {
    return this.status === 'running' || this.status === 'waiting'
  }

  private isActiveOrPausedStatus(): boolean {
    return this.status === 'running' || this.status === 'waiting' || this.status === 'paused'
  }

  private isStoredStatus(status: unknown): status is TutorialStatus {
    return (
      status === 'idle'
      || status === 'running'
      || status === 'waiting'
      || status === 'paused'
      || status === 'completed'
      || status === 'skipped'
    )
  }
}

function getDefaultStorage(): TutorialStorage {
  if (typeof window === 'undefined') {
    throw new Error('TutorialEngine requires a storage implementation outside browser environments.')
  }

  return window.localStorage
}
