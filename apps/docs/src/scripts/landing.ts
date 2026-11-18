// 首页的滚动渐显与移动端截图叠卡

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

const revealed = document.querySelectorAll<HTMLElement>('[data-reveal]')

if (reduceMotion.matches || !('IntersectionObserver' in window)) {
	for (const el of revealed) el.classList.add('is-visible')
} else {
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue
				entry.target.classList.add('is-visible')
				observer.unobserve(entry.target)
			}
		},
		{ rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
	)

	for (const el of revealed) observer.observe(el)
}

const deck = document.querySelector<HTMLElement>('[data-deck]')

if (deck) setupDeck(deck)

/**
 * 窄屏下三张截图叠成一摞，左右滑动把最上面一张甩到最底下。
 * 宽屏时 CSS 忽略 data-pos，三张并排显示。
 */
function setupDeck(stage: HTMLElement) {
	const compact = window.matchMedia('(max-width: 720px)')

	const cards = [...stage.querySelectorAll<HTMLElement>('[data-pos]')].sort(
		(a, b) => Number(a.dataset.pos) - Number(b.dataset.pos),
	)

	// 圆点按初始顺序对应卡片，与之后的叠放顺序无关
	const initial = [...cards]

	const dots = [
		...document.querySelectorAll<HTMLButtonElement>('[data-deck-dot]'),
	]

	const order = [...cards]
	const flyDuration = reduceMotion.matches ? 0 : 220
	let busy = false

	const render = () => {
		order.forEach((card, index) => {
			card.dataset.pos = String(index)
		})
		const top = initial.indexOf(order[0])
		dots.forEach((dot, index) => {
			dot.classList.toggle('is-active', index === top)
			dot.setAttribute('aria-current', index === top ? 'true' : 'false')
		})
	}

	const cycle = (direction: number) =>
		new Promise<void>((resolve) => {
			const top = order[0]
			busy = true
			top.classList.remove('is-dragging')
			top.style.transform = `translateX(${direction * 115}%) rotate(${direction * 14}deg)`
			window.setTimeout(() => {
				top.style.transform = ''
				order.push(top)
				order.shift()
				render()
				busy = false
				resolve()
			}, flyDuration)
		})

	dots.forEach((dot, index) => {
		dot.addEventListener('click', async () => {
			const target = initial[index]

			while (order[0] !== target) await cycle(-1)
		})
	})

	let pointerId: number | null = null
	let startX = 0
	let startY = 0
	let dx = 0
	let axis: 'x' | 'y' | null = null

	stage.addEventListener('pointerdown', (event) => {
		if (!compact.matches || busy) return

		if (!(event.target instanceof Node) || !order[0].contains(event.target))
			return
		pointerId = event.pointerId
		startX = event.clientX
		startY = event.clientY
		dx = 0
		axis = null
	})

	stage.addEventListener('pointermove', (event) => {
		if (event.pointerId !== pointerId) return
		const moveX = event.clientX - startX
		const moveY = event.clientY - startY

		if (!axis) {
			if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) return
			axis = Math.abs(moveX) > Math.abs(moveY) ? 'x' : 'y'

			if (axis === 'y') {
				pointerId = null

				return
			}

			stage.setPointerCapture(event.pointerId)
			order[0].classList.add('is-dragging')
		}

		dx = moveX
		order[0].style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`
	})

	const release = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return
		pointerId = null

		if (axis !== 'x') return
		const top = order[0]

		if (Math.abs(dx) > 60) {
			void cycle(Math.sign(dx))
		} else {
			top.classList.remove('is-dragging')
			top.style.transform = ''
		}
	}

	stage.addEventListener('pointerup', release)
	stage.addEventListener('pointercancel', release)

	compact.addEventListener('change', () => {
		for (const card of cards) {
			card.classList.remove('is-dragging')
			card.style.transform = ''
		}
	})

	render()
}
