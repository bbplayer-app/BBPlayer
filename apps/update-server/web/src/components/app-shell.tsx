import {
	BookOpen,
	Gauge,
	LogOut,
	Monitor,
	Moon,
	Package,
	RadioTower,
	Sun,
	Users,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
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
import { reportUnauthorized } from '@/lib/auth'

export type Section = 'overview' | 'releases' | 'channels' | 'audience'

const groups = [
	{
		label: 'Updates',
		items: [
			{ id: 'overview', label: 'Overview', href: '/', icon: Gauge },
			{ id: 'releases', label: 'Releases', href: '/releases/', icon: Package },
			{
				id: 'channels',
				label: 'Channels',
				href: '/channels/',
				icon: RadioTower,
			},
		],
	},
	{
		label: 'Insights',
		items: [
			{ id: 'audience', label: 'Audience', href: '/audience/', icon: Users },
		],
	},
] as const

const themes = [
	{ value: 'light', label: 'Light', icon: Sun },
	{ value: 'dark', label: 'Dark', icon: Moon },
	{ value: 'system', label: 'System', icon: Monitor },
] as const

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
							<p className='text-xs text-muted-foreground'>Update console</p>
						</div>
					</a>
				</SidebarHeader>
				<SidebarContent>
					{groups.map((group) => (
						<SidebarGroup key={group.label}>
							<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{group.items.map((item) => (
										<SidebarMenuItem key={item.id}>
											<SidebarMenuButton
												asChild
												isActive={active === item.id}
												tooltip={item.label}
											>
												<a
													aria-current={active === item.id ? 'page' : undefined}
													href={item.href}
												>
													<item.icon />
													<span>{item.label}</span>
												</a>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
				</SidebarContent>
				<SidebarFooter className='gap-3 p-3'>
					<ThemeSwitch />
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild>
								<a
									href='/admin/docs'
									rel='noreferrer'
									target='_blank'
								>
									<BookOpen />
									<span>API reference</span>
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton onClick={reportUnauthorized}>
								<LogOut />
								<span>Sign out</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
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
				<div className='min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9'>
					<div className='mx-auto w-full max-w-6xl'>{children}</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}

function ThemeSwitch() {
	const { theme = 'system', setTheme } = useTheme()

	return (
		<div
			aria-label='Color theme'
			className='grid grid-cols-3 rounded-lg bg-sidebar-accent/60 p-0.5'
			role='radiogroup'
		>
			{themes.map((item) => (
				<button
					aria-checked={theme === item.value}
					aria-label={item.label}
					className='flex h-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm'
					key={item.value}
					onClick={() => setTheme(item.value)}
					role='radio'
					title={item.label}
					type='button'
				>
					<item.icon className='size-3.5' />
				</button>
			))}
		</div>
	)
}
