import { execFile } from 'child_process'
import { stat, unlink } from 'fs/promises'
import * as Path from 'path'
import { isWSLPath, getWSLDistroName, wslUNCToPosixPath } from '../is-wsl-path'
import { enableWSLPerformanceOptimizations } from '../feature-flag'

interface IWSLExecResult {
  readonly stdout: string | Buffer
  readonly stderr: string | Buffer
  readonly exitCode: number
}

interface IWSLExecOptions {
  readonly encoding?: BufferEncoding | 'buffer'
  readonly maxBuffer?: number
  readonly env?: Record<string, string | undefined>
  readonly signal?: AbortSignal
  readonly killSignal?: NodeJS.Signals | number
  readonly stdin?: string | Buffer
  readonly stdinEncoding?: BufferEncoding
  readonly timeout?: number
}

function coerceExecOutput(value: string | Buffer): string {
  return Buffer.isBuffer(value) ? value.toString('utf8') : value
}

export function buildWSLGitExecErrorMessage(
  error: Error,
  stderr: string | Buffer
): string {
  const message = error.message || String(error)
  const stderrText = coerceExecOutput(stderr)
  const stderrSuffix =
    stderrText.length > 0 && !message.includes(stderrText)
      ? `\nstderr: ${stderrText}`
      : ''

  return `wsl.exe git failed: ${message}${stderrSuffix}`
}

// Subcommands that take .git/index.lock. If a previous Windows git crash left
// a stale lock, we try to clear it before re-running these.
const INDEX_WRITING_SUBCOMMANDS = new Set([
  'add',
  'apply',
  'checkout',
  'checkout-index',
  'cherry-pick',
  'clean',
  'commit',
  'commit-tree',
  'merge',
  'mv',
  'pull',
  'rebase',
  'reset',
  'restore',
  'revert',
  'rm',
  'stash',
  'submodule',
  'switch',
  'update-index',
  'update-ref',
])

function needsIndexLock(args: ReadonlyArray<string>): boolean {
  for (const arg of args) {
    if (arg.startsWith('-')) {
      continue
    }
    return INDEX_WRITING_SUBCOMMANDS.has(arg)
  }
  return false
}

// Executes a git command inside WSL using `wsl.exe -d <distro> --cd <path> -e git ...`.
// Bypasses the 9P boundary by running git natively on the Linux filesystem.
// Only safe for read-only operations (status, log, diff, branch, etc.) that
// don't need the trampoline credential helper or hook interception.
export async function wslGitExec(
  args: ReadonlyArray<string>,
  repositoryPath: string,
  options?: IWSLExecOptions
): Promise<IWSLExecResult> {
  const distro = getWSLDistroName(repositoryPath)
  if (!distro) {
    throw new Error(`wslGitExec called with non-WSL path: ${repositoryPath}`)
  }

  const posixPath = wslUNCToPosixPath(repositoryPath)
  if (!posixPath) {
    throw new Error(`Failed to convert WSL path: ${repositoryPath}`)
  }

  if (needsIndexLock(args)) {
    await cleanupStaleIndexLock(repositoryPath)
  }

  const wslArgs = [
    '-d', distro,
    '--cd', posixPath,
    '-e', 'git',
    ...args,
  ]

  const opts = {
    encoding: (options?.encoding ?? 'utf8') as BufferEncoding,
    maxBuffer: options?.maxBuffer ?? Infinity,
    signal: options?.signal,
    killSignal: options?.killSignal,
    // 2 minute timeout prevents infinite hangs when SSH prompts for input
    // in a non-interactive shell (e.g. passphrase, unknown host)
    timeout: options?.timeout ?? 120_000,
    env: {
      ...process.env,
      // Strip Windows-specific trampoline vars — they reference Windows
      // binaries/ports that won't work inside the Linux VM.
      DESKTOP_PORT: undefined,
      DESKTOP_TRAMPOLINE_TOKEN: undefined,
      GIT_ASKPASS: undefined,
      // Keep TERM=dumb to avoid pager issues
      TERM: 'dumb',
    },
  }

  return new Promise<IWSLExecResult>((resolve, reject) => {
    let settled = false

    const fail = (err: Error) => {
      if (settled) {
        return
      }
      settled = true
      reject(err)
    }

    const cp = execFile('wsl.exe', wslArgs, opts, (err, stdout, stderr) => {
      if (settled) {
        return
      }
      settled = true

      if (!err || typeof err.code === 'number') {
        const exitCode = typeof err?.code === 'number' ? err.code : 0
        resolve({ stdout, stderr, exitCode })
        return
      }

      // Distinguish timeout kills from real git errors
      if ('killed' in err && err.killed) {
        reject(
          new Error(
            `wsl.exe git timed out after ${opts.timeout}ms: ${args.join(' ')}`
          )
        )
        return
      }

      reject(new Error(buildWSLGitExecErrorMessage(err, stderr)))
    })

    // Handle spawn failures (e.g. wsl.exe not found, WSL unresponsive)
    cp.on('error', (err: Error) => {
      fail(
        new Error(
          `wsl.exe failed to spawn: ${err.message} (args: ${args.join(' ')})`
        )
      )
    })

    if (options?.stdin !== undefined && cp.stdin) {
      // Guard against EPIPE if wsl.exe dies before stdin is written
      cp.stdin.on('error', () => {})
      try {
        if (options.stdinEncoding) {
          cp.stdin.end(options.stdin, options.stdinEncoding)
        } else {
          cp.stdin.end(options.stdin)
        }
      } catch (err: unknown) {
        fail(
          new Error(
            `Failed to write stdin to wsl.exe: ${
              err instanceof Error ? err.message : String(err)
            }`
          )
        )
      }
    }
  })
}

