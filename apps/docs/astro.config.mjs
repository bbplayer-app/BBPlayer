import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
	site: 'https://bbplayer.roitium.com',
	integrations: [
		starlight({
			title: 'BBPlayer',
			disable404Route: true,
			description: '又一个 BiliBili 音乐播放器',
			favicon: '/favicon.ico',
			locales: { root: { label: '简体中文', lang: 'zh-CN' } },
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/bbplayer-app/BBPlayer',
				},
			],
			editLink: {
				baseUrl: 'https://github.com/bbplayer-app/BBPlayer/edit/dev/apps/docs/',
			},
			sidebar: [
				{
					label: '指南',
					items: [
						{ label: '概览', slug: 'guides' },
						'guides/install',
						'guides/search',
						'guides/playlist',
						'guides/lyrics',
						'guides/download',
						'guides/player',
						'guides/podcast',
						'guides/settings',
						'guides/leaderboard',
						'guides/comments',
						'guides/external-playlist',
						'guides/shared-playlist',
					],
				},
				{ label: '歌词规范', slug: 'SPL' },
			],
		}),
	],
})
