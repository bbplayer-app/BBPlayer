<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download, Github, RefreshCw } from 'lucide-vue-next'

const githubUrl = 'https://github.com/bbplayer-app/bbplayer/releases'

// 从 query 参数里获取原始跳转目标，转换为 bbplayer:// scheme
const schemeUrl = ref('')

onMounted(() => {
	const params = new URLSearchParams(window.location.search)
	const from = params.get('from')
	if (!from) return

	try {
		// 支持 app.bbplayer.roitium.com/app/link-to/<path?query>
		// 也兼容其他形式，只要包含 /link-to/
		const linkToMarker = '/link-to/'
		const idx = from.indexOf(linkToMarker)
		if (idx !== -1) {
			// 取 /link-to/ 后面的部分：path + query
			const rest = from.slice(idx + linkToMarker.length)
			schemeUrl.value = `bbplayer://${rest}`
		}
	} catch {
		// 无法解析则静默失败，不显示重试按钮
	}
})
</script>

<template>
	<div class="page">
		<div class="card center-card">
			<div class="icon-wrapper">
				<Download
					:size="52"
					class="main-icon"
				/>
			</div>
			<h1 class="page-title">未检测到 BBPlayer</h1>
			<p class="page-desc">
				<template v-if="schemeUrl">
					应用未能打开，可能是 BBPlayer 还未安装。<br />
					点击「重试打开」再试一次，或前往 GitHub 下载安装。
				</template>
				<template v-else>
					似乎您还没有安装 BBPlayer，或者跳转失败了。<br />
					请前往 GitHub 下载最新版本。
				</template>
			</p>
			<div class="button-group">
				<!-- 回退方案：有 from 参数时显示重试按钮 -->
				<a
					v-if="schemeUrl"
					:href="schemeUrl"
					class="btn btn-primary"
				>
					<RefreshCw
						class="btn-icon"
						:size="16"
					/>
					重试打开
				</a>
				<a
					:href="githubUrl"
					target="_blank"
					rel="noopener noreferrer"
					:class="schemeUrl ? 'btn btn-secondary' : 'btn btn-primary'"
				>
					<Github
						class="btn-icon"
						:size="18"
					/>
					前往 GitHub 下载
				</a>
			</div>
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

/* ── Center card ───────────────────────────────────────────────────────── */
.center-card {
	max-width: 420px;
	padding: 48px 40px 0;
	text-align: center;
	align-items: center;
}

.icon-wrapper {
	margin-bottom: 28px;
	color: var(--text-1);
	opacity: 0.85;
}

.page-title {
	font-size: 1.6rem;
	font-weight: 700;
	color: var(--text-1);
	margin: 0 0 12px;
	line-height: 1.3;
}

.page-desc {
	font-size: 1rem;
	color: var(--text-2);
	line-height: 1.65;
	margin: 0 0 28px;
}

/* button-group: no border-top for simple center card */
.center-card .button-group {
	width: 100%;
	border-top: none;
	padding-top: 0;
	padding-bottom: 40px;
}

/* ── Responsive ────────────────────────────────────────────────────────── */
@media (max-width: 480px) {
	.center-card {
		padding: 40px 28px 0;
	}

	.page-title {
		font-size: 1.35rem;
	}
}
</style>
