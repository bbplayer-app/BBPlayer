import { randomUUID } from 'node:crypto'

import type { App, Screen } from 'e2e'
import { expect, test } from 'e2e'

import { openHome, selectTab } from './helpers'

async function findPlaylist(app: App, screen: Screen, name: string) {
	await openHome(app, screen)
	await selectTab(screen, 'tab-library')
	await expect(screen.getByTestId('library-tab-local')).toBeVisible()
	await screen.getByTestId('library-tab-local').tap()
	await screen.getByTestId('library-playlist-search').fill(name)
	const row = screen.getByTestId(/^local-playlist-/).filter({ hasText: name })
	await expect(
		row.or(screen.getByTestId('library-playlist-empty')).first(),
	).toBeVisible()

	return row
}

// 原生菜单项不支持逐项 testID，菜单打开后的操作保留精确文本定位。
async function deletePlaylist(screen: Screen) {
	await screen.getByTestId('local-playlist-menu').tap()
	await screen.getByText('删除播放列表', { exact: true }).tap()
	await expect(screen.getByText('确定要删除此播放列表吗？')).toBeVisible()
	await screen.getByTestId('alert-confirm-label').tap()
	await expect(screen.getByTestId('library-playlist-search')).toBeVisible()
}

test(
	'本地歌单：创建、改名、重启后保留并删除',
	{ timeout: 300_000 },
	async ({ app, screen }) => {
		const prefix = `E2E-${randomUUID().slice(0, 8)}`
		const original = `${prefix}-created`
		const renamed = `${prefix}-renamed`
		let submitted = false
		let deleted = false

		try {
			await openHome(app, screen)
			await selectTab(screen, 'tab-library')
			await expect(screen.getByTestId('library-tab-local')).toBeVisible()
			await screen.getByTestId('library-tab-local').tap()
			await screen.getByTestId('library-playlist-menu').tap()
			await screen.getByText('新建播放列表', { exact: true }).tap()
			await screen.getByTestId('create-playlist-title-input').fill(original)
			submitted = true
			await screen.getByTestId('create-playlist-confirm-button-label').tap()
			await expect(
				screen.getByText(original, { exact: true }).first(),
			).toBeVisible()
			await expect(screen.getByTestId('playlist-play-all')).toBeVisible()
			await expect(
				screen.getByTestId('create-playlist-title-input'),
			).not.toBeVisible()
			// 从音乐库重新打开刚创建的歌单，也验证创建结果已持久化。
			// 重启会清除不暴露在原生可访问性树中的顶部成功提示。
			const created = await findPlaylist(app, screen, original)
			await expect(created).toBeVisible()
			await created.tap()

			await screen.getByTestId('local-playlist-menu').tap()
			await screen.getByText('编辑播放列表信息', { exact: true }).tap()
			await screen.getByTestId('edit-playlist-title-input').fill(renamed)
			await screen.getByTestId('edit-playlist-confirm-button-label').tap()
			await expect(
				screen.getByTestId('edit-playlist-title-input'),
			).not.toBeVisible()
			await expect(screen.getByTestId('appbar-content-title-text')).toHaveText(
				renamed,
			)

			// openHome 会重新启动应用，验证数据确实落盘，而非仅在内存里更新。
			const row = await findPlaylist(app, screen, renamed)
			await expect(row).toBeVisible()
			await expect(
				screen.getByText(original, { exact: true }),
			).not.toBeVisible()
			await row.tap()
			await expect(
				screen.getByText(renamed, { exact: true }).first(),
			).toBeVisible()
			await deletePlaylist(screen)
			await screen.getByTestId('library-playlist-search').fill(prefix)
			await expect(
				screen.getByTestId(/^local-playlist-/).filter({ hasText: prefix }),
			).toHaveCount(0)
			deleted = true
		} finally {
			// 失败时也只删除本次随机命名的歌单，不清空设备数据。
			if (submitted && !deleted) {
				await app.screenshot('playlist-before-cleanup')
				const row = await findPlaylist(app, screen, prefix)

				if (await row.isVisible()) {
					await row.tap()
					await deletePlaylist(screen)
				}
			}
		}
	},
)

test(
	'搜索与播放：搜索建议、结果、播放进度、暂停与恢复',
	{ timeout: 300_000, tags: ['online'] },
	async ({ app, screen }) => {
		await openHome(app, screen)
		const search = screen.getByTestId('search-bar')
		await search.fill(process.env.E2E_SEARCH_QUERY ?? 'Bilibili')
		await expect(screen.getByTestId('search-suggestion-0')).toBeVisible({
			timeout: 30_000,
		})
		await screen.getByTestId('search-suggestion-0').tap()
		const track = screen.getByTestId(/^track-item-/).first()
		await expect(track).toBeVisible({ timeout: 45_000 })
		await track.tap()
		const replace = screen.getByTestId('alert-title')
		const bar = screen.getByTestId('now-playing-bar')
		await expect(bar.or(replace).first()).toBeVisible()

		if (await replace.isVisible()) {
			await expect(replace).toHaveText('替换播放列表')
			await screen.getByTestId('alert-confirm-label').tap()
		}

		await bar.tap()
		const elapsed = screen.getByTestId('player-elapsed-time')
		const pause = screen.getByTestId('player-pause')
		const play = screen.getByTestId('player-play')

		try {
			await expect(play.or(pause).first()).toBeVisible({ timeout: 45_000 })

			// 重跑时可能选中上次已暂停的同一首歌，点击列表项不会自动恢复播放。
			if (await play.isVisible()) await play.tap()
			await expect(pause).toBeVisible({ timeout: 45_000 })
			const startedAt = await elapsed.textContent()
			await expect
				.poll(() => elapsed.textContent(), { timeout: 30_000 })
				.not.toBe(startedAt)
			await pause.tap()
			await expect(play).toBeVisible()
			const pausedAt = await elapsed.textContent()
			// 跨过两个进度刷新周期，验证暂停确实冻结了播放进度。
			await new Promise((resolve) => setTimeout(resolve, 2_000))
			await expect(elapsed).toHaveText(pausedAt ?? '')
			await play.tap()
			await expect(pause).toBeVisible()
			await expect
				.poll(() => elapsed.textContent(), { timeout: 30_000 })
				.not.toBe(pausedAt)
		} finally {
			if (await pause.isVisible()) await pause.tap()
		}
	},
)

test('设置：从我的页面进入播放设置并返回搜索', async ({ app, screen }) => {
	await openHome(app, screen)
	await selectTab(screen, 'tab-my')
	await screen.getByTestId('profile-settings').tap()
	await expect(screen.getByText('外观与主题', { exact: true })).toBeVisible()
	await screen.getByTestId('settings-playback').tap()
	await expect(screen.getByText('播放设置', { exact: true })).toBeVisible()
	await expect(screen.getByText('播放行为', { exact: true })).toBeVisible()
	await app.back()
	await expect(screen.getByText('外观与主题', { exact: true })).toBeVisible()
	await app.back()
	await expect(screen.getByTestId('profile-settings')).toBeVisible()
	await selectTab(screen, 'tab-search')
	await expect(screen.getByTestId('search-bar')).toBeVisible()
})
