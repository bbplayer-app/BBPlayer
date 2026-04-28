const cp = require('child_process')
const fs = require('fs')

const shell = process.platform === 'win32'
const check = cp.spawnSync('gitleaks', ['--version'], {
	stdio: 'ignore',
	shell,
})

if (check.error || check.status) {
	process.stdout.write('gitleaks is not installed, skipping secret scan\n')
	process.exit(0)
}

const args = ['protect', '--staged', '--verbose']
if (fs.existsSync('.gitleaks-baseline.json')) {
	args.push('--baseline-path', '.gitleaks-baseline.json')
}

const result = cp.spawnSync('gitleaks', args, {
	stdio: 'inherit',
	shell,
})

process.exit(result.status ?? 1)
