#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	password,
	select,
	spinner,
	text,
} from '@clack/prompts'
import { createFingerprintAsync } from '@expo/fingerprint'
import archiver from 'archiver'

type Args = Record<string, string | boolean>
const bools = new Set([
	'json',
	'non-interactive',
	'allow-dirty',
	'no-fingerprint',
	'embedded',
])
function args(raw: string[]): Args {
	const out: Args = {}
	for (let i = 0; i < raw.length; i++) {
		const a = raw[i]
		if (a === '--' || !a.startsWith('--')) continue
		const k = a.slice(2)
		if (bools.has(k)) out[k] = true
		else {
			const v = raw[++i]
			if (!v || v.startsWith('--')) throw Error(`Missing --${k}`)
			out[k] = v
		}
	}
	return out
}
async function run(command: string, argv: string[], cwd: string) {
	return await new Promise<string>((ok, fail) => {
		const c = spawn(command, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
		let s = ''
		c.stdout.on('data', (x) => (s += x))
		c.stderr.on('data', (x) => (s += x))
		c.on('error', fail)
		c.on('close', (code) =>
			code === 0 ? ok(s) : fail(Error(`${command} failed\n${s}`)),
		)
	})
}
async function git(cwd: string, argv: string[]) {
	return (await run('git', argv, cwd)).trim()
}
function pm(): [string, string[]] {
	return process.env.npm_execpath
		? [process.execPath, [process.env.npm_execpath]]
		: ['pnpm', []]
}
async function expo(cwd: string, argv: string[]) {
	const [c, pre] = pm()
	return await run(c, [...pre, 'exec', 'expo', ...argv], cwd)
}
async function value(
	message: string,
	initial = '',
	secret = false,
): Promise<string> {
	const v = secret
		? await password({ message })
		: await text({
				message,
				initialValue: initial,
				validate: (x) => ((x ?? '').trim() ? undefined : 'Required'),
			})
	if (isCancel(v) || !v.trim()) throw Error('Cancelled')
	return v.trim()
}
async function credentials(a: Args) {
	let server = String(a.server ?? process.env.BBPLAYER_UPDATE_SERVER_URL ?? '')
	let token = String(a.token ?? process.env.BBPLAYER_UPDATE_SERVER_TOKEN ?? '')
	if (!a['non-interactive']) {
		server ||= await value('Update server URL')
		token ||= await value('Admin token', '', true)
	}
	if (!server || !token) throw Error('--server and --token are required')
	return { server: server.replace(/\/$/, ''), token }
}
async function api(a: Args, method: string, path: string, body?: unknown) {
	const c = await credentials(a)
	const r = await fetch(c.server + path, {
		method,
		headers: {
			Authorization: `Bearer ${c.token}`,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	})
	const t = await r.text()
	if (!r.ok) throw Error(`${r.status}: ${t}`)
	return t ? JSON.parse(t) : null
}
function output(a: Args, result: unknown) {
	if (a.json) process.stdout.write(`${JSON.stringify(result)}\n`)
	else console.table(Array.isArray(result) ? result : [result])
}
async function zip(dir: string, target: string) {
	await new Promise<void>((ok, fail) => {
		const out = createWriteStream(target)
		const z = archiver('zip', { zlib: { level: 9 } })
		out.on('close', ok)
		out.on('error', fail)
		z.on('error', fail)
		z.pipe(out)
		z.directory(dir, false)
		void z.finalize()
	})
}

async function publish(a: Args) {
	const project = resolve(String(a['project-dir'] ?? process.cwd()))
	const non = a['non-interactive'] === true
	let channel = String(a.channel ?? 'production')
	let message = String(a.message ?? '')
	if (!non) {
		channel = await value('Channel', channel)
		message ||= await git(project, ['log', '-1', '--format=%s'])
		message = await value('Release message', message)
	}
	if (!message) throw Error('--message is required')
	const commit = await git(project, ['rev-parse', 'HEAD'])
	const dirty = Boolean(await git(project, ['status', '--porcelain']))
	if (dirty && non && !a['allow-dirty'])
		throw Error('Dirty worktree; use --allow-dirty explicitly')
	if (dirty && !non) {
		log.warn('This dirty state will be recorded.')
		const yes = await confirm({ message: 'Continue?', initialValue: false })
		if (isCancel(yes) || !yes) throw Error('Cancelled')
	}
	let runtime = String(a['runtime-version'] ?? '')
	let fingerprint: { hash: string; sources: unknown[] } | undefined
	if (!a['no-fingerprint']) {
		const s = spinner()
		s.start('Generating Android fingerprint')
		fingerprint = await createFingerprintAsync(project, {
			platforms: ['android'],
			silent: true,
		})
		runtime ||= fingerprint.hash
		if (runtime !== fingerprint.hash)
			throw Error(
				'fingerprint hash must equal runtimeVersion when fingerprint is uploaded',
			)
		s.stop(`Fingerprint: ${runtime}`)
	}
	if (!runtime)
		throw Error('--runtime-version is required with --no-fingerprint')
	if (!non) {
		note(
			`channel: ${channel}\nruntimeVersion: ${runtime}\ncommit: ${commit}\nworking tree: ${dirty ? 'dirty' : 'clean'}\nfingerprint: ${fingerprint ? `${fingerprint.sources.length} sources` : 'not uploaded'}`,
			'Publish summary',
		)
		const yes = await confirm({
			message: 'Export and publish?',
			initialValue: true,
		})
		if (isCancel(yes) || !yes) throw Error('Cancelled')
	}
	const dist = resolve(project, String(a.dist ?? 'dist'))
	const s = spinner()
	s.start('Exporting')
	await expo(project, [
		'export',
		'--clear',
		'--platform',
		'android',
		'--output-dir',
		dist,
	])
	await writeFile(
		join(dist, 'expoConfig.json'),
		await expo(project, ['config', '--type', 'public', '--json']),
	)
	s.stop('Exported')
	const temp = await mkdtemp(join(tmpdir(), 'bbplayer-hot-update-'))
	try {
		const archive = join(temp, 'update.zip')
		await zip(dist, archive)
		const c = await credentials(a)
		const form = new FormData()
		form.set(
			'request',
			JSON.stringify({
				channel,
				runtime_version: runtime,
				message,
				source: { commit_sha: commit, working_tree_clean: !dirty },
				...(fingerprint ? { fingerprint } : {}),
			}),
		)
		form.set(
			'archive',
			new Blob([await readFile(archive)], { type: 'application/zip' }),
			basename(archive),
		)
		const r = await fetch(`${c.server}/admin/publish`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${c.token}` },
			body: form,
		})
		const t = await r.text()
		if (!r.ok) throw Error(`${r.status}: ${t}`)
		output(a, JSON.parse(t))
	} finally {
		await rm(temp, { recursive: true, force: true })
	}
}

async function command(name: string, a: Args) {
	if (name === 'publish') return await publish(a)
	if (name === 'list')
		return output(
			a,
			await api(
				a,
				'GET',
				`/admin/updates?limit=${encodeURIComponent(String(a.limit ?? 10))}&offset=${encodeURIComponent(String(a.offset ?? 0))}`,
			),
		)
	if (name === 'show')
		return output(
			a,
			await api(
				a,
				'GET',
				`/admin/updates/${a.group ?? (await value('Group ID'))}`,
			),
		)
	if (name === 'channel') {
		const action = String(
			a.action ??
				(!a['non-interactive']
					? await select({
							message: 'Channel action',
							options: [
								{ value: 'list', label: 'List' },
								{ value: 'show', label: 'Show' },
								{ value: 'history', label: 'History' },
							],
						})
					: 'list'),
		)
		const ch =
			action === 'list' ? '' : String(a.channel ?? (await value('Channel')))
		return output(
			a,
			await api(
				a,
				'GET',
				action === 'list'
					? '/admin/channels'
					: `/admin/channels/${encodeURIComponent(ch)}${action === 'history' ? '/history' : ''}`,
			),
		)
	}
	if (name === 'rollback') {
		const ch = String(a.channel ?? (await value('Channel')))
		const runtime = String(
			a['runtime-version'] ?? (await value('Runtime version')),
		)
		const embedded = a.embedded === true
		const group = embedded
			? ''
			: String(a.to ?? (await value('Target group ID')))
		return output(
			a,
			await api(
				a,
				'POST',
				`/admin/channels/${encodeURIComponent(ch)}/rollback`,
				{
					runtime_version: runtime,
					platform: a.platform ?? 'android',
					mode: embedded ? 'embedded' : 'ota',
					group_id: group,
				},
			),
		)
	}
	if (name === 'source') {
		const action = String(
			a.action ??
				(await select({
					message: 'Source action',
					options: [
						{ value: 'find', label: 'Find commit' },
						{ value: 'compare', label: 'Compare groups' },
					],
				})),
		)
		const path =
			action === 'compare'
				? `/admin/source/compare/${a.from ?? (await value('From group'))}/${a.to ?? (await value('To group'))}`
				: `/admin/source/${a.commit ?? (await value('Commit SHA'))}`
		return output(a, await api(a, 'GET', path))
	}
	if (name === 'insights') {
		const q = new URLSearchParams()
		for (const k of ['channel', 'runtime_version', 'platform', 'group_id'])
			if (typeof a[k] === 'string') q.set(k, a[k])
		return output(a, await api(a, 'GET', `/admin/insights?${q}`))
	}
	throw Error(`Unknown command: ${name}`)
}
async function main() {
	const raw = process.argv.slice(2)
	while (raw[0] === '--') raw.shift()
	let [name, ...rest] = raw
	if (!name) {
		intro('BBPlayer hot update')
		const x = await select({
			message: 'Action',
			options: [
				'publish',
				'list',
				'show',
				'channel',
				'rollback',
				'source',
				'insights',
			].map((value) => ({ value, label: value })),
		})
		if (isCancel(x)) throw Error('Cancelled')
		name = x
	}
	await command(name, args(rest))
}
void main().catch((e) => {
	const m = e instanceof Error ? e.message : String(e)
	if (m !== 'Cancelled') console.error(m)
	else cancel('Cancelled')
	process.exitCode = 1
})
