import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src'),
		},
	},
	build: {
		rollupOptions: {
			input: {
				overview: path.resolve(import.meta.dirname, 'index.html'),
				releases: path.resolve(import.meta.dirname, 'releases/index.html'),
				releaseDetail: path.resolve(
					import.meta.dirname,
					'releases/detail.html',
				),
				channels: path.resolve(import.meta.dirname, 'channels/index.html'),
				audience: path.resolve(import.meta.dirname, 'audience/index.html'),
			},
		},
	},
	server: {
		port: 4173,
		proxy: {
			'/admin': { target: 'http://127.0.0.1:8080', changeOrigin: true },
		},
	},
})
