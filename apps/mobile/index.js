import { startProfiling } from 'react-native-release-profiler'

startProfiling()

import { playerSideEffects } from './src/lib/player/PlayerSideEffects'

playerSideEffects.initialize()

import { initializeUpdateRequestHeaders } from './src/lib/services/updateTelemetry'

// 越早越好：把安装 id 写入 expo-updates 原生 override 并持久化，使后续
// （含崩溃后的下一次）冷启动的原生 update check 都能携带该 id
void initializeUpdateRequestHeaders()

import 'expo-router/entry'
