import type { App, MaybeRefOrGetter } from 'vue'
import { onScopeDispose, toValue } from 'vue'
import { getTrue, isBrowser, noop } from './utils'

export interface BackHandlerHistoryEntry {
  /**
   * Condition to check before handling the back press.
   */
  condition?: () => boolean
  /**
   * Handler to be executed when the back press is triggered.
   */
  handler: () => void
}

export interface BackHandlerOptions {
  /**
   * Called when a history entry is added.
   */
  onHistoryAdded?: (entry: BackHandlerHistoryEntry) => void
  /**
   * Called when a history entry is removed.
   */
  onHistoryRemoved?: (entry: BackHandlerHistoryEntry) => void
  /**
   * Called when the back button is pressed and there's no active custom handler.
   */
  defaultBackAction: () => void
  /**
   * A callback provided by the platform to register the actual back button listener.
   */
  registerPlatformBackListener: (handler: () => void) => void
}

export const BackHandler = {
  /**
   * Whether the plugin is installed.
   */
  installed: false,
  /**
   * Stack of history entries.
   */
  history: [] as BackHandlerHistoryEntry[],
  /**
   * Add a history entry.
   */
  addHistory: noop as (entry: BackHandlerHistoryEntry) => void,
  /**
   * Remove a history entry.
   */
  removeHistory: noop as (entry: BackHandlerHistoryEntry) => void,
  /**
   * Install the plugin.
   */
  install(app: App, options: BackHandlerOptions) {
    const self = BackHandler
    if (self.installed || !isBrowser) {
      return
    }

    self.installed = true

    self.addHistory = (entry) => {
      entry.condition ??= getTrue
      self.history.push(entry)
      options.onHistoryAdded?.(entry)
    }

    self.removeHistory = (entry) => {
      const index = self.history.indexOf(entry)
      if (index > -1) {
        self.history.splice(index, 1)
        options.onHistoryRemoved?.(entry)
      }
    }

    app.onUnmount(() => {
      self.addHistory = noop
      self.removeHistory = noop

      self.history = []
      self.installed = false
    })

    const backHandler = (): void => {
      if (self.history.length) {
        const entry = self.history[self.history.length - 1]
        if (entry && entry.condition!()) {
          self.history.pop()
          entry.handler()
        }
      }
      else {
        options.defaultBackAction()
      }
    }

    options.registerPlatformBackListener(backHandler)
  },
}

export interface UseBackHandlerReturn {
  addToHistory: () => void
  removeFromHistory: () => void
}

/**
 * Register a back handler.
 * @param showing Whether the handler is showing.
 * @param onHide Handler to be executed when the back press is triggered.
 * @param autoHideOnRouteChange Whether to automatically hide the handler when the route changes.
 */
export function useBackHandler(
  showing: MaybeRefOrGetter<boolean>,
  onHide: () => void,
  autoHideOnRouteChange: MaybeRefOrGetter<boolean>,
): UseBackHandlerReturn {
  let historyEntry: BackHandlerHistoryEntry | null = null
  function removeFromHistory(): void {
    if (historyEntry) {
      BackHandler.removeHistory(historyEntry)
      historyEntry = null
    }
  }

  onScopeDispose(() => {
    toValue(showing) && removeFromHistory()
  }, true)

  return {
    removeFromHistory,
    addToHistory() {
      historyEntry = {
        condition: () => toValue(autoHideOnRouteChange),
        handler: onHide,
      }
      BackHandler.addHistory(historyEntry)
    },
  }
}
