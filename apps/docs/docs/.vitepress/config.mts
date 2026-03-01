import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: 'BBPlayer',
	lang: 'zh-CN',
	description: '又一个 BiliBili 音乐播放器',
	head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
	cleanUrls: true,
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		logo: '/icon.png',
		nav: [
			{ text: '首页', link: '/' },
			{ text: '指南', link: '/guides' },
		],
		editLink: {
			pattern:
				'https://github.com/bbplayer-app/bbplayer-docs/edit/main/docs/:path',
		},
		outline: [2, 5],

		sidebar: [
			{
				text: '指南',
				link: '/guides',
				items: [
					{ text: '安装', link: '/guides/install' },
					{ text: '搜索', link: '/guides/search' },
					{ text: '歌单', link: '/guides/playlist' },
					{ text: '歌词', link: '/guides/lyrics' },
					{ text: '下载与导出', link: '/guides/download' },
					{ text: '播放器功能', link: '/guides/player' },
					{ text: '设置与个性化', link: '/guides/settings' },
					{ text: '排行榜', link: '/guides/leaderboard' },
					{ text: '评论区', link: '/guides/comments' },
					{ text: '导入外部歌单', link: '/guides/external-playlist' },
					{ text: '共享歌单与协同编辑', link: '/guides/shared-playlist' },
				],
			},
		],

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/bbplayer-app/bbplayer' },
		],
	},
})
