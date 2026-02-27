<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
	ListMusic,
	Play,
	AlertCircle,
	ExternalLink,
	User,
	Music2,
} from 'lucide-vue-next'

// ── State ──────────────────────────────────────────────────────────────────
const shareId = ref('')
const inviteCode = ref('')
const isOnInAppBrowser = ref(false)

interface Track {
	unique_key: string
	title: string
	artist_name?: string
	cover_url?: string
	bilibili_bvid: string
}

interface Playlist {
	id: string
	title: string
	description?: string | null
	cover_url?: string | null
	track_count: number
}

interface Owner {
	mid: number
	name: string
	avatar_url?: string | null
}

interface PreviewData {
	playlist: Playlist
	owner: Owner | null
	tracks: Track[]
	preview_limit: number
}

const data = ref<PreviewData | null>(null)
const loading = ref(true)
const error = ref('')

const BACKEND_URL = 'https://be.bbplayer.roitium.com'

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
	// Check for in-app browser
	const ua = navigator.userAgent
	isOnInAppBrowser.value =
		/MicroMessenger|QQ\/|Weibo|AlipayClient|DingTalk|ZhihuHybrid|BaiduBoxApp/i.test(
			ua,
		)

	const params = new URLSearchParams(window.location.search)
	shareId.value = params.get('shareId') || ''
	inviteCode.value = params.get('inviteCode') || ''

	if (!shareId.value) {
		error.value = '无效的分享链接'
		loading.value = false
		return
	}

	try {
		const resp = await fetch(
			`${BACKEND_URL}/playlists/${encodeURIComponent(shareId.value)}/preview`,
		)
		if (resp.status === 404) {
			error.value = '歌单不存在或已删除'
		} else if (!resp.ok) {
			error.value = `加载失败（${resp.status}）`
		} else {
			data.value = await resp.json()
		}
	} catch (e) {
		error.value = '网络错误，请稍后重试'
	} finally {
		loading.value = false
	}
})

// ── Computed ───────────────────────────────────────────────────────────────
/** 跳转到 BBPlayer share/playlist 页的 deep link */
const bbplayerDeepLink = computed(() => {
	if (!shareId.value) return ''
	const params = new URLSearchParams({ shareId: shareId.value })
	if (inviteCode.value) params.set('inviteCode', inviteCode.value)
	return `bbplayer://share/playlist?${params.toString()}`
})

