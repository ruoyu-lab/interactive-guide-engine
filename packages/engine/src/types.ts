export type TutorialStatus = 'idle' | 'running' | 'waiting' | 'paused' | 'completed' | 'skipped'

export type TutorialContext = Record<string, unknown>

export type TutorialValueMatcher = string | number | boolean | RegExp

export type TutorialSelectorTarget = {
  type: 'selector'
  value: string
}

export type TutorialRectTarget = {
  type: 'rect'
  getRect: () => DOMRect | undefined | null
}

export type TutorialVirtualTarget = {
  type: 'virtual'
  id: string
}

export type TutorialTarget = string | TutorialSelectorTarget | TutorialRectTarget | TutorialVirtualTarget

export type TutorialResolvedTarget = {
  element?: Element
  rect: DOMRect
}

export type TutorialConditionTimeoutAction = 'stay' | 'complete' | 'skipStep' | 'skipTutorial'

export type TutorialConditionOptions = {
  timeoutMs?: number
  onTimeout?: TutorialConditionTimeoutAction
}

export type TutorialEventCondition = TutorialConditionOptions & {
  type: 'event'
  name: string
}

export type TutorialStateCondition<TContext extends TutorialContext = TutorialContext> = TutorialConditionOptions & {
  type: 'state'
  check: (context: TContext) => boolean | Promise<boolean>
}

export type TutorialCompositeCondition<TContext extends TutorialContext = TutorialContext> =
  | (TutorialConditionOptions & { type: 'allOf'; conditions: Array<TutorialCondition<TContext>> })
  | (TutorialConditionOptions & { type: 'anyOf'; conditions: Array<TutorialCondition<TContext>> })

export type TutorialDomCondition = TutorialConditionOptions & (
  | { type: 'click'; target: TutorialTarget }
  | { type: 'input'; target: TutorialTarget; value?: TutorialValueMatcher }
  | { type: 'change'; target: TutorialTarget; value?: TutorialValueMatcher }
  | { type: 'focus'; target: TutorialTarget }
  | { type: 'blur'; target: TutorialTarget }
  | { type: 'submit'; target: TutorialTarget }
  | { type: 'hover'; target: TutorialTarget }
  | { type: 'keyboard'; target?: TutorialTarget; key?: string; code?: string }
  | { type: 'visible'; target: TutorialTarget }
  | { type: 'exists'; target: TutorialTarget }
  | { type: 'url'; value: string | RegExp }
  | { type: 'route'; path: string | RegExp }
  | { type: 'drag'; source: TutorialTarget; target?: TutorialTarget }
  | { type: 'drop'; target: TutorialTarget; source?: TutorialTarget }
)

export type TutorialCustomCondition = TutorialConditionOptions & {
  type: 'custom'
  name: string
  data?: unknown
}

export type TutorialCondition<TContext extends TutorialContext = TutorialContext> =
  | TutorialEventCondition
  | TutorialStateCondition<TContext>
  | TutorialCompositeCondition<TContext>
  | TutorialDomCondition
  | TutorialCustomCondition

export type TutorialCursorStyle =
  | 'macos'
  | 'macos-dark'
  | 'glass'
  | 'ring'
  | 'touch'
  | 'dot'
  | (string & {})

export type TutorialEffectTiming = {
  delayMs?: number
  durationMs?: number
  cursorStyle?: TutorialCursorStyle
}

export type TutorialCursorMoveEffect = TutorialEffectTiming & {
  type: 'cursorMove'
  target: TutorialTarget
}

export type TutorialCursorClickEffect = TutorialEffectTiming & {
  type: 'cursorClick'
  target: TutorialTarget
}

export type TutorialTypeTextEffect = TutorialEffectTiming & {
  type: 'typeText'
  target: TutorialTarget
  text: string
  speedMs?: number
  mode?: 'preview' | 'ghost' | 'perform'
}

export type TutorialCursorDragEffect = TutorialEffectTiming & {
  type: 'cursorDrag'
  source: TutorialTarget
  target: TutorialTarget
}

export type TutorialPulseEffect = TutorialEffectTiming & {
  type: 'pulse'
  target: TutorialTarget
}

