<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { Play, Tv2, AlertCircle, Music2, ExternalLink } from "lucide-vue-next";

const id = ref("");
const title = ref("");
const cover = ref("");
const error = ref("");
const bvid = ref("");
const cid = ref("");
const p = ref("");
const isOnInAppBrowser = ref(false);

onMounted(() => {
  // Check for in-app browser
  // Matches: WeChat, QQ, Weibo, Alipay, DingTalk, Zhihu, Baidu, Bilibili (in-app)
  const ua = navigator.userAgent;
  isOnInAppBrowser.value = /MicroMessenger|QQ\/|Weibo|AlipayClient|DingTalk|ZhihuHybrid|BaiduBoxApp/i.test(ua);

  const params = new URLSearchParams(window.location.search);
  id.value = params.get("id") || "";
  title.value = params.get("title") || "";
  cover.value = params.get("cover") || "";
  p.value = params.get("p") || "";

  // Parse bilibili id
  if (id.value.startsWith("bilibili::")) {
    const parts = id.value.split("::");
    if (parts.length >= 2) {
      bvid.value = parts[1];
      if (parts.length >= 3) {
        cid.value = parts[2];
      }
    } else {
      error.value = "无效的分享链接";
    }
  } else {
    error.value = "暂不支持此来源的分享链接";
  }
});

const bilibiliUrl = computed(() => {
  if (!bvid.value) return "";
  let url = `https://www.bilibili.com/video/${bvid.value}`;
  if (p.value) {
    url += `?p=${p.value}`;
  } else if (cid.value) {
    url += `?p=1`;
  }
  return url;
});

const bbplayerUrl = computed(() => {
  if (!bvid.value) return "";
  if (cid.value) {
    return `bbplayer://playlist/remote/multipage/${bvid.value}?cid=${cid.value}`;
  }
  return `bbplayer://playlist/remote/search-result/global/${bvid.value}`;
});

const bbplayerAppLinkUrl = computed(() => {
  if (!bvid.value) return "";
  if (cid.value) {
    return `https://app.bbplayer.roitium.com/playlist/remote/multipage/${bvid.value}?cid=${cid.value}`;
  }
  return `https://app.bbplayer.roitium.com/playlist/remote/search-result/global/${bvid.value}`;
});
</script>

<template>
  <div class="share-track-container">
    <div v-if="isOnInAppBrowser" class="browser-overlay">
      <div class="overlay-content">
        <div class="overlay-icon-wrapper">
          <ExternalLink :size="48" class="overlay-icon" />
        </div>
        <h3 class="overlay-title">请在浏览器打开</h3>
        <p class="overlay-desc">点击右上角菜单，选择在浏览器打开以继续</p>
      </div>
    </div>
    
    <div class="share-card" v-if="!error">
      <div class="cover-wrapper">
        <img
          v-if="cover"
          :src="cover"
          :alt="title"
          class="cover-image"
          referrerpolicy="no-referrer"
        />
        <div v-else class="cover-placeholder">
          <Music2 :size="64" class="placeholder-icon" />
        </div>
      </div>

      <h1 class="track-title">{{ title || "未知曲目" }}</h1>

      <div class="button-group">
        <a
          :href="bilibiliUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-secondary"
        >
          <Tv2 class="btn-icon" :size="20" />
          在 Bilibili 打开
        </a>

        <a :href="bbplayerUrl" class="btn btn-primary">
          <Play class="btn-icon" :size="20" fill="currentColor" />
          在 BBPlayer 打开
        </a>
      </div>
    </div>

    <div class="error-card" v-else>
      <div class="error-icon">
        <AlertCircle :size="64" />
      </div>
      <h2 class="error-title">{{ error }}</h2>
      <p class="error-desc">请检查分享链接是否正确</p>
    </div>

    <div class="footer">
      <p class="hint">来自 BBPlayer | 由 Roitium ❤️ 构建</p>
      <a href="https://bbplayer.roitium.com" target="_blank" class="footer-link">bbplayer.roitium.com</a>
    </div>
  </div>
</template>

<style scoped>
:root {
  --bg-color: #f9fafb;
  --card-bg: #ffffff;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --primary-color: #18181b;
  --primary-fg: #ffffff;
  --secondary-bg: #f3f4f6;
  --secondary-fg: #1f2937;
  --border-color: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #09090b;
    --card-bg: #18181b;
    --text-primary: #f9fafb;
    --text-secondary: #a1a1aa;
    --primary-color: #fafafa;
    --primary-fg: #18181b;
    --secondary-bg: #27272a;
    --secondary-fg: #e4e4e7;
    --border-color: #27272a;
  }
}

.share-track-container {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--bg-color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text-primary);
  transition: background-color 0.5s ease;
}

.share-card {
  background: var(--card-bg);
  border-radius: 24px;
  padding: 48px;
  max-width: 480px;
  width: 100%;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  border: 1px solid var(--border-color);
  animation: fadeIn 0.6s ease-out;
  transition: all 0.5s ease;
  margin: auto;
}

@media (prefers-color-scheme: dark) {
  .share-card {
    box-shadow: none;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cover-wrapper {
  width: 240px;
  height: 240px;
  margin: 0 auto 32px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
  background-color: var(--secondary-bg);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.cover-image:hover {
  transform: scale(1.03);
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.track-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 40px;
  line-height: 1.4;
  word-break: break-word;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 32px;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.btn-primary {
  background-color: var(--primary-color);
  color: var(--primary-fg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  opacity: 0.9;
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

.footer {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  opacity: 0.8;
  text-align: center;
}

.hint {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.footer-link {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  opacity: 0.8;
}

.footer-link:hover {
  text-decoration: underline;
  opacity: 1;
}

.error-card {
  background: var(--card-bg);
  border-radius: 24px;
  padding: 48px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  border: 1px solid var(--border-color);
  animation: fadeIn 0.5s ease-out;
  margin: auto;
}

.error-icon {
  margin: 0 auto 24px;
  color: #ef4444;
  display: flex;
  justify-content: center;
}

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.error-desc {
  font-size: 0.95rem;
  color: var(--text-secondary);
}

@media (max-width: 480px) {
  .share-track-container {
    padding: 16px;
  }

  .share-card {
    padding: 32px 24px;
    box-shadow: none;
    background: transparent !important;
    border: none !important;
    backdrop-filter: none !important;
  }
  
  .cover-wrapper {
    width: 200px;
    height: 200px;
    margin-bottom: 24px;
  }
  
  .track-title {
    font-size: 1.25rem;
    margin-bottom: 32px;
  }
}

.browser-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  animation: fadeIn 0.3s ease-out;
}

.overlay-content {
  text-align: center;
  color: white;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.overlay-icon-wrapper {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
  width: 100%;
}

.overlay-icon {
  opacity: 0.9;
}

.overlay-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: white;
}

.overlay-desc {
  font-size: 1rem;
  opacity: 0.8;
  line-height: 1.6;
}
</style>
