import type { App, Screen } from 'e2e'
import { expect } from 'e2e'

export async function openHome(app: App, screen: Screen) {
	await app.open()
	const search = screen.getByTestId('search-bar')
	const next = screen.getByTestId('onboarding-next-0-label')
	const update = screen.getByTestId('update-app-title')
	await expect(search.or(next).or(update).first()).toBeVisible({
		timeout: 60_000,
	})
	if (await update.isVisible()) {
		await screen.getByTestId('update-app-cancel-label').tap()
	}
	if (await next.isVisible()) {
		await next.tap()
		await expect(screen.getByText('安全提示', { exact: true })).toBeVisible()
		await screen.getByTestId('onboarding-next-1-label').tap()
		await screen.getByTestId('onboarding-guest-label').tap()
	}
	await expect(search).toBeVisible()
}

export async function selectTab(screen: Screen, id: string) {
	const tab = screen.getByTestId(id)
	await expect(tab).toBeVisible()
	await tab.tap()
	await expect(tab).toBeSelected()
}
