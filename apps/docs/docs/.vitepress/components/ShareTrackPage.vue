<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Play, Tv2, AlertCircle, Music2, ExternalLink } from 'lucide-vue-next'

const id = ref('')
const title = ref('')
const cover = ref('')
const error = ref('')
const bvid = ref('')
const cid = ref('')
const p = ref('')
const isOnInAppBrowser = ref(false)

onMounted(() => {
	// Check for in-app browser
	// Matches: WeChat, QQ, Weibo, Alipay, DingTalk, Zhihu, Baidu, Bilibili (in-app)
	const ua = navigator.userAgent
	isOnInAppBrowser.value =
		/MicroMessenger|QQ\/|Weibo|AlipayClient|DingTalk|ZhihuHybrid|BaiduBoxApp/i.test(
			ua,
		)

	const params = new URLSearchParams(window.location.search)
	id.value = params.get('id') || ''
	title.value = params.get('title') || ''
	cover.value = params.get('cover') || ''
	p.value = params.get('p') || ''

	// Parse bilibili id
	if (id.value.startsWith('bilibili::')) {
		const parts = id.value.split('::')
		if (parts.length >= 2) {
			bvid.value = parts[1]
			if (parts.length >= 3) {
				cid.value = parts[2]
			}
		} else {
			error.value = '无效的分享链接'
		}
	} else {
		error.value = '暂不支持此来源的分享链接'
	}
})

const bilibiliUrl = computed(() => {
	if (!bvid.value) return ''
	let url = `https://www.bilibili.com/video/${bvid.value}`
	if (p.value) {
		url += `?p=${p.value}`
	} else if (cid.value) {
		url += `?p=1`
	}
	return url
})

const bbplayerAppLinkUrl = computed(() => {
	if (!bvid.value) return ''
	if (cid.value) {
		return `https://app.bbplayer.roitium.com/app/link-to/playlist/remote/multipage/${bvid.value}?cid=${cid.value}`
	}
	return `https://app.bbplayer.roitium.com/app/link-to/playlist/remote/search-result/global/${bvid.value}`
})
</script>

<template>
	<div class="page">
		<!-- In-app browser overlay -->
		<div
			v-if="isOnInAppBrowser"
			class="browser-overlay"
		>
			<div class="overlay-content">
				<div class="overlay-icon-wrapper">
					<ExternalLink
						:size="48"
						class="overlay-icon"
					/>
				</div>
				<h3 class="overlay-title">请在浏览器打开</h3>
				<p class="overlay-desc">点击右上角菜单，选择在浏览器打开以继续</p>
			</div>
		</div>

		<div
			v-if="!error"
			class="card"
		>
			<div class="card-body">
				<div class="cover-wrapper">
					<img
						v-if="cover"
						:src="cover"
						:alt="title"
						class="cover-image"
						referrerpolicy="no-referrer"
					/>
					<div
						v-else
						class="cover-placeholder"
					>
						<Music2
							:size="52"
							class="placeholder-icon"
						/>
					</div>
				</div>
				<h1 class="track-title">{{ title || '未知曲目' }}</h1>
			</div>
			<div class="button-group">
				<a
					:href="bilibiliUrl"
					target="_blank"
					rel="noopener noreferrer"
					class="btn btn-secondary"
				>
					<Tv2
						class="btn-icon"
						:size="18"
					/>
					在 Bilibili 打开
				</a>
				<a
					:href="bbplayerAppLinkUrl"
					class="btn btn-primary"
				>
					<Play
						class="btn-icon"
						:size="18"
						fill="currentColor"
					/>
					在 BBPlayer 打开
				</a>
			</div>
		</div>

		<div
			v-else
			class="card error-card"
		>
			<div class="error-icon">
				<AlertCircle :size="52" />
			</div>
			<h2 class="error-title">{{ error }}</h2>
			<p class="error-desc">请检查分享链接是否正确</p>
		</div>

		<div class="footer">
			<a
				href="https://bbplayer.roitium.com"
				target="_blank"
				class="footer-link"
				>来自 BBPlayer | 由 Roitium ❤️ 构建</a
			>
		</div>
	</div>
</template>

<style scoped>
@import './shared-page.css';

/* ── Card body (cover + title) ─────────────────────────────────────────── */

.card-body {
	padding: 36px 32px 20px;
	text-align: center;
}

.cover-wrapper {
	width: 196px;
	height: 196px;
	margin: 0 auto 24px;
	border-radius: 16px;
	overflow: hidden;
	background: var(--secondary-bg);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.cover-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.cover-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-3);
}

.track-title {
	font-size: 1.2rem;
	font-weight: 700;
	color: var(--text-1);
	margin: 0;
	line-height: 1.4;
	word-break: break-word;
}

/* ── Error card ────────────────────────────────────────────────────────── */
.error-card {
	padding: 40px 32px;
	text-align: center;
	align-items: center;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
	.card-body {
		padding: 28px 24px 16px;
	}

	.cover-wrapper {
		width: 156px;
		height: 156px;
		margin-bottom: 18px;
	}

	.track-title {
		font-size: 1.05rem;
	}
}
</style>
