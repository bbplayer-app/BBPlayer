import { expect, test } from 'e2e'

import { openHome, selectTab } from './helpers'

test('游客可以进入搜索页并切换到我的页面', async ({ app, screen }) => {
	await openHome(app, screen)
	const search = screen.getByTestId('search-bar')
	await selectTab(screen, 'tab-my')
	await expect(screen.getByTestId('profile-settings')).toBeVisible()
	await selectTab(screen, 'tab-search')
	await expect(search).toBeVisible()
})
