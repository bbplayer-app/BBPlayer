import * as React from 'react'

type SceneProps = {
	route: { key: string } & Record<string, unknown>
	jumpTo: (key: string) => void
}

const SceneComponent = React.memo(
	// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
	<T extends { component: React.ComponentType<SceneProps> } & SceneProps>({
		component,
		...rest
	}: T) => {
		return React.createElement(component, rest)
	},
)

SceneComponent.displayName = 'SceneComponent'

export function SceneMap<T>(scenes: { [key: string]: React.ComponentType<T> }) {
	return ({ route, jumpTo }: SceneProps) => {
		const component = scenes[route.key]
		if (!component) {
			return null
		}
		return (
			<SceneComponent
				key={route.key}
				jumpTo={jumpTo}
				/* @ts-expect-error: generic SceneMap<T> vs fixed SceneProps */
				component={component}
				route={route}
			/>
		)
	}
}
