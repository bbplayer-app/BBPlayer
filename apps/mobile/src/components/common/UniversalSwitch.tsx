import { Host, Switch } from '@expo/ui'
import { memo } from 'react'

import useAppStore from '@/hooks/stores/useAppStore'

type UniversalSwitchProps = {
	value: boolean
	onValueChange: (value: boolean) => void
	disabled?: boolean
	testID?: string
}

const UniversalSwitch = memo(function UniversalSwitch({
	disabled,
	onValueChange,
	testID,
	value,
}: UniversalSwitchProps) {
	const pureWhiteBackground = useAppStore(
		(state) => state.settings.pureWhiteBackground,
	)
	return (
		<Host
			matchContents
			colorScheme={pureWhiteBackground ? 'light' : undefined}
		>
			<Switch
				disabled={disabled}
				onValueChange={onValueChange}
				testID={testID}
				value={value}
			/>
		</Host>
	)
})

export default UniversalSwitch
