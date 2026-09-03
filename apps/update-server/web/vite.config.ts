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
				channels: path.resolve(import.meta.dirname, 'channels/index.html'),
				channelDetail: path.resolve(
					import.meta.dirname,
					'channels/detail.html',
				),
				updates: path.resolve(import.meta.dirname, 'updates/index.html'),
				updateDetail: path.resolve(import.meta.dirname, 'updates/detail.html'),
				runtimes: path.resolve(import.meta.dirname, 'runtimes/index.html'),
				runtimeDetail: path.resolve(
					import.meta.dirname,
					'runtimes/detail.html',
				),
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
