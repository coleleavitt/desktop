import * as Path from 'path'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { applyCopilotResolutionsToWorkingDirectory } from '../../src/lib/copilot-conflict-resolution-apply'

describe('applyCopilotResolutionsToWorkingDirectory', () => {
  let tmpDir: string

  before(async () => {
    tmpDir = await mkdtemp(Path.join(tmpdir(), 'copilot-apply-'))
    // Create a basic directory structure
    await mkdir(Path.join(tmpDir, 'src'), { recursive: true })
    await writeFile(Path.join(tmpDir, 'src', 'file1.ts'), 'original content')
    await writeFile(Path.join(tmpDir, 'src', 'file2.ts'), 'original content 2')
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('writes resolved content to files', async () => {
    const resolutions = new Map<string, string>()
    resolutions.set('src/file1.ts', 'resolved content for file1')

    const result = await applyCopilotResolutionsToWorkingDirectory(
      tmpDir,
      resolutions
    )

    assert.strictEqual(result.appliedFiles.length, 1)
    assert.strictEqual(result.failedFiles.length, 0)
    assert.strictEqual(result.appliedFiles[0], 'src/file1.ts')

    const written = await readFile(Path.join(tmpDir, 'src', 'file1.ts'), 'utf8')
    assert.strictEqual(written, 'resolved content for file1')
  })

  it('writes multiple files', async () => {
    const resolutions = new Map<string, string>()
    resolutions.set('src/file1.ts', 'content1')
    resolutions.set('src/file2.ts', 'content2')

    const result = await applyCopilotResolutionsToWorkingDirectory(
      tmpDir,
      resolutions
    )

    assert.strictEqual(result.appliedFiles.length, 2)
    assert.strictEqual(result.failedFiles.length, 0)
  })

  it('rejects paths that escape the repository root', async () => {
    const resolutions = new Map<string, string>()
    resolutions.set('../outside-repo.txt', 'malicious content')

    const result = await applyCopilotResolutionsToWorkingDirectory(
      tmpDir,
      resolutions
    )

    assert.strictEqual(result.appliedFiles.length, 0)
    assert.strictEqual(result.failedFiles.length, 1)
    assert.strictEqual(result.failedFiles[0].path, '../outside-repo.txt')
    assert.ok(result.failedFiles[0].error.length > 0)
  })

  it('handles mixed successes and failures', async () => {
    const resolutions = new Map<string, string>()
    resolutions.set('src/file1.ts', 'good content')
    resolutions.set('../../escape.txt', 'bad content')

    const result = await applyCopilotResolutionsToWorkingDirectory(
      tmpDir,
      resolutions
    )

    assert.strictEqual(result.appliedFiles.length, 1)
    assert.strictEqual(result.appliedFiles[0], 'src/file1.ts')
    assert.strictEqual(result.failedFiles.length, 1)
    assert.strictEqual(result.failedFiles[0].path, '../../escape.txt')
  })

  it('returns empty results for empty resolutions', async () => {
    const resolutions = new Map<string, string>()

    const result = await applyCopilotResolutionsToWorkingDirectory(
      tmpDir,
      resolutions
    )

    assert.strictEqual(result.appliedFiles.length, 0)
    assert.strictEqual(result.failedFiles.length, 0)
  })
})
