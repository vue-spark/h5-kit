export function noop(): void {
}

export const isBrowser = typeof document !== 'undefined'

export const getTrue = (): true => true
