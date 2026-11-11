// Verify the actual package outside this checkout, without inherited development deps.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'interpolate-consumer-'))
const env = Object.fromEntries(
    Object.entries(process.env).filter(
        ([key]) =>
            !/^(npm_config_|npm_token$|node_auth_token$|gh_token$|github_token$|gh_packages_token$|gh_record_token$)/i.test(
                key,
            ),
    ),
)
env.NPM_CONFIG_USERCONFIG = join(directory, 'user.npmrc')
env.NPM_CONFIG_GLOBALCONFIG = join(directory, 'global.npmrc')
env.NPM_CONFIG_CACHE = join(directory, 'cache')
writeFileSync(
    env.NPM_CONFIG_USERCONFIG,
    'registry=https://registry.npmjs.org/\n@todoist:registry=https://registry.npmjs.org/\n',
)
writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, '')
const run = (command, args, cwd = process.cwd()) =>
    execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
try {
    const [packed] = JSON.parse(
        run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory]),
    )
    assert.equal(packed.name, '@todoist/react-interpolate')
    for (const version of ['17.0.2', '18.2.0', '19.2.0']) {
        const cwd = join(directory, version)
        mkdirSync(cwd)
        writeFileSync(
            join(cwd, 'package.json'),
            JSON.stringify({
                name: 'react-interpolate-package-check',
                private: true,
                version: '1.0.0',
                dependencies: {
                    '@todoist/react-interpolate': `file:${join(directory, packed.filename)}`,
                    react: version,
                    'react-dom': version,
                    'prop-types': '15.8.1',
                },
            }),
        )
        run(
            'npm',
            ['install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund'],
            cwd,
        )
        writeFileSync(
            join(cwd, 'check.mjs'),
            `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import React from 'react'
const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server')
const root = dirname(require.resolve('@todoist/react-interpolate/package.json'))
const names = ['default', 'SYNTAX_I18NEXT', 'SYNTAX_BUILT_IN', 'TOKEN_PLACEHOLDER', 'TOKEN_OPEN_TAG', 'TOKEN_CLOSE_TAG', 'TOKEN_SELF_TAG'].sort()
for (const suffix of ['cjs', 'mjs', 'min.cjs', 'min.mjs']) {
    const path = join(root, 'dist/react-interpolate.' + suffix)
    const api = suffix.endsWith('cjs') ? require(path) : await import(pathToFileURL(path))
    assert.deepEqual(Object.keys(api).sort(), names)
    assert.equal(renderToStaticMarkup(React.createElement(api.default, {
        string: 'Hello <b>{name}</b>', mapping: { name: 'world', b: React.createElement('em') }, graceful: false,
    })), 'Hello <em>world</em>')
}
`,
        )
        run('node', ['check.mjs'], cwd)
        console.log(`Packed CJS/ESM/minified exports and rendering pass with React ${version}`)
    }
} finally {
    rmSync(directory, { recursive: true, force: true })
}