export type TutorialShakeEffect = TutorialEffectTiming & {
  type: 'shake'
  target: TutorialTarget
}

export type TutorialEffect =
  | TutorialCursorMoveEffect
  | TutorialCursorClickEffect
  | TutorialTypeTextEffect
  | TutorialCursorDragEffect
  | TutorialPulseEffect
  | TutorialShakeEffect

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right'

export type TutorialStepPredicate<TContext extends TutorialContext = TutorialContext> = (context: TContext) => boolean

export type TutorialStepLifecycleReason =
  | 'start'
  | 'next'
  | 'prev'
  | 'goToStep'
  | 'setSteps'
  | 'resume'
  | 'pause'
  | 'skip'
  | 'finish'
  | 'reset'
  | 'timeout'

export type TutorialStepLifecycleEvent<TContext extends TutorialContext = TutorialContext> = {
  step: TutorialStep<TContext>
  snapshot: TutorialSnapshot<TContext>
  reason: TutorialStepLifecycleReason
}

export type TutorialStepLifecycleListener<TContext extends TutorialContext = TutorialContext> = (
  event: TutorialStepLifecycleEvent<TContext>
) => void | Promise<void>

export type TutorialLifecycleHandlers<TContext extends TutorialContext = TutorialContext> = {
  onStepEnter?: TutorialStepLifecycleListener<TContext>
  onStepLeave?: TutorialStepLifecycleListener<TContext>
  onStepComplete?: TutorialStepLifecycleListener<TContext>
}

export type TutorialStep<TContext extends TutorialContext = TutorialContext> = {
  id: string
  title?: string
  content: string
  target?: TutorialTarget
  placement?: TutorialPlacement
  waitFor?: TutorialCondition<TContext>
  effects?: TutorialEffect[]
  showIf?: TutorialStepPredicate<TContext>
  skipIf?: TutorialStepPredicate<TContext>
  onEnter?: TutorialStepLifecycleListener<TContext>
  onLeave?: TutorialStepLifecycleListener<TContext>
  onComplete?: TutorialStepLifecycleListener<TContext>
}

export type TutorialSnapshot<TContext extends TutorialContext = TutorialContext> = {
  status: TutorialStatus
  currentStep?: TutorialStep<TContext>
  currentStepIndex: number
  totalSteps: number
  canGoPrev: boolean
  canGoNext: boolean
}

export type TutorialChangeListener<TContext extends TutorialContext = TutorialContext> = (
  snapshot: TutorialSnapshot<TContext>
) => void

export type TutorialStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type TutorialConditionCompleteOptions = {
  defer?: boolean
}

export type TutorialConditionCleanup = () => void

export type TutorialConditionControls<TContext extends TutorialContext = TutorialContext> = {
  complete(options?: TutorialConditionCompleteOptions): void
  emit(name: string, payload?: unknown): void
  getContext(): TContext
  getSnapshot(): TutorialSnapshot<TContext>
  updateContext(context: TContext): void
}

export type TutorialConditionHandler<TContext extends TutorialContext = TutorialContext> = (
  condition: TutorialCondition<TContext>,
  controls: TutorialConditionControls<TContext>,
) => void | TutorialConditionCleanup

export type TutorialConditionHandlers<TContext extends TutorialContext = TutorialContext> = Record<
  string,
  TutorialConditionHandler<TContext> | undefined
>

export type TutorialConditionErrorListener<TContext extends TutorialContext = TutorialContext> = (
  error: unknown,
  condition: TutorialCondition<TContext>,
  snapshot: TutorialSnapshot<TContext>,
) => void

export type TutorialEngineOptions<TContext extends TutorialContext = TutorialContext> = {
  id: string
  steps: Array<TutorialStep<TContext>>
  context?: TContext
  storageKey?: string
  storage?: TutorialStorage
  conditionHandlers?: TutorialConditionHandlers<TContext>
  lifecycle?: TutorialLifecycleHandlers<TContext>
  onConditionError?: TutorialConditionErrorListener<TContext>
}

export type TutorialSetStepsOptions = {
  currentStepId?: string
  preserveCurrentStep?: boolean
}
