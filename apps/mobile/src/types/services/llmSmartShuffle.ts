import type { Playlist, Track } from '@/types/core/media'

export interface TrackLlmTags {
	language: string[]
	vocalType: string[]
	genre: string[]
	mood: string[]
	scene: string[]
	timePreference: string[]
}

export interface TrackTagIndex {
	trackId: number
	tags: TrackLlmTags
	confidence: number
	reason?: string
}

export interface SmartShufflePreference {
	preferredTags: string[]
	downrankTags: string[]
	timeBias: 'recent' | 'old' | 'balanced'
	explorationLevel: 'conservative' | 'balanced' | 'exploratory'
	repeatAvoidance: boolean
	temporary: boolean
}

export interface TrackIndexContext {
	track: Track
	sourceType?: Playlist['type']
	sourceId?: string
	sourceSyncedAt?: Date
}

export interface SmartQueueOptions {
	prompt?: string
	defaultPreference?: string
}
