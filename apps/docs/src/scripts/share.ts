// The page template determines the concrete DOM type for each ID.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
	const node = document.getElementById(id)
	if (!node) throw new Error(`Missing share page element: ${id}`)
	return node as T
}

export function showError(message: string) {
	element('error-title').textContent = message
	element('share-error').hidden = false
}

export function setImage(
	image: HTMLImageElement,
	value: string | undefined,
	alt: string,
	placeholder: HTMLElement,
) {
	if (!value) return
	try {
		const url = new URL(value, window.location.origin)
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return
		image.alt = alt
		image.src = url.href
		image.hidden = false
		placeholder.hidden = true
		image.addEventListener(
			'error',
			() => {
				image.hidden = true
				placeholder.hidden = false
			},
			{ once: true },
		)
	} catch {
		// Keep the placeholder when the supplied image URL is invalid.
	}
}
