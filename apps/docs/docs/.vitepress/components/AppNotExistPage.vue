<script setup lang="ts">
import { Download, Github } from "lucide-vue-next";

const githubUrl = "https://github.com/bbplayer-app/bbplayer/releases";
</script>

<template>
  <div class="app-not-exist-container">
    <div class="content-card">
      <div class="icon-wrapper">
        <Download :size="64" class="main-icon" />
      </div>

      <h1 class="title">未检测到 BBPlayer</h1>
      <p class="description">
        似乎您还没有安装 BBPlayer，或者跳转失败了。<br />
        请前往 GitHub 下载最新版本。
      </p>

      <div class="button-group">
        <a
          :href="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-primary"
        >
          <Github class="btn-icon" :size="20" />
          前往 GitHub 下载
        </a>
      </div>
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

.app-not-exist-container {
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

.content-card {
  background: var(--card-bg);
  border-radius: 24px;
  padding: 64px 48px;
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
  .content-card {
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

.icon-wrapper {
  margin: 0 auto 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.main-icon {
  opacity: 0.9;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
  line-height: 1.3;
}

.description {
  font-size: 1.05rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 40px;
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

@media (max-width: 480px) {
  .app-not-exist-container {
    padding: 16px;
  }

  .content-card {
    padding: 48px 24px;
    box-shadow: none;
    background: transparent !important;
    border: none !important;
    backdrop-filter: none !important;
  }
  
  .title {
    font-size: 1.5rem;
  }
}
</style>
