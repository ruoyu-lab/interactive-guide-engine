import { describe, expect, it } from 'vitest'
import { TutorialEngine } from '../../packages/engine/src'
import type { TutorialSnapshot, TutorialStep, TutorialStorage } from '../../packages/engine/src'

type MemoryStorage = TutorialStorage & {
  read(key: string): string | null
}

function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const data = new Map<string, string>(Object.entries(initial))

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
    read: (key) => data.get(key) ?? null,
  }
}

function readProgress(storage: MemoryStorage, key: string): unknown {
  const rawProgress = storage.read(key)
  return rawProgress ? JSON.parse(rawProgress) : null
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const basicSteps: TutorialStep[] = [
  { id: 'intro', content: 'Intro' },
  { id: 'details', content: 'Details' },
  { id: 'done', content: 'Done' },
]

describe('TutorialEngine', () => {
  it('handles start, next, prev, goToStep, finish, reset, and skip', () => {
    const storage = createMemoryStorage()
    const engine = new TutorialEngine({ id: 'core', steps: basicSteps, storage })
    const changes: TutorialSnapshot[] = []
    engine.onChange((snapshot) => changes.push(snapshot))

    expect(engine.getSnapshot()).toMatchObject({
      status: 'idle',
      currentStepIndex: -1,
      totalSteps: 3,
      canGoNext: false,
    })

    engine.start()
    expect(engine.getStatus()).toBe('running')
    expect(engine.getCurrentStep()?.id).toBe('intro')
    expect(engine.getSnapshot()).toMatchObject({
      currentStepIndex: 0,
      canGoPrev: false,
      canGoNext: true,
    })

    engine.next()
    expect(engine.getCurrentStep()?.id).toBe('details')
    expect(engine.getSnapshot()).toMatchObject({
      currentStepIndex: 1,
      canGoPrev: true,
      canGoNext: true,
    })

    engine.prev()
    expect(engine.getCurrentStep()?.id).toBe('intro')

    engine.goToStep('done')
    expect(engine.getCurrentStep()?.id).toBe('done')

    engine.goToStep('missing')
    expect(engine.getCurrentStep()?.id).toBe('done')

    engine.finish()
    expect(engine.getStatus()).toBe('completed')
    expect(readProgress(storage, 'tutorial:core:progress')).toEqual({
      status: 'completed',
      currentStepId: 'done',
    })

    engine.reset()
    expect(engine.getSnapshot()).toMatchObject({
      status: 'idle',
      currentStepIndex: -1,
      canGoPrev: false,
      canGoNext: false,
    })
    expect(storage.read('tutorial:core:progress')).toBeNull()

    engine.start()
    engine.skip()
    expect(engine.getStatus()).toBe('skipped')
    expect(readProgress(storage, 'tutorial:core:progress')).toEqual({
      status: 'skipped',
      currentStepId: 'intro',
    })
    expect(changes.map((snapshot) => snapshot.status)).toEqual([
      'idle',
      'running',
      'running',
      'running',
      'running',
      'completed',
      'idle',
      'running',
      'skipped',
    ])
  })

  it('blocks next while a waitFor condition is unmet', () => {
    const storage = createMemoryStorage()
    const engine = new TutorialEngine({
      id: 'wait',
      storage,
      steps: [
        { id: 'gate', content: 'Gate', waitFor: { type: 'event', name: 'ready' } },
        { id: 'after', content: 'After' },
      ],
    })

    engine.start()
    expect(engine.getSnapshot()).toMatchObject({
      status: 'waiting',
      currentStepIndex: 0,
      canGoNext: false,
    })

    engine.next()
    expect(engine.getSnapshot()).toMatchObject({
      status: 'waiting',
      currentStepIndex: 0,
      canGoNext: false,
    })
    expect(readProgress(storage, 'tutorial:wait:progress')).toEqual({
      status: 'waiting',
      currentStepId: 'gate',
    })
  })

  it('advances when an event condition is emitted', () => {
    const engine = new TutorialEngine({
      id: 'event',
      storage: createMemoryStorage(),
      steps: [
        { id: 'gate', content: 'Gate', waitFor: { type: 'event', name: 'ready' } },
        { id: 'after', content: 'After' },
      ],
    })

    engine.start()
    engine.emit('other')
    expect(engine.getSnapshot()).toMatchObject({
      status: 'waiting',
      currentStepIndex: 0,
    })

    engine.emit('ready')
    expect(engine.getSnapshot()).toMatchObject({
      status: 'running',
      currentStepIndex: 1,
      canGoPrev: true,
      canGoNext: true,
    })
    expect(engine.getCurrentStep()?.id).toBe('after')
  })

  it('advances when a state condition becomes true', async () => {
    const engine = new TutorialEngine({
      id: 'state',
      storage: createMemoryStorage(),
      context: { ready: false },
      steps: [
        {
          id: 'gate',
          content: 'Gate',
          waitFor: {
            type: 'state',
            check: (context) => context.ready === true,
          },
        },
        { id: 'after', content: 'After' },
      ],
    })

    engine.start()
    await flushPromises()
    expect(engine.getSnapshot()).toMatchObject({
      status: 'waiting',
      currentStepIndex: 0,
    })

    engine.next()
    expect(engine.getSnapshot()).toMatchObject({
      status: 'waiting',
      currentStepIndex: 0,
    })

    engine.updateContext({ ready: true })
    await flushPromises()
    expect(engine.getSnapshot()).toMatchObject({
      status: 'running',
      currentStepIndex: 1,
    })
  })

  it('restores progress from injected storage', () => {
    const storage = createMemoryStorage()
    const engine = new TutorialEngine({ id: 'restore', steps: basicSteps, storage })

    engine.start()
    engine.goToStep('details')

    const restored = new TutorialEngine({ id: 'restore', steps: basicSteps, storage })
    expect(restored.getSnapshot()).toMatchObject({
      status: 'running',
      currentStepIndex: 1,
      totalSteps: 3,
      canGoPrev: true,
      canGoNext: true,
    })
    expect(restored.getCurrentStep()?.id).toBe('details')
  })

  it('does not respond after destroy', () => {
    const engine = new TutorialEngine({
      id: 'destroy',
      storage: createMemoryStorage(),
      steps: [
        { id: 'gate', content: 'Gate', waitFor: { type: 'event', name: 'ready' } },
        { id: 'after', content: 'After' },
      ],
    })
    const changes: TutorialSnapshot[] = []
    engine.onChange((snapshot) => changes.push(snapshot))

    engine.start()
    const beforeDestroy = engine.getSnapshot()

    engine.destroy()
    engine.emit('ready')
    engine.next()
    engine.prev()
    engine.skip()
    engine.finish()
    engine.reset()
    engine.goToStep('after')

    expect(engine.getSnapshot()).toEqual(beforeDestroy)
    expect(changes.map((snapshot) => snapshot.status)).toEqual(['idle', 'waiting'])

    let calledAfterDestroy = false
    engine.onChange(() => {
      calledAfterDestroy = true
    })
    expect(calledAfterDestroy).toBe(false)
  })
})
