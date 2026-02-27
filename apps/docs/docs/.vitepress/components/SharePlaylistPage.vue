<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
	ListMusic,
	Play,
	AlertCircle,
	ExternalLink,
	User,
	Music2,
	Users,
	Share2,
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
	} catch {
		error.value = '网络错误，请稍后重试'
	} finally {
		loading.value = false
	}
})

// ── Computed ───────────────────────────────────────────────────────────────
const isInvite = computed(() => !!inviteCode.value)

const bannerText = computed(() => {
	if (!data.value?.owner)
		return isInvite.value ? '邀请你共同编辑歌单' : '分享了一个歌单给你'
	const name = data.value.owner.name
	return isInvite.value
		? `${name} 邀请你共同编辑歌单`
		: `${name} 分享了一个歌单给你`
})

const bbplayerDeepLink = computed(() => {
	if (!shareId.value) return ''
	const params = new URLSearchParams({ shareId: shareId.value })
	if (inviteCode.value) params.set('inviteCode', inviteCode.value)
	return `bbplayer://share/playlist?${params.toString()}`
})

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
					:size="40"
					class="overlay-icon"
				/>
				<h3 class="overlay-title">请在浏览器打开</h3>
				<p class="overlay-desc">点击右上角菜单，选择在浏览器中打开以继续</p>
			</div>
		</div>

		<!-- Loading skeleton -->
		<div
			v-if="loading"
			class="card"
		>
			<div class="skeleton cover-skeleton" />
			<div class="skeleton title-skeleton" />
			<div class="skeleton subtitle-skeleton" />
			<div class="skeleton btn-skeleton" />
		</div>

		<!-- Error state -->
		<div
			v-else-if="error"
			class="card center-card"
		>
			<AlertCircle
				:size="56"
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
			<!-- Banner -->
			<div
				class="banner"
				:class="isInvite ? 'banner-invite' : 'banner-share'"
			>
				<component
					:is="isInvite ? Users : Share2"
					:size="14"
					class="banner-icon"
				/>
				<span>{{ bannerText }}</span>
			</div>

			<!-- Scrollable body -->
			<div class="card-body">
				<!-- Header: cover + meta side by side -->
				<div class="header-row">
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
							<ListMusic :size="40" />
						</div>
					</div>

					<div class="meta">
						<h1 class="playlist-title">
							{{ data.playlist.title || '未命名歌单' }}
						</h1>
						<p
							v-if="data.playlist.description"
							class="playlist-desc"
						>
							{{ data.playlist.description }}
						</p>
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
								<User :size="12" />
							</div>
							<span class="owner-name">{{ data.owner.name }}</span>
						</div>
						<span class="track-count"
							>{{ data.playlist.track_count }} 首曲目</span
						>
					</div>
				</div>

				<!-- Track list -->
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
							<Music2 :size="13" />
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
					仅预览前 {{ data.preview_limit }} 首 · 订阅后自动同步全部曲目
				</p>
			</div>

			<!-- Action buttons (pinned to bottom of card) -->
			<div class="button-group">
				<a
					:href="bbplayerDeepLink"
					class="btn btn-primary"
				>
					<Play
						:size="18"
						fill="currentColor"
						class="btn-icon"
					/>
					{{ isInvite ? '接受邀请，在 BBPlayer 中打开' : '在 BBPlayer 中订阅' }}
				</a>
				<a
					:href="bbplayerAppLink"
					class="btn btn-secondary"
				>
					<ExternalLink
						:size="16"
						class="btn-icon"
					/>
					通过 App Link 打开
				</a>
			</div>
		</div>

		<!-- Footer -->
		<div class="footer">
			<a
				href="https://bbplayer.roitium.com"
				target="_blank"
				class="footer-link"
			>
				BBPlayer · bbplayer.roitium.com
			</a>
		</div>
	</div>
</template>

<style scoped>
/* ── Design tokens ─────────────────────────────────────────────────────── */
.page {
	--bg: #dde1e7;
	--card-bg: #ffffff;
	--text-1: #0f172a;
	--text-2: #64748b;
	--text-3: #94a3b8;
	--primary: #0f172a;
	--primary-fg: #ffffff;
	--secondary-bg: #f1f5f9;
	--secondary-fg: #334155;
	--border: rgba(0, 0, 0, 0.08);
	--track-hover: #f8fafc;
	--card-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.06);
}

