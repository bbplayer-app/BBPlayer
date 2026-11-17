const fs = require('node:fs')
const path = require('node:path')

const configPlugins = require('expo/config-plugins')

const { withDangerousMod } = configPlugins

const LGPL_HASH = 'LGPL-2.1'
// AboutLibraries 自带的 SPDX 许可证，直接引用
const APACHE_HASH = 'Apache-2.0'

/**
 * 补充或修正 AboutLibraries 从 Maven POM 读到的许可证信息。
 *
 * AboutLibraries 会按 uniqueId 把 `android/config/libraries` 里的条目合并进自动收集的结果
 * （react-native-legal 也把 JS 依赖写在这个目录，不会清空它）。合并时许可证是追加而不是替换。
 *
 * - media3-ffmpeg-decoder：Jellyfin 的包在 POM 里标注 GPL-3.0（保留），其中分发的 FFmpeg 以 LGPL 2.1+ 发布。
 *   LGPL 要求说明的来源、编译配置和可替换方式都写在说明里，显示在「关于 → 第三方组件许可」
 * - JitPack 上的包没有 POM 许可证信息，按源码仓库的许可证补上
 */
const OVERRIDES = [
	{
		uniqueId: 'org.jellyfin.media3:media3-ffmpeg-decoder',
		name: 'FFmpeg（media3-ffmpeg-decoder）',
		description:
			'不走音频 offload 时用于在应用内解码 AAC、FLAC、MP3。由 Jellyfin 用 AndroidX Media3 的 decoder_ffmpeg 模块和 FFmpeg 6.0.2（提交 37c90f5）编译，只启用了 flac alac pcm_mulaw pcm_alaw mp3 aac ac3 eac3 dca mlp truehd 解码器，未启用 GPL 与 nonfree 组件。FFmpeg 以 LGPL 2.1 或更高版本发布，源码见 https://git.ffmpeg.org/ffmpeg.git；以动态库 libffmpegJNI.so 的形式链接，可以替换为自行编译的同名动态库。Maven 包本身标注为 GPL-3.0',
		website: 'https://github.com/jellyfin/jellyfin-androidx-media',
		licenses: [LGPL_HASH],
	},
	{
		uniqueId: 'com.github.HChenX:SuperLyricApi',
		name: 'SuperLyricApi',
		website: 'https://github.com/HChenX/SuperLyricApi',
		licenses: [LGPL_HASH],
	},
	{
		uniqueId: 'com.github.chrisbanes:PhotoView',
		name: 'PhotoView',
		website: 'https://github.com/Baseflow/PhotoView',
		licenses: [APACHE_HASH],
	},
]

const withLicenseOverrides = (config) =>
	withDangerousMod(config, [
		'android',
		(config) => {
			const configDir = path.join(
				config.modRequest.platformProjectRoot,
				'config',
			)
			const librariesDir = path.join(configDir, 'libraries')
			const licensesDir = path.join(configDir, 'licenses')
			fs.mkdirSync(librariesDir, { recursive: true })
			fs.mkdirSync(licensesDir, { recursive: true })

			fs.writeFileSync(
				path.join(licensesDir, `${LGPL_HASH}.json`),
				JSON.stringify({
					hash: LGPL_HASH,
					name: 'GNU Lesser General Public License v2.1',
					url: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html',
					content: fs.readFileSync(
						path.join(__dirname, 'licenses/LGPL-2.1.txt'),
						'utf8',
					),
				}),
			)

			for (const library of OVERRIDES) {
				fs.writeFileSync(
					path.join(
						librariesDir,
						`${library.uniqueId.replace(/[^\w.-]/g, '_')}.json`,
					),
					JSON.stringify(library),
				)
			}

			return config
		},
	])

module.exports = withLicenseOverrides