// Git subcommands safe to route through WSL-native git. These don't need
// the trampoline credential helper or Desktop-intercepted hooks.
// Only commit, push, pull, merge, clone, and credential MUST stay on the
// Windows trampoline path (they use interceptHooks or need credentials).
// fetch: safe because SSH auth uses WSL ~/.ssh/ keys (no trampoline needed),
// and HTTPS auth can use GCM or git credential store configured in WSL.
const WSL_SAFE_SUBCOMMANDS = new Set([
  'status',
  'log',
  'diff',
  'diff-index',
  'diff-tree',
  'branch',
  'for-each-ref',
  'rev-list',
  'rev-parse',
  'show',
  'show-ref',
  'tag',
  'stash',
  'config',
  'remote',
  'merge-base',
  'cat-file',
  'ls-tree',
  'ls-files',
  'name-rev',
  'check-attr',
  'var',
  'symbolic-ref',
  'reflog',
  'checkout',
  'checkout-index',
  'restore',
  'switch',
  'reset',
  'revert',
  'clean',
  'mv',
  'submodule',
  'add',
  'update-index',
  'apply',
  'rm',
  'commit-tree',
  'update-ref',
  'cherry-pick',
  'rebase',
  'init',
  'hash-object',
  'write-tree',
  'read-tree',
  'fetch',
  'ls-remote',
  'push',
  'pull',
])

export function isWSLSafeGitSubcommand(
  args: ReadonlyArray<string>
): boolean {
  // Find the actual git subcommand (skip flags like --no-optional-locks
  // and -c key=value pairs)
  let skipNext = false
  let subcommand: string | undefined
  for (const arg of args) {
    if (skipNext) {
      skipNext = false
      continue
    }
    if (arg === '-c' || arg === '-C') {
      skipNext = true
      continue
    }
    if (arg.startsWith('-')) {
      continue
    }
    subcommand = arg
    break
  }

  if (!subcommand) {
    return false
  }

  return WSL_SAFE_SUBCOMMANDS.has(subcommand)
}

export function canUseWSLGit(
  args: ReadonlyArray<string>,
  repositoryPath: string
): boolean {
  if (!__WIN32__) {
    return false
  }

  if (!enableWSLPerformanceOptimizations()) {
    return false
  }

  if (!isWSLPath(repositoryPath)) {
    return false
  }

  return isWSLSafeGitSubcommand(args)
}

// 10s threshold accounts for WSL 9P filesystem mtime lag and NTP drift.
// A legitimate git index write completes well under this.
const STALE_INDEX_LOCK_AGE_MS = 10_000

// Removes a stale `.git/index.lock` only on WSL UNC paths and only when
// older than STALE_INDEX_LOCK_AGE_MS, to avoid racing a legitimate in-flight
// git process.
export async function cleanupStaleIndexLock(
  repositoryPath: string
): Promise<boolean> {
  if (!__WIN32__ || !isWSLPath(repositoryPath)) {
    return false
  }

  const lockPath = Path.join(repositoryPath, '.git', 'index.lock')

  try {
    const stats = await stat(lockPath)
    const ageMs = Date.now() - stats.mtimeMs

    // Negative age means clock skew (mtime in the future) — don't touch it
    if (ageMs < STALE_INDEX_LOCK_AGE_MS || ageMs < 0) {
      return false
    }

    await unlink(lockPath)
    log.warn(
      `Removed stale index.lock (age ${ageMs}ms) at ${lockPath}; ` +
        `previous git process likely crashed.`
    )
    return true
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return false
    }
    log.warn(`Failed to inspect/remove ${lockPath}`, error)
    return false
  }
}
