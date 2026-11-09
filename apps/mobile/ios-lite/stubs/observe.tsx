const noop = () => undefined

export const Observe = { configure: noop }
export const ObserveRoot = { wrap: <T,>(component: T): T => component }
export const useObserve = () => ({ markInteractive: noop, markLoaded: noop })
