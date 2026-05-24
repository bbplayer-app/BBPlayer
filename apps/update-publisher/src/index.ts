#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	select,
	spinner,
} from '@clack/prompts'

interface GitHubAsset {
	name: string
	browser_download_url: string
}

interface GitHubRelease {
	tag_name: string
	name: string | null
	body: string | null
	html_url: string
	draft: boolean
	prerelease: boolean
	published_at: string | null
	assets: GitHubAsset[]
}

interface UpdateManifest {
	version: string
	url: string
	downloads?: {
		android?: Record<string, string>
	}
	notes: string
	listed_notes?: string[]
	forced: boolean
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const DEFAULT_REPO = 'bbplayer-app/BBPlayer'
const UPDATE_KEY = 'update_json'
const ANDROID_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'] as const

async function main() {
	intro('BBPlayer update publisher')
	const repo = process.env.BBPLAYER_UPDATE_REPO ?? DEFAULT_REPO
	const releaseSpinner = spinner()
	releaseSpinner.start(`Fetching recent releases from ${repo}`)
	const releases = await fetchRecentReleases(repo)
	releaseSpinner.stop(`Fetched ${releases.length} releases`)

	const selected = await selectRelease(releases)
	const manifest = createManifest(selected)
	const tempPath = await writeTempManifest(manifest)

	await openInZed(tempPath)

	const edited = await readManifest(tempPath)
	printManifestSummary(edited)

	const shouldPublish = await confirm({
		message: 'Publish this update.json to Cloudflare KV?',
		initialValue: false,
	})
	if (isCancel(shouldPublish)) {
		cancel('Cancelled')
		return
	}
	if (!shouldPublish) {
		outro(`Not published. Edited file remains at ${tempPath}`)
		return
	}

	const publishSpinner = spinner()
	publishSpinner.start('Publishing update_json to Cloudflare Workers KV')
	await publishToWorkersKv(tempPath)
	publishSpinner.stop('Published update_json to Cloudflare Workers KV')
	outro('Done')
}

async function fetchRecentReleases(repo: string): Promise<GitHubRelease[]> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'User-Agent': '@bbplayer/update-publisher',
		'X-GitHub-Api-Version': '2022-11-28',
	}
	if (process.env.GITHUB_TOKEN) {
		headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
	}

	const url = `https://api.github.com/repos/${repo}/releases?per_page=8`
	const res = await fetch(url, { headers })
	if (!res.ok) {
		throw new Error(
			`GitHub releases request failed: ${res.status} ${res.statusText}`,
		)
	}

	const json: unknown = await res.json()
	if (!Array.isArray(json)) {
		throw new Error('GitHub releases response is not an array')
	}

	return json.map(parseRelease)
}

function parseRelease(value: unknown): GitHubRelease {
	if (typeof value !== 'object' || value === null) {
		throw new Error('Invalid GitHub release item')
	}
	const item = value as Record<string, unknown>
	const assets = Array.isArray(item.assets) ? item.assets.map(parseAsset) : []
	return {
		tag_name: requireString(item.tag_name, 'tag_name'),
		name: typeof item.name === 'string' ? item.name : null,
		body: typeof item.body === 'string' ? item.body : null,
		html_url: requireString(item.html_url, 'html_url'),
		draft: item.draft === true,
		prerelease: item.prerelease === true,
		published_at:
			typeof item.published_at === 'string' ? item.published_at : null,
		assets,
	}
}

function parseAsset(value: unknown): GitHubAsset {
	if (typeof value !== 'object' || value === null) {
		throw new Error('Invalid GitHub release asset')
	}
	const item = value as Record<string, unknown>
	return {
		name: requireString(item.name, 'asset.name'),
		browser_download_url: requireString(
			item.browser_download_url,
			'asset.browser_download_url',
		),
	}
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== 'string') {
		throw new Error(`Missing string field: ${field}`)
	}
	return value
}

async function selectRelease(
	releases: GitHubRelease[],
): Promise<GitHubRelease> {
	if (releases.length === 0) {
		throw new Error('No GitHub releases found')
	}

	const selected = await select({
		message: 'Select GitHub release',
		options: releases.map((release) => ({
			value: release.tag_name,
			label: formatReleaseLabel(release),
			hint: release.html_url,
		})),
	})

	if (isCancel(selected)) {
		cancel('Cancelled')
		process.exit(0)
	}

	const release = releases.find((item) => item.tag_name === selected)
	if (!release) {
		throw new Error(`Selected release not found: ${selected}`)
	}
	return release
}

function formatReleaseLabel(release: GitHubRelease): string {
	const flags = [release.draft ? 'draft' : '', release.prerelease ? 'pre' : '']
		.filter(Boolean)
		.join(', ')
	const date = release.published_at?.slice(0, 10) ?? 'unpublished'
	const name = release.name ? ` - ${release.name}` : ''
	return `${release.tag_name}${name} (${date}${flags ? `, ${flags}` : ''})`
}