/** 通用 App Link（Android intent filter / iOS Universal Link 兜底） */
const bbplayerAppLink = computed(() => {
	if (!shareId.value) return ''
	const params = new URLSearchParams({ shareId: shareId.value })
	if (inviteCode.value) params.set('inviteCode', inviteCode.value)
	return `https://app.bbplayer.roitium.com/share/playlist?${params.toString()}`
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
				<ExternalLink
					:size="48"
					class="overlay-icon"
				/>
				<h3 class="overlay-title">请在浏览器打开</h3>
				<p class="overlay-desc">点击右上角菜单，选择在浏览器中打开以继续</p>
			</div>
		</div>

		<!-- Loading skeleton -->
		<div
			v-if="loading"
			class="card skeleton-card"
		>
			<div class="skeleton cover-skeleton" />
			<div class="skeleton title-skeleton" />
			<div class="skeleton subtitle-skeleton" />
			<div class="skeleton btn-skeleton" />
		</div>

		<!-- Error state -->
		<div
			v-else-if="error"
			class="card error-card"
		>
			<AlertCircle
				:size="64"
				class="error-icon"
			/>
			<h2 class="error-title">{{ error }}</h2>
			<p class="error-desc">请检查分享链接是否正确</p>
		</div>

		<!-- Preview card -->
		<div
			v-else-if="data"
			class="card preview-card"
		>
			<!-- Cover -->
			<div class="cover-wrapper">
				<img
					v-if="data.playlist.cover_url"
					:src="data.playlist.cover_url"
					:alt="data.playlist.title"
					class="cover-image"
					referrerpolicy="no-referrer"
				/>
				<div
					v-else
					class="cover-placeholder"
				>
					<ListMusic
						:size="64"
						class="placeholder-icon"
					/>
				</div>
			</div>

			<!-- Title & meta -->
			<h1 class="playlist-title">{{ data.playlist.title || '未命名歌单' }}</h1>

			<p
				v-if="data.playlist.description"
				class="playlist-desc"
			>
				{{ data.playlist.description }}
			</p>

			<!-- Owner -->
			<div
				v-if="data.owner"
				class="owner-row"
			>
				<img
					v-if="data.owner.avatar_url"
					:src="data.owner.avatar_url"
					class="owner-avatar"
					referrerpolicy="no-referrer"
					:alt="data.owner.name"
				/>
				<div
					v-else
					class="owner-avatar-placeholder"
				>
					<User :size="16" />
				</div>
				<span class="owner-name">{{ data.owner.name }}</span>
				<span class="track-count">· {{ data.playlist.track_count }} 首</span>
			</div>
			<div
				v-else
				class="track-count-standalone"
			>
				{{ data.playlist.track_count }} 首曲目
			</div>

			<!-- Track preview list -->
			<ul
				v-if="data.tracks.length"
				class="track-list"
			>
				<li
					v-for="(track, index) in data.tracks"
					:key="track.unique_key"
					class="track-item"
				>
					<span class="track-index">{{ index + 1 }}</span>
					<img
						v-if="track.cover_url"
						:src="track.cover_url"
						class="track-cover"
						referrerpolicy="no-referrer"
						:alt="track.title"
					/>
					<div
						v-else
						class="track-cover-placeholder"
					>
						<Music2 :size="14" />
					</div>
					<div class="track-info">
						<span class="track-title">{{ track.title }}</span>
						<span
							v-if="track.artist_name"
							class="track-artist"
							>{{ track.artist_name }}</span
						>
					</div>
				</li>
			</ul>
			<p
				v-if="data.tracks.length < data.playlist.track_count"
				class="more-hint"
			>
				仅显示前 {{ data.preview_limit }} 首，在 BBPlayer 中查看全部
			</p>

			<!-- Action buttons -->
			<div class="button-group">
				<a
					:href="bbplayerDeepLink"
					class="btn btn-primary"
				>
					<Play
						:size="20"
						fill="currentColor"
						class="btn-icon"
					/>
					在 BBPlayer 中订阅
				</a>
				<a
					:href="bbplayerAppLink"
					class="btn btn-secondary"
				>
					<ExternalLink
						:size="20"
						class="btn-icon"
					/>
					通过 App Link 打开
				</a>
			</div>
		</div>

		<!-- Footer -->
		<div class="footer">
			<p class="hint">来自 BBPlayer | 由 Roitium ❤️ 构建</p>
			<a
				href="https://bbplayer.roitium.com"
				target="_blank"
				class="footer-link"
				>bbplayer.roitium.com</a
			>
		</div>
	</div>
</template>

<style scoped>
/* ── Design tokens ─────────────────────────────────────────────────────── */
:root {
	--bg: #f9fafb;
	--card-bg: #ffffff;
	--text-1: #111827;
	--text-2: #6b7280;
	--text-3: #9ca3af;
	--primary: #18181b;
	--primary-fg: #ffffff;
	--secondary-bg: #f3f4f6;
	--secondary-fg: #1f2937;
	--border: #e5e7eb;
	--radius: 24px;
}

@media (prefers-color-scheme: dark) {
	:root {
		--bg: #09090b;
		--card-bg: #18181b;
		--text-1: #f9fafb;
		--text-2: #a1a1aa;
		--text-3: #71717a;
		--primary: #fafafa;
		--primary-fg: #18181b;
		--secondary-bg: #27272a;
		--secondary-fg: #e4e4e7;
		--border: #27272a;
	}
}

/* ── Layout ────────────────────────────────────────────────────────────── */
.page {
	min-height: 100dvh;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 24px;
	background-color: var(--bg);
	font-family:
		-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
		Arial, sans-serif;
	color: var(--text-1);
	transition: background-color 0.4s ease;
}

/* ── Card base ─────────────────────────────────────────────────────────── */
.card {
	background: var(--card-bg);
	border-radius: var(--radius);
	padding: 40px 48px;
	max-width: 500px;
	width: 100%;
	text-align: center;
	border: 1px solid var(--border);
	box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
	animation: fadeUp 0.5s ease-out both;
	margin: auto;
}

@media (prefers-color-scheme: dark) {
	.card {
		box-shadow: none;
	}
}

@keyframes fadeUp {
	from {
		opacity: 0;
		transform: translateY(12px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */
.skeleton {
	background: var(--secondary-bg);
	border-radius: 12px;
	animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
	0%,
	100% {
		opacity: 0.6;
	}
	50% {
		opacity: 1;
	}
}

.cover-skeleton {
	width: 200px;
	height: 200px;
	border-radius: 20px;
	margin: 0 auto 28px;
}

.title-skeleton {
	height: 28px;
	width: 70%;
	margin: 0 auto 12px;
}

.subtitle-skeleton {
	height: 16px;
	width: 45%;
	margin: 0 auto 28px;
}

.btn-skeleton {
	height: 52px;
	width: 100%;
	border-radius: 9999px;
}

/* ── Cover ─────────────────────────────────────────────────────────────── */
.cover-wrapper {
	width: 200px;
	height: 200px;
	border-radius: 20px;
	overflow: hidden;
	margin: 0 auto 28px;
	background: var(--secondary-bg);
	box-shadow: 0 16px 24px -8px rgba(0, 0, 0, 0.08);
}

.cover-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transition: transform 0.4s ease;
}

.cover-image:hover {
	transform: scale(1.04);
}

.cover-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-3);
}

/* ── Playlist info ─────────────────────────────────────────────────────── */
.playlist-title {
	font-size: 1.5rem;
	font-weight: 700;
	color: var(--text-1);
	margin-bottom: 10px;
	line-height: 1.3;
	word-break: break-word;
}

.playlist-desc {
	font-size: 0.9rem;
	color: var(--text-2);
	margin-bottom: 14px;
	line-height: 1.5;
	text-align: center;
}

/* ── Owner row ─────────────────────────────────────────────────────────── */
.owner-row {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 24px;
	font-size: 0.875rem;
	color: var(--text-2);
}

.owner-avatar {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	object-fit: cover;
}

.owner-avatar-placeholder {
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: var(--secondary-bg);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-3);
}

.owner-name {
	font-weight: 500;
	color: var(--text-1);
}

.track-count {
	color: var(--text-2);
}

.track-count-standalone {
	margin-bottom: 24px;
	font-size: 0.875rem;
	color: var(--text-2);
}

/* ── Track list ────────────────────────────────────────────────────────── */
.track-list {
	list-style: none;
	margin: 0 0 8px;
	padding: 0;
	text-align: left;
	max-height: 320px;
	overflow-y: auto;
	border: 1px solid var(--border);
	border-radius: 16px;
	scrollbar-width: thin;
	scrollbar-color: var(--border) transparent;
}

.track-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 14px;
	border-bottom: 1px solid var(--border);
	transition: background 0.15s ease;
}

