import { Skia } from '@shopify/react-native-skia'

const GLSL_SHADER_SOURCE = `
  uniform float time;       // 时间
  uniform vec2 resolution;  // 屏幕分辨率
  uniform vec4 color1;      // 颜色1 (波谷)
  uniform vec4 color2;      // 颜色2 (波峰)

  vec4 main(vec2 fragCoord) {
    vec2 uv = fragCoord.xy / resolution.xy;
    
    // 1. 创建两个“更宽”的波浪
    float wave1 = sin(uv.x * 1.5 + time * 0.1) * 0.5 + 0.5;
    float wave2 = sin(uv.y * 1.0 - time * 0.05) * 0.5 + 0.5;
    
    // 2. 将这两个波浪叠加起来
    float combinedWaves = wave1 + wave2 + time * 0.02;
    
    // 3. 【关键修复】将输入范围拉伸，让 sin() 完整摆动
    float blendFactor = sin(combinedWaves * 3.14159);
    
    // 4. 再次进行标准化，把 [-1, 1] 映射到 [0, 1]
    blendFactor = pow(blendFactor * 0.5 + 0.5, 2.0); 
    
    // 5. 根据混合因子插值两种颜色
    vec4 finalColor = mix(color1, color2, blendFactor);
    
    return finalColor;
  }
`

const backgroundStreamerShader = Skia.RuntimeEffect.Make(GLSL_SHADER_SOURCE)

export default backgroundStreamerShader
