import type {
  TutorialCondition,
  TutorialConditionCleanup,
  TutorialConditionHandlers,
  TutorialContext,
  TutorialTarget,
  TutorialValueMatcher,
} from '../../engine/src'

export type DomConditionAdapterOptions = {
  root?: ParentNode
  window?: DomConditionWindow
  targetResolver?: (target: TutorialTarget) => Element | null
  pollIntervalMs?: number
}

type DomEventTarget = Document | Window | Element
export type DomConditionWindow = Window & typeof globalThis

export function createDomConditionHandlers<TContext extends TutorialContext = TutorialContext>(
  options: DomConditionAdapterOptions = {},
): TutorialConditionHandlers<TContext> {
  const getWindow = () => options.window ?? window
  const getDocument = () => getWindow().document
  const getRoot = () => options.root ?? getDocument()
  const resolveTarget = (target: TutorialTarget) => {
    const resolvedTarget = options.targetResolver?.(target)
    if (resolvedTarget) {
      return resolvedTarget
    }

    const selector = getTargetSelector(target)
    return selector ? getRoot().querySelector(selector) : null
  }

  return {
    click: (condition, controls) => {
      if (condition.type !== 'click') {
        return undefined
      }

      return listen(getDocument(), 'click', (event) => {
        if (matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          controls.complete({ defer: true })
        }
      }, true)
    },
    input: (condition, controls) => {
      if (condition.type !== 'input') {
        return undefined
      }

      const completeIfMatched = (event: Event) => {
        if (!matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          return
        }

        const value = readControlValue(event.target, getWindow())
        if (matchesValue(value, condition.value, true)) {
          controls.complete({ defer: true })
        }
      }

      return combineCleanups(
        listen(getDocument(), 'input', completeIfMatched, true),
        listen(getDocument(), 'change', completeIfMatched, true),
      )
    },
    change: (condition, controls) => {
      if (condition.type !== 'change') {
        return undefined
      }

      return listen(getDocument(), 'change', (event) => {
        if (!matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          return
        }

        if (matchesValue(readControlValue(event.target, getWindow()), condition.value, false)) {
          controls.complete({ defer: true })
        }
      }, true)
    },
    focus: (condition, controls) => {
      if (condition.type !== 'focus') {
        return undefined
      }

      return listen(getDocument(), 'focusin', (event) => {
        if (matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          controls.complete()
        }
      }, true)
    },
    blur: (condition, controls) => {
      if (condition.type !== 'blur') {
        return undefined
      }

      return listen(getDocument(), 'focusout', (event) => {
        if (matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          controls.complete()
        }
      }, true)
    },
    submit: (condition, controls) => {
      if (condition.type !== 'submit') {
        return undefined
      }

      return listen(getDocument(), 'submit', (event) => {
        if (matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          controls.complete({ defer: true })
        }
      }, true)
    },
    hover: (condition, controls) => {
      if (condition.type !== 'hover') {
        return undefined
      }

      const completeIfMatched = (event: Event) => {
        if (matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          controls.complete()
        }
      }

      return combineCleanups(
        listen(getDocument(), 'pointerover', completeIfMatched, true),
        listen(getDocument(), 'mouseover', completeIfMatched, true),
      )
    },
    keyboard: (condition, controls) => {
      if (condition.type !== 'keyboard') {
        return undefined
      }

      return listen(getDocument(), 'keydown', (event) => {
        if (!(event instanceof getWindow().KeyboardEvent)) {
          return
        }

        const keyboardEvent = event as KeyboardEvent

        if (condition.target && !matchesEventTarget(keyboardEvent.target, condition.target, getWindow(), resolveTarget)) {
          return
        }

        const keyMatches = condition.key === undefined || keyboardEvent.key === condition.key
        const codeMatches = condition.code === undefined || keyboardEvent.code === condition.code
        if (keyMatches && codeMatches) {
          controls.complete()
        }
      }, true)
    },
    visible: (condition, controls) => {
      if (condition.type !== 'visible') {
        return undefined
      }

      return watchDomState(getWindow(), () => {
        const target = resolveTarget(condition.target)
        if (target && isVisible(target, getWindow())) {
          controls.complete()
        }
      }, options.pollIntervalMs)
    },
    exists: (condition, controls) => {
      if (condition.type !== 'exists') {
        return undefined
      }

      return watchDomState(getWindow(), () => {
        if (resolveTarget(condition.target)) {
          controls.complete()
        }
      }, options.pollIntervalMs)
    },
    url: (condition, controls) => {
      if (condition.type !== 'url') {
        return undefined
      }

      return watchLocation(getWindow(), () => {
        if (matchesValue(getWindow().location.href, condition.value, false)) {
          controls.complete()
        }
      }, options.pollIntervalMs)
    },
    route: (condition, controls) => {
      if (condition.type !== 'route') {
        return undefined
      }

      return watchLocation(getWindow(), () => {
        const location = getWindow().location
        const path = `${location.pathname}${location.search}${location.hash}`
        if (matchesValue(path, condition.path, false)) {
          controls.complete()
        }
      }, options.pollIntervalMs)
    },
    drag: (condition, controls) => {
      if (condition.type !== 'drag') {
        return undefined
      }

      let sourceMatched = false

      const cleanupDragStart = listen(getDocument(), 'dragstart', (event) => {
        sourceMatched = matchesEventTarget(event.target, condition.source, getWindow(), resolveTarget)
        if (sourceMatched && !condition.target) {
          controls.complete({ defer: true })
        }
      }, true)

      const cleanupDrop = condition.target
        ? listen(getDocument(), 'drop', (event) => {
          if (sourceMatched && matchesEventTarget(event.target, condition.target!, getWindow(), resolveTarget)) {
            controls.complete({ defer: true })
          }
          sourceMatched = false
        }, true)
        : undefined

      return combineCleanups(cleanupDragStart, cleanupDrop)
    },
    drop: (condition, controls) => {
      if (condition.type !== 'drop') {
        return undefined
      }

      let sourceMatched = !condition.source

      const cleanupDragStart = condition.source
        ? listen(getDocument(), 'dragstart', (event) => {
          sourceMatched = matchesEventTarget(event.target, condition.source!, getWindow(), resolveTarget)
        }, true)
        : undefined

      const cleanupDrop = listen(getDocument(), 'drop', (event) => {
        if (sourceMatched && matchesEventTarget(event.target, condition.target, getWindow(), resolveTarget)) {
          controls.complete({ defer: true })
        }
        sourceMatched = !condition.source
      }, true)

      return combineCleanups(cleanupDragStart, cleanupDrop)
    },
  }
}

