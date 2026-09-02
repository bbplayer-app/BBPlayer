import { useQuery } from '@tanstack/react-query'
import {
	Activity,
	Apple,
	Box,
	ChevronLeft,
	ChevronRight,
	Copy,
	Fingerprint,
	GitBranch,
	Layers3,
	Search,
	Server,
	Smartphone,
	X,
} from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
	PieChart,
	Pie,
	Cell,
} from 'recharts'

import * as api from './api'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { date, number, shortID } from './lib/utils'
type R = {
	p:
		| 'overview'
		| 'channels'
		| 'channel'
		| 'runtimes'
		| 'updates'
		| 'runtime'
		| 'update'
		| 'assets'
	c?: string
	r?: string
	g?: string
	platform?: 'android' | 'ios'
}
const colors = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#eab308']
const bytes = (n: number) =>
	n > 1048576
		? `${(n / 1048576).toFixed(2)} MiB`
		: `${(n / 1024).toFixed(1)} KiB`
function Error({ e }: { e: Error }) {
	return (
		<div className='rounded-2xl border border-amber-200 bg-amber-50 p-5'>
			{e.message}
		</div>
	)
}
function Title({ children }: { children: React.ReactNode }) {
	return (
		<h1 className='mb-8 text-4xl font-semibold tracking-tight'>{children}</h1>
	)
}
function Nav({ r, go }: { r: R; go: (x: R) => void }) {
	const b = (p: R['p'], t: string, I: typeof Box) => (
		<button
			onClick={() => go({ p })}
			className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${r.p === p ? 'bg-zinc-200 font-semibold' : 'hover:bg-zinc-100'}`}
		>
			<I className='size-4' />
			{t}
		</button>
	)
	return (
		<aside className='fixed inset-y-0 hidden w-72 border-r bg-zinc-50 p-5 lg:block'>
			<div className='mb-9 px-2 text-2xl font-bold tracking-tight'>
				BBPlayer OTA
			</div>
			{b('overview', 'Overview', Box)}
			<p className='mb-2 mt-7 text-xs font-semibold text-zinc-400'>
				OVER-THE-AIR UPDATES
			</p>
			{b('channels', 'Channels', GitBranch)}
			{b('updates', 'Update groups', Layers3)}
			{b('runtimes', 'Runtimes', Server)}
		</aside>
	)
}
function Overview() {
	const s = useQuery({ queryKey: ['service'], queryFn: api.service }),
		i = useQuery({ queryKey: ['insights'], queryFn: api.insights })
	if (s.isError) return <Error e={s.error} />
	const data = s.data?.series ?? [],
		req = data.reduce((a, x) => a + x.requests, 0),
		err = data.reduce((a, x) => a + x.errors, 0)
	return (
		<>
			<Title>Project overview</Title>
			<div className='grid gap-4 md:grid-cols-4'>
				{[
					['Server requests', number(req)],
					['Error rate', req ? `${((err / req) * 100).toFixed(2)}%` : '—'],
					['Unique users', number(i.data?.summary.unique_users ?? 0)],
					['Downloads', number(i.data?.summary.downloads ?? 0)],
				].map(([a, b]) => (
					<Card
						key={a}
						className='p-5'
					>
						<p className='text-sm text-zinc-500'>{a}</p>
						<p className='mt-5 text-3xl font-semibold'>{b}</p>
						<p className='mt-1 text-sm text-zinc-500'>Last 7 days</p>
					</Card>
				))}
			</div>
			<Card className='mt-6 p-6'>
				<h2 className='font-semibold'>Server requests and errors</h2>
				<div className='mt-4 h-80'>
					<ResponsiveContainer>
						<AreaChart data={data}>
							<CartesianGrid vertical={false} />
							<XAxis dataKey='minute' />
							<YAxis />
							<Tooltip />
							<Legend />
							<Area
								dataKey='requests'
								stroke='#2563eb'
								fill='#bfdbfe'
							/>
							<Area
								dataKey='errors'
								stroke='#ef4444'
								fill='transparent'
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</Card>
		</>
	)
}
function Channels({ go }: { go: (x: R) => void }) {
	const q = useQuery({ queryKey: ['channels'], queryFn: api.channels })
	if (q.isError) return <Error e={q.error} />
	return (
		<>
			<Title>Update channels</Title>
			<Card>
				<table className='w-full text-left'>
					<thead>
						<tr>
							<th>Channel</th>
							<th>Status</th>
							<th>Runtimes</th>
							<th>Updated</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{q.data?.map((x) => (
							<tr
								key={x.channel}
								onClick={() => go({ p: 'channel', c: x.channel })}
								className='cursor-pointer border-t hover:bg-zinc-50'
							>
								<td className='font-semibold'>{x.channel}</td>
								<td>
									<Badge>Active</Badge>
								</td>
								<td>{x.runtime_count}</td>
								<td>{date(x.updated_at)}</td>
								<td>
									<ChevronRight className='size-4' />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>
		</>
	)
}
function Channel({ c, r, go }: { c: string; r?: string; go: (x: R) => void }) {
	const q = useQuery({
			queryKey: ['channel', c],
			queryFn: () => api.channel(c),
		}),
		us = useQuery({ queryKey: ['groups'], queryFn: api.groups })
	const rt =
		q.data?.runtimes.find((x) => x.runtime_version === r) ?? q.data?.runtimes[0]
	const a = useQuery({
		queryKey: ['act', c, rt?.runtime_version],
		queryFn: () => api.activity(c, rt!.runtime_version),
		enabled: !!rt,
	})
	if (q.isError) return <Error e={q.error} />
	const names = new Map(
		(us.data ?? []).map((x) => [x.id, x.message || shortID(x.id)]),
	)
	const chart = new Map<string, Record<string, string | number>>()
	for (const x of a.data?.series ?? []) {
		const v = chart.get(x.day) ?? { day: x.day, Embedded: 0 }
		v[
			x.group_id ? (names.get(x.group_id) ?? shortID(x.group_id)) : 'Embedded'
		] = x.active_installations
		chart.set(x.day, v)
	}
	const keys = [
		...new Set(
			(a.data?.series ?? []).map((x) =>
				x.group_id
					? (names.get(x.group_id) ?? shortID(x.group_id))
					: 'Embedded',
			),
		),
	]
	return (
		<>
			<div className='mb-6 text-sm text-zinc-500'>
				Update channels <ChevronRight className='inline size-4' /> {c}
			</div>
			<Card>
				<div className='flex items-center justify-between border-b p-6'>
					<h1 className='text-2xl font-semibold'>Channel: {c}</h1>
					<select
						value={rt?.runtime_version}
						onChange={(e) => go({ p: 'channel', c, r: e.target.value })}
						className='rounded-full border px-4 py-2'
					>
						{q.data?.runtimes.map((x) => (
							<option key={x.runtime_version}>{x.runtime_version}</option>
						))}
					</select>
				</div>
				<div className='grid grid-cols-3 bg-zinc-50 p-5 text-sm'>
					<span>
						Status
						<br />
						<Badge className='mt-2'>Active</Badge>
					</span>
					<span>
						ID
						<br />
						<b>{rt?.head_group_id && shortID(rt.head_group_id)}</b>
					</span>
					<span>
						Created at
						<br />
						<b>{rt && date(rt.updated_at)}</b>
					</span>
				</div>
			</Card>
			<Card className='mt-6 p-6'>
				<h2 className='font-semibold'>Active users</h2>
				<p className='text-sm text-zinc-500'>
					Embedded and every update bundle have separate lines.
				</p>
				<div className='mt-4 h-80'>
					<ResponsiveContainer>
						<AreaChart data={[...chart.values()]}>
							<CartesianGrid vertical={false} />
							<XAxis dataKey='day' />
							<YAxis />
							<Tooltip />
							<Legend />
							{keys.map((k, i) => (
								<Area
									key={k}
									dataKey={k}
									stroke={colors[i % colors.length]}
									fill='transparent'
								/>
							))}
						</AreaChart>
					</ResponsiveContainer>
				</div>
			</Card>
			<h2 className='mb-4 mt-8 text-xl font-semibold'>Runtimes</h2>
			<Card>
				<table className='w-full text-left'>
					<thead>
						<tr>
							<th>Runtime</th>
							<th>Platforms</th>
							<th>Mode</th>
							<th>Updated</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{q.data?.runtimes.map((x) => (
							<tr
								key={x.runtime_version}
								onClick={() => go({ p: 'runtime', c, r: x.runtime_version })}
								className='cursor-pointer border-t hover:bg-zinc-50'
							>
								<td className='font-semibold'>{x.runtime_version}</td>
								<td>{x.platforms.join(', ')}</td>
								<td>{x.mode}</td>
								<td>{date(x.updated_at)}</td>
								<td>
									<ChevronRight className='size-4' />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>
		</>
	)
}
function Groups({ rows, go }: { rows: api.Group[]; go: (x: R) => void }) {
	const [search, setSearch] = useState('')
	return (
		<>
			<div className='mb-5 flex max-w-md items-center gap-2 rounded-full border px-4 py-3'>
				<Search className='size-4' />
				<input
					className='w-full outline-none'
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder='Search by message or channel'
				/>
			</div>
			<Card>
				<table className='w-full text-left'>
					<thead>
						<tr>
							<th>Update</th>
							<th>Channel</th>
							<th>Runtime</th>
							<th>ID</th>
						</tr>
					</thead>
					<tbody>
						{rows
							.filter((x) =>
								(x.message + x.channel)
									.toLowerCase()
									.includes(search.toLowerCase()),
							)
							.map((x) => (
								<tr
									key={x.id}
									onClick={() => go({ p: 'update', g: x.id })}
									className='cursor-pointer border-t hover:bg-zinc-50'
								>
									<td>
										<b>{x.message}</b>
										<br />
										<small className='text-zinc-500'>
											{date(x.created_at)}
										</small>
									</td>
									<td>{x.channel}</td>
									<td>{x.runtime_version}</td>
									<td className='font-mono'>{shortID(x.id)}</td>
								</tr>
							))}
					</tbody>
				</table>
			</Card>
		</>
	)
}
function Updates({ go }: { go: (x: R) => void }) {
	const q = useQuery({ queryKey: ['groups'], queryFn: api.groups })
	return q.isError ? (
		<Error e={q.error} />
	) : (
		<>
			<Title>Update groups</Title>
			<Groups
				rows={q.data ?? []}
				go={go}
			/>
		</>
	)
}
function Runtimes({ go }: { go: (x: R) => void }) {
	const q = useQuery({ queryKey: ['groups'], queryFn: api.groups })
	if (q.isError) return <Error e={q.error} />
	const m = new Map<string, api.Group[]>()
	for (const x of q.data ?? [])
		m.set(`${x.channel}:${x.runtime_version}`, [
			...(m.get(`${x.channel}:${x.runtime_version}`) ?? []),
			x,
		])
	return (
		<>
			<Title>Runtimes</Title>
			<Card>
				<table className='w-full text-left'>
					<thead>
						<tr>
							<th>Runtime</th>
							<th>Channel</th>
							<th>Updates</th>
							<th />
						</tr>
					</thead>
					<tbody>
						{[...m.values()].map((x) => (
							<tr
								key={x[0].id}
								onClick={() =>
									go({ p: 'runtime', c: x[0].channel, r: x[0].runtime_version })
								}
								className='cursor-pointer border-t hover:bg-zinc-50'
							>
								<td className='font-semibold'>{x[0].runtime_version}</td>
								<td>{x[0].channel}</td>
								<td>{x.length}</td>
								<td>
									<ChevronRight className='size-4' />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>
		</>
	)
}
function Runtime({ c, r, go }: { c: string; r: string; go: (x: R) => void }) {
	const q = useQuery({ queryKey: ['groups'], queryFn: api.groups })
	return q.isError ? (
		<Error e={q.error} />
	) : (
		<>
			<div className='mb-6 text-sm text-zinc-500'>
				Channels / {c} / {r}
			</div>
			<Title>Runtime: {r}</Title>
			<Groups
				rows={(q.data ?? []).filter(
					(x) => x.channel === c && x.runtime_version === r,
				)}
				go={go}
			/>
		</>
	)
}
function Detail({
	g,
	p,
	platform,
	go,
}: {
	g: string
	p: R['p']
	platform?: 'android' | 'ios'
	go: (x: R) => void
}) {
	const q = useQuery({ queryKey: ['detail', g], queryFn: () => api.detail(g) }),
		l = useQuery({ queryKey: ['life', g], queryFn: () => api.lifecycle(g) })
	const [fp, setFp] = useState(false)
	if (q.isError) return <Error e={q.error} />
	if (!q.data) return <p>Loading…</p>
	const d = q.data
	return (
		<div className='flex gap-8'>
			<aside className='hidden w-48 shrink-0 lg:block'>
				<button
					onClick={() => go({ p: 'updates' })}
					className='mb-6 text-sm text-zinc-500'
				>
					<ChevronLeft className='inline size-4' /> Update groups
				</button>
				<p className='mb-2 text-xs text-zinc-400'>UPDATE GROUP DETAILS</p>
				<button
					onClick={() => go({ p: 'update', g })}
					className={`block w-full rounded-xl p-3 text-left ${p === 'update' ? 'bg-zinc-200' : ''}`}
				>
					<Layers3 className='mr-2 inline size-4' />
					Overview
				</button>
				{d.platforms.map((x) => (
					<button
						key={x.platform}
						onClick={() => go({ p: 'assets', g, platform: x.platform })}
						className={`mt-1 block w-full rounded-xl p-3 text-left ${p === 'assets' ? 'bg-zinc-200' : ''}`}
					>
						{x.platform === 'android' ? (
							<Smartphone className='mr-2 inline size-4' />
						) : (
							<Apple className='mr-2 inline size-4' />
						)}
						{x.platform}
					</button>
				))}
			</aside>
			<div className='min-w-0 flex-1'>
				<Card>
					<div className='flex justify-between border-b p-6'>
						<div>
							<h1 className='text-2xl font-semibold'>Update group</h1>
							<p className='text-zinc-500'>{d.message}</p>
						</div>
						<Button
							variant='secondary'
							onClick={() => setFp(true)}
						>
							<Fingerprint className='size-4' />
							Fingerprint
						</Button>
					</div>
					<div className='grid grid-cols-4 gap-4 bg-zinc-50 p-5 text-sm'>
						<span>
							Group ID
							<br />
							<b>{shortID(d.id)}</b>
						</span>
						<span>
							Channel
							<br />
							<b>{d.channel}</b>
						</span>
						<span>
							Runtime
							<br />
							<b>{d.runtime_version}</b>
						</span>
						<span>
							Created at
							<br />
							<b>{date(d.created_at)}</b>
						</span>
					</div>
				</Card>
				{p === 'assets' && platform ? (
					<Assets
						g={g}
						platform={platform}
					/>
				) : (
					<>
						<Card className='mt-6'>
							<h2 className='border-b p-6 text-xl font-semibold'>
								Platform-specific updates
							</h2>
							<table className='w-full text-left'>
								<thead>
									<tr>
										<th>Platform</th>
										<th>ID</th>
										<th>Downloads</th>
										<th>Average size</th>
										<th>Known launches</th>
										<th>Known crashes</th>
									</tr>
								</thead>
								<tbody>
									{d.platforms.map((x) => (
										<tr
											key={x.platform}
											onClick={() =>
												go({ p: 'assets', g, platform: x.platform })
											}
											className='cursor-pointer border-t hover:bg-zinc-50'
										>
											<td className='font-semibold'>{x.platform}</td>
											<td className='font-mono'>{shortID(x.id)}</td>
											<td>{number(x.downloads)}</td>
											<td>{bytes(x.launch_size)}</td>
											<td>{number(x.known_launches)}</td>
											<td>{number(x.known_crashes)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</Card>
						<Card className='mt-6 p-6'>
							<h2 className='font-semibold'>Launches and crashes</h2>
							<div className='mt-4 h-72'>
								<ResponsiveContainer>
									<BarChart data={l.data?.series ?? []}>
										<CartesianGrid vertical={false} />
										<XAxis dataKey='day' />
										<YAxis />
										<Tooltip />
										<Legend />
										<Bar
											dataKey='known_launches'
											fill='#38bdf8'
										/>
										<Bar
											dataKey='known_crashes'
											fill='#f87171'
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</Card>
					</>
				)}
				{fp && (
					<div className='fixed inset-0 z-50 bg-black/40 p-6'>
						<div className='mx-auto h-full max-w-5xl rounded-3xl bg-white p-8'>
							<Button
								size='icon'
								variant='secondary'
								className='float-right'
								onClick={() => setFp(false)}
							>
								<X />
							</Button>
							<h1 className='text-3xl font-semibold'>Fingerprint</h1>
							<p className='font-mono text-zinc-500'>{d.fingerprint_hash}</p>
							<pre className='mt-8 h-[75%] overflow-auto rounded-2xl bg-zinc-950 p-6 text-sm text-violet-200'>
								{JSON.stringify(d.fingerprint_sources, null, 2)}
							</pre>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
function Assets({ g, platform }: { g: string; platform: 'android' | 'ios' }) {
	const q = useQuery({
		queryKey: ['assets', g, platform],
		queryFn: () => api.assets(g, platform),
	})
	if (q.isError) return <Error e={q.error} />
	const a = q.data ?? [],
		total = a.reduce((s, x) => s + x.size_bytes, 0),
		parts = Object.entries(
			a.reduce<Record<string, number>>((m, x) => {
				const k = x.is_launch
					? 'Bundle'
					: x.content_type.startsWith('image')
						? 'Images'
						: x.content_type.includes('font')
							? 'Fonts'
							: 'Other'
				m[k] = (m[k] ?? 0) + x.size_bytes
				return m
			}, {}),
		).map(([name, value]) => ({ name, value }))
	return (
		<div className='mt-6 grid gap-6 xl:grid-cols-[1.7fr_.7fr]'>
			<div>
				<h2 className='mb-4 text-2xl font-semibold capitalize'>
					{platform} assets
				</h2>
				<Card>
					<table className='w-full text-left'>
						<thead>
							<tr>
								<th>Asset</th>
								<th>Type</th>
								<th>Size</th>
								<th>Downloads</th>
							</tr>
						</thead>
						<tbody>
							{a.map((x) => (
								<tr
									key={x.id}
									className='border-t'
								>
									<td className='font-medium'>{x.asset_key}</td>
									<td>{x.content_type}</td>
									<td>{bytes(x.size_bytes)}</td>
									<td>{x.downloads}</td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
			</div>
			<Card className='h-fit p-5'>
				<h2 className='text-center font-semibold'>Composition</h2>
				<div className='h-64'>
					<ResponsiveContainer>
						<PieChart>
							<Pie
								data={parts}
								dataKey='value'
								innerRadius={55}
								outerRadius={80}
							>
								{parts.map((_, i) => (
									<Cell
										key={i}
										fill={colors[i]}
									/>
								))}
							</Pie>
							<Tooltip />
						</PieChart>
					</ResponsiveContainer>
				</div>
				{parts.map((x, i) => (
					<p
						key={x.name}
						className='flex justify-between text-sm'
					>
						<span>
							<i
								className='mr-2 inline-block size-2 rounded-full'
								style={{ background: colors[i] }}
							/>
							{x.name}
						</span>
						<b>
							{bytes(x.value)} · {((x.value / total) * 100).toFixed(1)}%
						</b>
					</p>
				))}
			</Card>
		</div>
	)
}
function routeFromPath(pathname: string): R {
	const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
	if (parts[0] === 'channels' && parts[2] === 'runtimes')
		return { p: 'runtime', c: parts[1], r: parts[3] }
	if (parts[0] === 'channels' && parts[1]) return { p: 'channel', c: parts[1] }
	if (parts[0] === 'channels') return { p: 'channels' }
	if (parts[0] === 'runtimes') return { p: 'runtimes' }
	if (
		parts[0] === 'update-groups' &&
		parts[2] &&
		(parts[2] === 'android' || parts[2] === 'ios')
	)
		return { p: 'assets', g: parts[1], platform: parts[2] }
	if (parts[0] === 'update-groups' && parts[1])
		return { p: 'update', g: parts[1] }
	if (parts[0] === 'update-groups') return { p: 'updates' }
	return { p: 'overview' }
}
function pathForRoute(route: R) {
	switch (route.p) {
		case 'channels':
			return '/channels'
		case 'channel':
			return `/channels/${encodeURIComponent(route.c!)}`
		case 'runtime':
			return `/channels/${encodeURIComponent(route.c!)}/runtimes/${encodeURIComponent(route.r!)}`
		case 'runtimes':
			return '/runtimes'
		case 'updates':
			return '/update-groups'
		case 'update':
			return `/update-groups/${route.g}`
		case 'assets':
			return `/update-groups/${route.g}/${route.platform}`
		default:
			return '/'
	}
}
export function App() {
	const location = useLocation()
	const navigate = useNavigate()
	const r = routeFromPath(location.pathname)
	const go = (route: R) => navigate(pathForRoute(route))
	let view: React.ReactNode
	switch (r.p) {
		case 'overview':
			view = <Overview />
			break
		case 'channels':
			view = <Channels go={go} />
			break
		case 'channel':
			view = (
				<Channel
					c={r.c!}
					r={r.r}
					go={go}
				/>
			)
			break
		case 'runtimes':
			view = <Runtimes go={go} />
			break
		case 'updates':
			view = <Updates go={go} />
			break
		case 'runtime':
			view = (
				<Runtime
					c={r.c!}
					r={r.r!}
					go={go}
				/>
			)
			break
		case 'update':
			view = (
				<Detail
					g={r.g!}
					p={r.p}
					go={go}
				/>
			)
			break
		case 'assets':
			view = (
				<Detail
					g={r.g!}
					p={r.p}
					platform={r.platform}
					go={go}
				/>
			)
			break
	}
	return (
		<div className='min-h-screen'>
			<Nav
				r={r}
				go={go}
			/>
			<main className='mx-auto max-w-[1600px] p-6 lg:ml-72 lg:p-10'>
				{view}
			</main>
		</div>
	)
}
