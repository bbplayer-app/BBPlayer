# Vendored anti-slop Oxlint plugin

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), installed from the
`install-anti-slop` skill bundle. The bundle carries no upstream revision; the exact source
commit is **unknown**. The vendored ESLint Stylistic `padding-line-between-statements` copy
records its own immutable revision in `vendor/eslint-stylistic/UPSTREAM.md`.

Installed plugin paths:

- `./index.ts` — generic rules, registered in `oxlint.config.mts` as `anti-slop`
- `./effect/index.ts` — opt-in Effect rules, **not** registered (no direct `effect` dependency)
- `./vendor/eslint-stylistic/` — vendored Stylistic rule, license, and provenance (retained verbatim)

## Local adaptations

- Installed under `oxlint-plugins/` instead of the skill's default `tools/oxlint/anti-slop`.
- `oxlint-plugins/package.json` declares `"type": "module"` so Oxlint loads the TypeScript plugin
  without Node's `MODULE_TYPELESS_PACKAGE_JSON` reparse warning. The vendored tree is otherwise
  unmodified.
- The vendored directory is excluded from linting, as is common project-local agent tooling.
- All generic rules and the native companion `oxc/no-accumulating-spread` are enabled at `error`.
  The Effect rules are deliberately not enabled.

## Dependency

- `@oxlint/plugins` is pinned exactly to the installed `oxlint` major/minor pair (`1.83.0`).
  Upgrade both together.

## Updating

Follow `references/update.md` from the `install-anti-slop` skill: stage the incoming bundle in a
temporary directory, compare against this tree, and merge rather than replace. Keep
`vendor/eslint-stylistic/LICENSE` and its `UPSTREAM.md`. Because no immutable upstream commit was
recorded at install time, treat the next update as a no-base conservative port unless a verified
base snapshot is recovered.

## Verification

`pnpm lint --type-aware` loads the plugin and reports findings; the plugin and checks were verified
by exercising representative violations (for example `require-readable-spacing` and
`oxc/no-accumulating-spread`). `pnpm type-check` passes. Application findings from adopting the
error-level rules are reported separately and have not been auto-fixed.
