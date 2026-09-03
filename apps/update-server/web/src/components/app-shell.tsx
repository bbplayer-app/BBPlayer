import {
	Blocks,
	Boxes,
	FileDiff,
	Gauge,
	RadioTower,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from '@/components/ui/sidebar'

export type Section =
	| 'overview'
	| 'channels'
	| 'updates'
	| 'runtimes'
	| 'patches'

const primary = [
	{ id: 'overview' as const, label: 'Overview', href: '/', icon: Gauge },
]
const ota = [
	{
		id: 'channels' as const,
		label: 'Channels',
		href: '/channels/',
		icon: RadioTower,
	},
	{
		id: 'updates' as const,
		label: 'Update groups',
		href: '/updates/',
		icon: Boxes,
	},
	{
		id: 'runtimes' as const,
		label: 'Runtimes',
		href: '/runtimes/',
		icon: Blocks,
	},
	{
		id: 'patches' as const,
		label: 'Patches',
		href: '/patches/',
		icon: FileDiff,
	},
]

export function AppShell({
	active,
	children,
}: {
	active: Section
	children: ReactNode
}) {
	return (
		<SidebarProvider>
			<Sidebar collapsible='offcanvas'>
				<SidebarHeader className='p-4'>
					<a
						className='flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
						href='/'
					>
						<span
							aria-hidden='true'
							className='relative size-9 shrink-0 overflow-hidden rounded-xl'
						>
							<img
								alt=''
								className='absolute inset-0 size-full scale-[2.15] object-contain'
								src='/icon.png'
							/>
						</span>
						<div className='min-w-0'>
							<p className='truncate text-sm font-semibold'>BBPlayer OTA</p>
							<p className='text-xs text-muted-foreground'>Update operations</p>
						</div>
					</a>
				</SidebarHeader>
				<Separator />
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								{primary.map((item) => (
									<NavItem
										active={active === item.id}
										item={item}
										key={item.id}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
					<SidebarGroup>
						<SidebarGroupLabel>Over-the-air updates</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{ota.map((item) => (
									<NavItem
										active={active === item.id}
										item={item}
										key={item.id}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
			<SidebarInset>
				<header className='sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden'>
					<SidebarTrigger aria-label='Open navigation' />
					<Separator
						className='h-4'
						orientation='vertical'
					/>
					<span className='text-sm font-medium'>BBPlayer OTA</span>
				</header>
				<main className='min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9'>
					<div className='mx-auto w-full max-w-7xl'>{children}</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	)
}

function NavItem({
	active,
	item,
}: {
	active: boolean
	item: (typeof primary)[number] | (typeof ota)[number]
}) {
	const Icon = item.icon
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				isActive={active}
				tooltip={item.label}
			>
				<a
					aria-current={active ? 'page' : undefined}
					href={item.href}
				>
					<Icon />
					<span>{item.label}</span>
				</a>
			</SidebarMenuButton>
		</SidebarMenuItem>
	)
}
