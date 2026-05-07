export type TutorialStatus = 'idle' | 'running' | 'waiting' | 'completed' | 'skipped'

export type TutorialContext = Record<string, unknown>

export type TutorialCondition =
  | { type: 'click'; target: string }
  | { type: 'input'; target: string; value?: string | RegExp }
  | { type: 'event'; name: string }
  | { type: 'state'; check: (context: TutorialContext) => boolean | Promise<boolean> }

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right'

export type TutorialStep = {
  id: string
  title?: string
  content: string
  target?: string
  placement?: TutorialPlacement
  waitFor?: TutorialCondition
}

export type TutorialSnapshot = {
  status: TutorialStatus
  currentStep?: TutorialStep
  currentStepIndex: number
  totalSteps: number
  canGoPrev: boolean
  canGoNext: boolean
}

export type TutorialChangeListener = (snapshot: TutorialSnapshot) => void

export type TutorialStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type TutorialEngineOptions = {
  id: string
  steps: TutorialStep[]
  context?: TutorialContext
  storageKey?: string
  storage?: TutorialStorage
}