function createManifest(release: GitHubRelease): UpdateManifest {
	const notes = release.body ?? ''
	const android = collectAndroidDownloads(release.assets)
	const downloads = Object.keys(android).length > 0 ? { android } : undefined

	return {
		version: normalizeVersion(release.tag_name),
		url: release.html_url,
		downloads,
		notes,
		listed_notes: parseMarkdownListItems(notes),
		forced: false,
	}
}

function collectAndroidDownloads(
	assets: GitHubAsset[],
): Record<string, string> {
	const downloads: Record<string, string> = {}
	for (const asset of assets) {
		if (!asset.name.toLowerCase().endsWith('.apk')) continue
		const abi = inferAndroidAbi(asset.name)
		if (abi) downloads[abi] = asset.browser_download_url
	}
	return downloads
}

function inferAndroidAbi(fileName: string): string | null {
	const normalized = fileName.toLowerCase()
	for (const abi of ANDROID_ABIS) {
		if (normalized.includes(abi)) return abi
	}
	if (normalized.includes('universal')) return 'universal'
	return null
}

function normalizeVersion(tag: string): string {
	return tag.startsWith('v') ? tag.slice(1) : tag
}

function parseMarkdownListItems(markdown: string): string[] | undefined {
	const items = markdown
		.split(/\r?\n/)
		.map((line) => line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+?)\s*$/)?.[1])
		.filter((line): line is string => Boolean(line))
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.map((line, index) => `${index + 1}. ${line}`)

	return items.length > 0 ? items : undefined
}

async function writeTempManifest(manifest: UpdateManifest): Promise<string> {
	const dir = resolve(REPO_ROOT, '.tmp/update-publisher')
	await mkdir(dir, { recursive: true })
	const path = resolve(dir, `update-${manifest.version}.json`)
	await writeFile(path, `${JSON.stringify(manifest, null, '\t')}\n`)
	return path
}

async function getZedCommand(): Promise<string> {
	try {
		await stat('/Applications/Zed.app/Contents/MacOS/cli')
		return '/Applications/Zed.app/Contents/MacOS/cli'
	} catch {
		return 'zed'
	}
}

async function openInZed(path: string): Promise<void> {
	log.info(
		`Opening ${basename(path)} in Zed. Save and close the editor tab/window to continue.`,
	)
	const zedCmd = await getZedCommand()
	await run(zedCmd, ['--wait', path], { cwd: REPO_ROOT })
}

async function readManifest(path: string): Promise<UpdateManifest> {
	const raw = await readFile(path, 'utf8')
	const parsed: unknown = JSON.parse(raw)
	validateManifest(parsed)
	return parsed
}

function validateManifest(value: unknown): asserts value is UpdateManifest {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('Edited update manifest must be a JSON object')
	}
	const manifest = value as Record<string, unknown>
	for (const field of ['version', 'url', 'notes']) {
		if (typeof manifest[field] !== 'string') {
			throw new Error(
				`Edited update manifest field "${field}" must be a string`,
			)
		}
	}
	if (typeof manifest.forced !== 'boolean') {
		throw new Error('Edited update manifest field "forced" must be a boolean')
	}
	if (
		manifest.listed_notes !== undefined &&
		(!Array.isArray(manifest.listed_notes) ||
			!manifest.listed_notes.every((item) => typeof item === 'string'))
	) {
		throw new Error(
			'Edited update manifest field "listed_notes" must be a string array',
		)
	}
}

function printManifestSummary(manifest: UpdateManifest) {
	const androidDownloads = manifest.downloads?.android
		? Object.keys(manifest.downloads.android)
		: []
	note(
		[
			`Version: ${manifest.version}`,
			`URL: ${manifest.url}`,
			`Android downloads: ${androidDownloads.join(', ') || 'none'}`,
			`Listed notes: ${manifest.listed_notes?.length ?? 0}`,
			`Forced: ${manifest.forced}`,
		].join('\n'),
		'Prepared update.json',
	)
}

async function publishToWorkersKv(path: string) {
	await run(
		'pnpm',
		[
			'--dir',
			'apps/backend',
			'exec',
			'wrangler',
			'kv',
			'key',
			'put',
			UPDATE_KEY,
			'--path',
			path,
			'--binding',
			'KV',
			'--remote',
		],
		{ cwd: REPO_ROOT },
	)
}

async function run(
	command: string,
	args: string[],
	options: { cwd: string },
): Promise<void> {
	await new Promise<void>((resolveRun, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			stdio: 'inherit',
			shell: false,
		})
		child.on('error', reject)
		child.on('exit', (code) => {
			if (code === 0) {
				resolveRun()
				return
			}
			reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
		})
	})
}

main().catch((error: unknown) => {
	// oxlint-disable-next-line eslint(no-console)
	console.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
