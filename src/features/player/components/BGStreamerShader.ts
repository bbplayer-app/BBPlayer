import useAppStore from '@/hooks/stores/useAppStore'
import { toastAndLogError } from '@/utils/error-handling'
import { reportErrorToSentry } from '@/utils/log'
import type { SkRuntimeEffect } from '@shopify/react-native-skia'
import { Skia } from '@shopify/react-native-skia'

const GLSL_SHADER_SOURCE = `
  uniform float time;       // 时间
  uniform vec2 resolution;  // 屏幕分辨率
  uniform vec4 color1;      // 颜色1 (波谷)
  uniform vec4 color2;      // 颜色2 (波峰)

  vec4 main(vec2 fragCoord) {
    vec2 uv = fragCoord.xy / resolution.xy;
    
    float wave1 = sin(uv.x * 1.5 + time * 1) * 0.5 + 0.5;
    float wave2 = sin(uv.y * 1.0 - time * 0.5) * 0.5 + 0.5;
    
    float combinedWaves = wave1 + wave2 + time * 0.2;
    
    float blendFactor = sin(combinedWaves * 3.14159);
    
    blendFactor = pow(blendFactor * 0.5 + 0.5, 2.0); 
    
    vec4 finalColor = mix(color1, color2, blendFactor);
    
    return finalColor;
  }
`

let backgroundStreamerShader: SkRuntimeEffect | null = null

try {
	backgroundStreamerShader = Skia.RuntimeEffect.Make(GLSL_SHADER_SOURCE)
} catch (e) {
	toastAndLogError(
		'无法加载流光效果着色器，已自动回退到渐变模式',
		e,
		'Features.Player.BGStreamerShader',
	)
	reportErrorToSentry(
		e,
		'无法加载流光效果着色器',
		'Features.Player.BGStreamerShader',
	)
	useAppStore.getState().setPlayerBackgroundStyle('gradient')
}

export default backgroundStreamerShader