function listen(
  target: DomEventTarget,
  type: string,
  listener: EventListener,
  options?: boolean | AddEventListenerOptions,
): TutorialConditionCleanup {
  target.addEventListener(type, listener, options)

  return () => {
    target.removeEventListener(type, listener, options)
  }
}

function combineCleanups(
  ...cleanups: Array<TutorialConditionCleanup | undefined>
): TutorialConditionCleanup {
  return () => {
    cleanups.forEach((cleanup) => cleanup?.())
  }
}

function matchesEventTarget(
  eventTarget: EventTarget | null,
  target: TutorialTarget,
  currentWindow: DomConditionWindow,
  resolveTarget: (target: TutorialTarget) => Element | null,
): boolean {
  if (!(eventTarget instanceof currentWindow.Element)) {
    return false
  }

  const eventElement = eventTarget as Element
  const selector = getTargetSelector(target)
  if (selector) {
    return Boolean(eventElement.closest(selector))
  }

  const resolvedTarget = resolveTarget(target)
  return Boolean(resolvedTarget?.contains(eventElement))
}

function getTargetSelector(target: TutorialTarget): string | undefined {
  if (typeof target === 'string') {
    return target
  }

  if (target.type === 'selector') {
    return target.value
  }

  return undefined
}

function readControlValue(target: EventTarget | null, currentWindow: DomConditionWindow): string | boolean {
  if (target instanceof currentWindow.HTMLInputElement) {
    const input = target as HTMLInputElement
    if (input.type === 'checkbox' || input.type === 'radio') {
      return input.checked
    }

    return input.value
  }

  if (
    target instanceof currentWindow.HTMLTextAreaElement
    || target instanceof currentWindow.HTMLSelectElement
  ) {
    return (target as HTMLTextAreaElement | HTMLSelectElement).value
  }

  if (target instanceof currentWindow.HTMLElement) {
    return (target as HTMLElement).textContent ?? ''
  }

  return ''
}

function matchesValue(value: string | boolean, expected: TutorialValueMatcher | undefined, requireNonEmpty: boolean): boolean {
  if (expected === undefined) {
    return requireNonEmpty ? String(value).length > 0 : true
  }

  if (expected instanceof RegExp) {
    return expected.test(String(value))
  }

  if (typeof expected === 'boolean') {
    return value === expected
  }

  return String(value) === String(expected)
}

function watchDomState(
  currentWindow: DomConditionWindow,
  check: () => void,
  pollIntervalMs = 250,
): TutorialConditionCleanup {
  const currentDocument = currentWindow.document
  const cleanupResize = listen(currentWindow, 'resize', check)
  const cleanupScroll = listen(currentWindow, 'scroll', check, true)
  const interval = currentWindow.setInterval(check, pollIntervalMs)
  let mutationObserver: MutationObserver | undefined

  if (typeof currentWindow.MutationObserver !== 'undefined') {
    const observer = new currentWindow.MutationObserver(check)
    observer.observe(currentDocument.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    })
    mutationObserver = observer
  }

  check()

  return () => {
    cleanupResize()
    cleanupScroll()
    currentWindow.clearInterval(interval)
    mutationObserver?.disconnect()
  }
}

function watchLocation(
  currentWindow: DomConditionWindow,
  check: () => void,
  pollIntervalMs = 250,
): TutorialConditionCleanup {
  const cleanupPopState = listen(currentWindow, 'popstate', check)
  const cleanupHashChange = listen(currentWindow, 'hashchange', check)
  const interval = currentWindow.setInterval(check, pollIntervalMs)

  check()

  return () => {
    cleanupPopState()
    cleanupHashChange()
    currentWindow.clearInterval(interval)
  }
}

function isVisible(element: Element, currentWindow: DomConditionWindow): boolean {
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }

  const style = currentWindow.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}
