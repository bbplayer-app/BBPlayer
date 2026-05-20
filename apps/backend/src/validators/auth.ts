import { type as arkType } from 'arktype'

export const loginRequestSchema = arkType({
	username: 'string>=3',
	password: 'string>=8',
})

export const registerRequestSchema = arkType({
	username: 'string>=3',
	password: 'string>=8',
	'name?': 'string',
	'face?': 'string',
})

export const updateProfileRequestSchema = arkType({
	'name?': 'string',
	'face?': 'string',
})
