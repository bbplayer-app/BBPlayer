import { AppRegistry } from 'react-native'
import TrackPlayer from 'react-native-track-player'
import Main from './src/app/layout'
import { PlaybackService } from './src/lib/player/playbackService'

// 定义一个全局变量，避免二次初始化 player
global.playerIsReady = false

TrackPlayer.registerPlaybackService(() => PlaybackService)

AppRegistry.registerComponent('main', () => Main)
