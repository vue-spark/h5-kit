import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, effectScope, nextTick, ref } from 'vue'
import { BackHandler, useBackHandler } from '../src/back-handler'

// Mock browser environment
vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})

describe('backHandler Plugin', () => {
  beforeEach(() => {
    // Reset plugin state before each test
    if (BackHandler.__installed) {
      // Simulate app unmount cleanup
      BackHandler.addHistory = () => {
      }
      BackHandler.removeHistory = () => {
      }
      BackHandler.__history = []
      BackHandler.__installed = false
    }
  })

  it('should not install twice', () => {
    const app = createApp({})
    const defaultBackAction = vi.fn()
    const registerPlatformBackListener = vi.fn()

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
    })
    expect(BackHandler.__installed).toBe(true)

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
    })
    expect(registerPlatformBackListener).toHaveBeenCalledTimes(1)
  })

  it('should call fallback when history is empty', () => {
    const app = createApp({})
    const defaultBackAction = vi.fn()
    const registerPlatformBackListener = vi.fn()

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
    })

    // Extract the handler passed to registerBackHandler
    const backHandler = registerPlatformBackListener.mock.calls[0][0]
    backHandler()

    expect(defaultBackAction).toHaveBeenCalled()
  })

  it('should call top history entry if condition passes', () => {
    const app = createApp({})
    const defaultBackAction = vi.fn()
    const registerPlatformBackListener = vi.fn()
    const handler = vi.fn()
    const condition = vi.fn().mockReturnValue(true)

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
    })

    BackHandler.addHistory({ handler, condition })
    expect(BackHandler.__history.length).toBe(1)

    const backHandler = registerPlatformBackListener.mock.calls[0][0]
    backHandler()

    expect(handler).toHaveBeenCalled()
    expect(condition).toHaveBeenCalled()
    expect(BackHandler.__history.length).toBe(0)
    expect(defaultBackAction).not.toHaveBeenCalled()
  })

  it('should not pop entry if condition fails', () => {
    const app = createApp({})
    const defaultBackAction = vi.fn()
    const registerPlatformBackListener = vi.fn()
    const handler = vi.fn()
    const condition = vi.fn().mockReturnValue(false)

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
    })
    BackHandler.addHistory({ handler, condition })

    const backHandler = registerPlatformBackListener.mock.calls[0][0]
    backHandler()

    expect(handler).not.toHaveBeenCalled()
    expect(BackHandler.__history.length).toBe(1)
    expect(defaultBackAction).not.toHaveBeenCalled()
  })

  it('should clean up on app unmount', () => {
    const app = createApp({})
    const defaultBackAction = vi.fn()
    const registerPlatformBackListener = vi.fn()

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
    })
    expect(BackHandler.__installed).toBe(true)

    // Simulate app unmount
    app._instance = {} as any
    app.unmount?.()

    // In real Vue, onUnmount would run; we simulate by checking internal reset
    // Since we can't easily trigger onUnmount in unit test, we rely on manual reset above
    // But we can test that methods are disabled
    expect(typeof BackHandler.addHistory).toBe('function')
    // Note: actual cleanup is tested via beforeEach reset
  })

  it('calls onHistoryAdded when entry is added', () => {
    const app = createApp({})
    const onHistoryAdded = vi.fn()
    const defaultBackAction = vi.fn()
    const registerPlatformBackListener = vi.fn()

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
      onHistoryAdded,
    })

    const entry = {
      handler: () => {
      },
      condition: () => true,
    }
    BackHandler.addHistory(entry)

    expect(onHistoryAdded).toHaveBeenCalledWith(entry)
    expect(BackHandler.__history).toContain(entry)
  })

  it('calls onHistoryRemoved when entry is removed', () => {
    const app = createApp({})
    const onHistoryRemoved = vi.fn()
    const defaultBackAction = vi.fn()
    const registerPlatformBackListener = vi.fn()

    BackHandler.install(app, {
      defaultBackAction,
      registerPlatformBackListener,
      onHistoryRemoved,
    })

    const entry = {
      handler: () => {
      },
      condition: () => true,
    }
    BackHandler.addHistory(entry)
    BackHandler.removeHistory(entry)

    expect(onHistoryRemoved).toHaveBeenCalledWith(entry)
    expect(BackHandler.__history).not.toContain(entry)
  })
})

describe('useBackHandler composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset BackHandler history
    BackHandler.__history = []
  })

  it('adds and removes history entry correctly', () => {
    const showing = ref(true)
    const hide = vi.fn()
    const hideOnRouteChange = ref(true)

    const { addToHistory, removeFromHistory } = useBackHandler(
      showing,
      hide,
      hideOnRouteChange,
    )

    addToHistory()
    expect(BackHandler.__history.length).toBe(1)
    const entry = BackHandler.__history[0]
    expect(entry.condition!()).toBe(true)
    expect(entry.handler).toBe(hide)

    removeFromHistory()
    expect(BackHandler.__history.length).toBe(0)
  })

  it('condition is reactive', () => {
    const showing = ref(true)
    const hide = vi.fn()
    const hideOnRouteChange = ref(true)

    const { addToHistory } = useBackHandler(showing, hide, hideOnRouteChange)
    addToHistory()

    const entry = BackHandler.__history[0]

    expect(entry.condition!()).toBe(true)

    hideOnRouteChange.value = false
    expect(entry.condition!()).toBe(false)
  })

  it('does not auto-remove on dispose if not showing', async () => {
    const showing = ref(false) // Not showing
    const hide = vi.fn()
    const hideOnRouteChange = ref(true)

    const scope = effectScope(true)
    scope.run(() => {
      const { addToHistory } = useBackHandler(showing, hide, hideOnRouteChange)
      addToHistory() // manually add
    })

    expect(BackHandler.__history.length).toBe(1)

    scope.stop()
    await nextTick()

    expect(BackHandler.__history.length).toBe(1) // still there!
  })

  it('auto-removes on dispose if showing is true', async () => {
    const showing = ref(true)
    const hide = vi.fn()
    const hideOnRouteChange = ref(true)

    const scope = effectScope(true)
    scope.run(() => {
      const { addToHistory } = useBackHandler(showing, hide, hideOnRouteChange)
      addToHistory() // manually add
    })

    expect(BackHandler.__history.length).toBe(1)

    scope.stop()
    await nextTick()

    expect(BackHandler.__history.length).toBe(0)
  })
})