@media (prefers-color-scheme: dark) {
	.page {
		--bg: #0a0a0f;
		--card-bg: #16161e;
		--text-1: #f1f5f9;
		--text-2: #94a3b8;
		--text-3: #475569;
		--primary: #f1f5f9;
		--primary-fg: #0f172a;
		--secondary-bg: #1e1e2a;
		--secondary-fg: #cbd5e1;
		--border: rgba(255, 255, 255, 0.08);
		--track-hover: #1e1e2a;
		--card-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 1px 4px rgba(0, 0, 0, 0.3);
	}
}

/* ── Layout: locked to viewport, no page scroll ────────────────────────── */
.page {
	height: 100dvh;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 20px 16px 12px;
	background-color: var(--bg);
	font-family:
		-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
		Arial, sans-serif;
	color: var(--text-1);
	box-sizing: border-box;
}

/* ── Card ──────────────────────────────────────────────────────────────── */
.card {
	background: var(--card-bg);
	border-radius: 20px;
	max-width: 480px;
	width: 100%;
	border: 1px solid var(--border);
	box-shadow: var(--card-shadow);
	animation: fadeUp 0.45s ease-out both;
	/* flex column so card-body can grow and buttons stay at bottom */
	display: flex;
	flex-direction: column;
	/* card must not exceed viewport */
	max-height: calc(100dvh - 80px);
	overflow: hidden;
}

/* skeleton / error cards don't need inner flex scroll */
.center-card {
	padding: 48px 40px;
	text-align: center;
	align-items: center;
}

