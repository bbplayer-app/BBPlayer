import { startProfiling } from 'react-native-release-profiler'

startProfiling()

import { playerSideEffects } from './src/lib/player/PlayerSideEffects'

playerSideEffects.initialize()

import 'expo-router/entry'