.track-item:last-child {
	border-bottom: none;
}

.track-item:hover {
	background: var(--secondary-bg);
}

.track-index {
	font-size: 0.75rem;
	color: var(--text-3);
	width: 18px;
	text-align: right;
	flex-shrink: 0;
}

.track-cover {
	width: 36px;
	height: 36px;
	border-radius: 6px;
	object-fit: cover;
	flex-shrink: 0;
}

.track-cover-placeholder {
	width: 36px;
	height: 36px;
	border-radius: 6px;
	background: var(--secondary-bg);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-3);
	flex-shrink: 0;
}

.track-info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.track-title {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--text-1);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.track-artist {
	font-size: 0.75rem;
	color: var(--text-2);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.more-hint {
	font-size: 0.78rem;
	color: var(--text-3);
	margin-bottom: 20px;
	text-align: center;
}

/* ── Buttons ───────────────────────────────────────────────────────────── */
.button-group {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin-top: 20px;
}

.btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	padding: 15px 28px;
	border-radius: 9999px;
	font-size: 1rem;
	font-weight: 600;
	text-decoration: none;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	cursor: pointer;
}

.btn-primary {
	background-color: var(--primary);
	color: var(--primary-fg);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.btn-primary:hover {
	opacity: 0.88;
	transform: translateY(-1px);
}

.btn-secondary {
	background-color: var(--secondary-bg);
	color: var(--secondary-fg);
}

.btn-secondary:hover {
	opacity: 0.8;
	transform: translateY(-1px);
}

.btn-icon {
	opacity: 0.9;
}

/* ── Error ─────────────────────────────────────────────────────────────── */
.error-icon {
	color: #ef4444;
	margin: 0 auto 20px;
	display: flex;
	justify-content: center;
}

.error-title {
	font-size: 1.2rem;
	font-weight: 600;
	margin-bottom: 8px;
	color: var(--text-1);
}

.error-desc {
	font-size: 0.9rem;
	color: var(--text-2);
}

/* ── Footer ────────────────────────────────────────────────────────────── */
.footer {
	margin-top: 24px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	text-align: center;
	opacity: 0.75;
}

.hint {
	font-size: 0.85rem;
	color: var(--text-2);
	font-weight: 500;
}

.footer-link {
	font-size: 0.85rem;
	color: var(--text-2);
	text-decoration: none;
}

.footer-link:hover {
	text-decoration: underline;
	opacity: 1;
}

/* ── In-app browser overlay ────────────────────────────────────────────── */
.browser-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.85);
	backdrop-filter: blur(8px);
	z-index: 9999;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 32px;
	animation: fadeUp 0.3s ease-out;
}

.overlay-content {
	text-align: center;
	color: white;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
}

.overlay-icon {
	opacity: 0.9;
}

.overlay-title {
	font-size: 1.5rem;
	font-weight: 700;
	color: white;
	margin: 0;
}

.overlay-desc {
	font-size: 1rem;
	opacity: 0.8;
	line-height: 1.6;
	max-width: 280px;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
	.page {
		padding: 16px;
		justify-content: flex-start;
		padding-top: 32px;
	}

	.card {
		padding: 28px 20px;
		box-shadow: none;
		background: transparent !important;
		border: none !important;
	}

	.cover-wrapper {
		width: 160px;
		height: 160px;
		margin-bottom: 20px;
	}

	.playlist-title {
		font-size: 1.25rem;
	}
}
</style>
