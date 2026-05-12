import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  buildWSLGitExecErrorMessage,
  canUseWSLGit,
  isWSLSafeGitSubcommand,
} from '../../../src/lib/git/wsl-git-exec'

describe('wsl-git-exec', () => {
  describe('buildWSLGitExecErrorMessage', () => {
    it('does not append stderr already included in the error message', () => {
      const stderr = 'fatal: not a git repository'
      const error = new Error(`Command failed: wsl.exe -d Ubuntu\n${stderr}`)

      const message = buildWSLGitExecErrorMessage(error, stderr)

      assert.equal(
        message,
        `wsl.exe git failed: Command failed: wsl.exe -d Ubuntu\n${stderr}`
      )
    })

    it('appends stderr missing from the error message', () => {
      const message = buildWSLGitExecErrorMessage(
        new Error('spawn wsl.exe ENOENT'),
        'wsl.exe not found'
      )

      assert.equal(
        message,
        'wsl.exe git failed: spawn wsl.exe ENOENT\nstderr: wsl.exe not found'
      )
    })
  })

  describe('isWSLSafeGitSubcommand', () => {
    it('returns true for status', () => {
      assert.equal(
        isWSLSafeGitSubcommand(['--no-optional-locks', 'status', '--porcelain=2']),
        true
      )
    })

    it('returns true for log', () => {
      assert.equal(isWSLSafeGitSubcommand(['log', '--oneline', '-10']), true)
    })

    it('returns true for diff', () => {
      assert.equal(isWSLSafeGitSubcommand(['diff', '--name-only']), true)
    })

    it('returns true for branch', () => {
      assert.equal(isWSLSafeGitSubcommand(['branch', '-vv']), true)
    })

    it('returns true for rev-list', () => {
      assert.equal(isWSLSafeGitSubcommand(['rev-list', 'HEAD..origin/main']), true)
    })

    it('returns true for checkout (local branch switch)', () => {
      assert.equal(
        isWSLSafeGitSubcommand(['checkout', '--progress', 'main', '--']),
        true
      )
    })

    it('returns true for switch', () => {
      assert.equal(isWSLSafeGitSubcommand(['switch', 'feature-branch']), true)
    })

    it('returns true for reset', () => {
      assert.equal(isWSLSafeGitSubcommand(['reset', '--mixed', 'HEAD']), true)
    })

    it('returns true for submodule', () => {
      assert.equal(
        isWSLSafeGitSubcommand(['submodule', 'update', '--init', '--recursive']),
        true
      )
    })

    it('returns true for push (SSH uses WSL keys)', () => {
      assert.equal(isWSLSafeGitSubcommand(['push', 'origin', 'main']), true)
    })

    it('returns false for commit', () => {
      assert.equal(isWSLSafeGitSubcommand(['commit', '-m', 'test']), false)
    })

    it('returns true for fetch (SSH uses WSL keys)', () => {
      assert.equal(isWSLSafeGitSubcommand(['fetch', 'origin']), true)
    })

    it('returns true for pull (SSH uses WSL keys)', () => {
      assert.equal(isWSLSafeGitSubcommand(['pull']), true)
    })

    it('returns false for clone', () => {
      assert.equal(isWSLSafeGitSubcommand(['clone', 'url']), false)
    })

    it('returns false for empty args', () => {
      assert.equal(isWSLSafeGitSubcommand([]), false)
    })

    it('returns false for flags only', () => {
      assert.equal(isWSLSafeGitSubcommand(['--no-optional-locks']), false)
    })

    it('skips -c key=value pairs to find subcommand', () => {
      assert.equal(
        isWSLSafeGitSubcommand(
          ['--no-optional-locks', '-c', 'core.fsmonitor=', 'status']
        ),
        true
      )
    })

    it('skips -C path pairs to find subcommand', () => {
      assert.equal(
        isWSLSafeGitSubcommand(['-C', '/some/path', 'log', '--oneline']),
        true
      )
    })
  })

  describe('canUseWSLGit', () => {
    const wslPath = '\\\\wsl$\\Ubuntu\\home\\user\\repo'
    const windowsPath = 'C:\\Users\\user\\repo'

    it('returns false for non-WSL paths regardless of platform', () => {
      assert.equal(
        canUseWSLGit(['status', '--porcelain=2'], windowsPath),
        false
      )
    })

    it('returns false on non-Windows platforms', () => {
      if (__WIN32__) {
        return
      }
      assert.equal(canUseWSLGit(['status'], wslPath), false)
    })

    it('returns false for empty args', () => {
      assert.equal(canUseWSLGit([], wslPath), false)
    })

    it('returns false for clone on WSL paths', () => {
      assert.equal(canUseWSLGit(['clone', 'url'], wslPath), false)
    })
  })
})
