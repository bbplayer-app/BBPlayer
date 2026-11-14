interface Metric {
	name: string
	value: number
}

export default {
	getMainSession: () => ({
		getMetrics: async (): Promise<Metric[]> => [],
	}),
}
