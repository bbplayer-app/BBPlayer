import type { HeatMapColor } from '../types'

export const DEFAULT_LIGHT_THEME: Required<HeatMapColor> = {
	headerTextColor: '#666666',
	cellDefaultColor: '#ebedf0',
	cellTextColor: '#ffffff',
	cellColor: {
		1: '#9be9a8',
		2: '#40c463',
		3: '#30a14e',
		4: '#216e39',
	},
	sidebarTextColor: '#666666',
}

export const DEFAULT_DARK_THEME: Required<HeatMapColor> = {
	headerTextColor: '#8b949e',
	cellDefaultColor: '#161b22',
	cellTextColor: '#ffffff',
	cellColor: {
		1: '#0e4429',
		2: '#006d32',
		3: '#26a641',
		4: '#39d353',
	},
	sidebarTextColor: '#8b949e',
}