@keyframes fadeUp {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

/* ── Banner ────────────────────────────────────────────────────────────── */
.banner {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 18px;
	font-size: 0.8rem;
	font-weight: 500;
	border-bottom: 1px solid var(--border);
	flex-shrink: 0;
}

.banner-share {
	background: color-mix(in srgb, #3b82f6 8%, transparent);
	color: #3b82f6;
}

.banner-invite {
	background: color-mix(in srgb, #8b5cf6 8%, transparent);
	color: #8b5cf6;
}

@media (prefers-color-scheme: dark) {
	.banner-share {
		color: #93c5fd;
		background: color-mix(in srgb, #3b82f6 12%, transparent);
	}
	.banner-invite {
		color: #c4b5fd;
		background: color-mix(in srgb, #8b5cf6 12%, transparent);
	}
}

.banner-icon {
	flex-shrink: 0;
}

/* ── Scrollable body ───────────────────────────────────────────────────── */
.card-body {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding: 20px 20px 0;
	scrollbar-width: thin;
	scrollbar-color: var(--border) transparent;
}

/* ── Header row: cover + meta ──────────────────────────────────────────── */
.header-row {
	display: flex;
	gap: 16px;
	align-items: flex-start;
	margin-bottom: 16px;
}

.cover-wrapper {
	width: 88px;
	height: 88px;
	border-radius: 12px;
	overflow: hidden;
	flex-shrink: 0;
	background: var(--secondary-bg);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
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

.meta {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding-top: 2px;
}

.playlist-title {
	font-size: 1.05rem;
	font-weight: 700;
	color: var(--text-1);
	line-height: 1.35;
	word-break: break-word;
	margin: 0 0 2px;
}

.playlist-desc {
	font-size: 0.8rem;
	color: var(--text-2);
	line-height: 1.5;
	margin: 0;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.owner-row {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-top: 4px;
}

.owner-avatar {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	object-fit: cover;
}

.owner-avatar-placeholder {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--secondary-bg);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-3);
}

.owner-name {
	font-size: 0.8rem;
	font-weight: 500;
	color: var(--text-2);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.track-count {
	font-size: 0.78rem;
	color: var(--text-3);
	margin-top: 2px;
}

/* ── Track list ────────────────────────────────────────────────────────── */
.track-list {
	list-style: none;
	margin: 0;
	padding: 0;
	border: 1px solid var(--border);
	border-radius: 12px;
	overflow: hidden;
}

.track-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 9px 12px;
	border-bottom: 1px solid var(--border);
	transition: background 0.12s ease;
}

.track-item:last-child {
	border-bottom: none;
}

.track-item:hover {
	background: var(--track-hover);
}

.track-index {
	font-size: 0.7rem;
	color: var(--text-3);
	width: 16px;
	text-align: right;
	flex-shrink: 0;
}

.track-cover {
	width: 32px;
	height: 32px;
	border-radius: 6px;
	object-fit: cover;
	flex-shrink: 0;
}

.track-cover-placeholder {
	width: 32px;
	height: 32px;
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
}

.track-title {
	display: block;
	font-size: 0.825rem;
	font-weight: 500;
	color: var(--text-1);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 1.4;
}

.track-artist {
	display: block;
	font-size: 0.72rem;
	color: var(--text-3);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.more-hint {
	font-size: 0.75rem;
	color: var(--text-3);
	text-align: center;
	padding: 10px 0 4px;
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */
.skeleton {
	background: var(--secondary-bg);
	border-radius: 10px;
	animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
	0%,
	100% {
		opacity: 0.5;
	}
	50% {
		opacity: 1;
	}
}

.cover-skeleton {
	width: 88px;
	height: 88px;
	border-radius: 12px;
	margin: 20px 20px 0;
}
.title-skeleton {
	height: 20px;
	width: 55%;
	margin: 16px 20px 8px;
}
.subtitle-skeleton {
	height: 14px;
	width: 35%;
	margin: 0 20px 20px;
}
.btn-skeleton {
	height: 48px;
	margin: 16px 20px 20px;
	border-radius: 12px;
}

/* ── Buttons ───────────────────────────────────────────────────────────── */
.button-group {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 14px 16px 16px;
	flex-shrink: 0;
	border-top: 1px solid var(--border);
}

.btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 13px 20px;
	border-radius: 12px;
	font-size: 0.9rem;
	font-weight: 600;
	text-decoration: none;
	transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
	cursor: pointer;
	line-height: 1;
}

.btn-primary {
	background-color: var(--primary);
	color: var(--primary-fg);
}

.btn-primary:hover {
	opacity: 0.85;
	transform: translateY(-1px);
}

.btn-secondary {
	background-color: var(--secondary-bg);
	color: var(--secondary-fg);
	font-weight: 500;
}

.btn-secondary:hover {
	opacity: 0.75;
}

.btn-icon {
	flex-shrink: 0;
}

/* ── Error ─────────────────────────────────────────────────────────────── */
.error-icon {
	color: #f87171;
	margin-bottom: 16px;
}

.error-title {
	font-size: 1.1rem;
	font-weight: 600;
	margin: 0 0 8px;
	color: var(--text-1);
}

.error-desc {
	font-size: 0.875rem;
	color: var(--text-2);
	margin: 0;
}

/* ── Footer ────────────────────────────────────────────────────────────── */
.footer {
	margin-top: 12px;
	text-align: center;
}

.footer-link {
	font-size: 0.78rem;
	color: var(--text-3);
	text-decoration: none;
}

.footer-link:hover {
	color: var(--text-2);
}

/* ── In-app browser overlay ────────────────────────────────────────────── */
.browser-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.88);
	backdrop-filter: blur(10px);
	z-index: 9999;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 32px;
}

.overlay-content {
	text-align: center;
	color: white;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 14px;
	max-width: 280px;
}

.overlay-icon {
	opacity: 0.85;
}

.overlay-title {
	font-size: 1.4rem;
	font-weight: 700;
	margin: 0;
}

.overlay-desc {
	font-size: 0.95rem;
	opacity: 0.75;
	line-height: 1.6;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
	.page {
		padding: 12px 12px 10px;
	}

	.card {
		border-radius: 16px;
		max-height: calc(100dvh - 60px);
	}
}
</style>

<!-- 全局覆盖：让 html/body 背景跟随 .page，消除白边 -->
<style>
html,
body {
	margin: 0;
	padding: 0;
	background: #dde1e7;
}

@media (prefers-color-scheme: dark) {
	html,
	body {
		background: #0a0a0f;
	}
}
</style>
