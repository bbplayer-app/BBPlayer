import { Badge } from '@/components/ui/badge'

export function StatusBadge({ value }: { value: string }) {
	return (
		<Badge variant={value === 'ota' ? 'default' : 'secondary'}>
			{value === 'ota' ? 'OTA active' : value}
		</Badge>
	)
}
