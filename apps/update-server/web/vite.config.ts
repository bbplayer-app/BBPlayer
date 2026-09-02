import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 4173,
		proxy: {
			'/admin': { target: 'http://127.0.0.1:8080', changeOrigin: true },
		},
	},
})
