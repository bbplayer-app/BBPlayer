import type { ReactNode } from 'react'

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export function PageHeader({
	title,
	description,
	parent,
	action,
}: {
	title: string
	description?: string
	parent?: { label: string; href: string }
	action?: ReactNode
}) {
	return (
		<div className='mb-7 space-y-4'>
			{parent && (
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href={parent.href}>{parent.label}</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			)}
			<div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
				<div className='min-w-0'>
					<h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
						{title}
					</h1>
					{description && (
						<p className='mt-2 max-w-2xl text-sm leading-6 text-muted-foreground'>
							{description}
						</p>
					)}
				</div>
				{action}
			</div>
		</div>
	)
}
