interface Metric {
	name: string
	value: number
}

export default {
	getMainSession: () => ({
		getMetrics: async (): Promise<Metric[]> => [],
	}),
	markInteractive: () => undefined,
}

export const AppMetricsRoot = {
	wrap: <T>(component: T): T => component,
}
