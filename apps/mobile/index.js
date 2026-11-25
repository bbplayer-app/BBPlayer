// 必须是第一个 import：import 会被提升到入口代码之前按顺序求值，profiler 要在其他模块之前启动
import './src/lib/startupProfiling'

import { enableFreeze } from 'react-native-screens'

enableFreeze(true)

import { playerSideEffects } from './src/lib/player/PlayerSideEffects'

playerSideEffects.initialize()

import { initializeUpdateRequestHeaders } from './src/lib/services/updateTelemetry'

// 越早越好：把安装 id 与当前渠道写入 expo-updates 原生 override 并持久化，
// 使后续（含崩溃后的下一次）冷启动的原生 update check 能正确路由并携带该 id。
void initializeUpdateRequestHeaders()

import 'expo-router/entry'
