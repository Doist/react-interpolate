// Read-only checks of the installed semantic-release algorithm; no semanticRelease()
// call, Git command, network, tag, registry write or commitback occurs here.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(
    join(resolve(process.env.RELEASE_TOOLING_ROOT || '.'), 'package.json'),
)
const root = dirname(require.resolve('semantic-release'))
const { analyzeCommits } = await import(
    pathToFileURL(require.resolve('@semantic-release/commit-analyzer'))
)
const { default: lastRelease } = await import(pathToFileURL(join(root, 'lib/get-last-release.js')))
const { default: nextVersion } = await import(pathToFileURL(join(root, 'lib/get-next-version.js')))
const config = createRequire(import.meta.url)('../../release.config.js')
const logger = { log() {} }
const stable = { version: '2.2.4', gitTag: 'v2.2.4', channels: [null] }
const next = { version: '2.3.0-next.1', gitTag: 'v2.3.0-next.1', channels: ['next'] }
async function calculate(branch, message) {
    const type = await analyzeCommits(config.plugins[0][1], {
        cwd: process.cwd(),
        commits: [{ hash: 'fixture', message }],
        logger,
    })
    if (!type) return null
    const previous = lastRelease({ branch, options: config })
    return nextVersion({
        branch,
        nextRelease: { type, channel: branch.channel },
        lastRelease: previous,
        logger,
    })
}
assert.equal(
    await calculate(
        { name: 'main', type: 'release', tags: [stable], channel: undefined },
        'fix: migrate package identity',
    ),
    '2.2.5',
)
assert.equal(
    await calculate(
        { name: 'next', type: 'prerelease', prerelease: 'next', tags: [stable], channel: 'next' },
        'feat: add interpolation option',
    ),
    '2.3.0-next.1',
)
assert.equal(
    await calculate(
        {
            name: 'next',
            type: 'prerelease',
            prerelease: 'next',
            tags: [stable, next],
            channel: 'next',
        },
        'fix: correct interpolation option',
    ),
    '2.3.0-next.2',
)
assert.equal(
    await calculate(
        { name: 'main', type: 'release', tags: [stable, next], channel: undefined },
        'feat: add interpolation option',
    ),
    '2.3.0',
)
assert.equal(
    await calculate(
        {
            name: 'main',
            type: 'release',
            tags: [{ version: '2.2.5', gitTag: 'v2.2.5', channels: [null] }],
            channel: undefined,
        },
        'fix: subsequent correction',
    ),
    '2.2.6',
)
assert.equal(
    await calculate(
        { name: 'main', type: 'release', tags: [stable], channel: undefined },
        'docs: clarify usage',
    ),
    null,
)
console.log('Six installed semantic-release policy cases passed (read-only mocked history)')
