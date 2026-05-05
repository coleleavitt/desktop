import { Account } from '../models/account'

const Disable = false

/**
 * Enables the application to opt-in for preview features based on runtime
 * checks. This is backed by the GITHUB_DESKTOP_PREVIEW_FEATURES environment
 * variable, which is checked for non-development environments.
 */
function enableDevelopmentFeatures(): boolean {
  if (Disable) {
    return false
  }

  if (__DEV__) {
    return true
  }

  if (process.env.GITHUB_DESKTOP_PREVIEW_FEATURES === '1') {
    return true
  }

  return false
}

/** Should the app enable beta features? */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore: this will be used again in the future
function enableBetaFeatures(): boolean {
  return enableDevelopmentFeatures() || __RELEASE_CHANNEL__ === 'beta'
}

/**
 * Should the app show menu items that are used for testing various parts of the
 * UI
 *
 * For our own testing purposes, this will likely remain enabled. But, sometimes
 * we may want to create a test release for a user to test a fix in which case
 * they should not need access to the test menu items.
 */
export const enableTestMenuItems = () =>
  enableDevelopmentFeatures() || __RELEASE_CHANNEL__ === 'test'

export function enableReadmeOverwriteWarning(): boolean {
  return enableBetaFeatures()
}

/** Should the app detect Windows Subsystem for Linux as a valid shell? */
export function enableWSLDetection(): boolean {
  return enableBetaFeatures()
}

export function enableWSLPerformanceOptimizations(): boolean {
  return enableBetaFeatures()
}

/**
 * Should `git commit` on WSL repository paths run via `wsl.exe -e git`
 * instead of Windows `git.exe`?
 *
 * When enabled, commits on `\\wsl.localhost\` and `\\wsl$\` paths execute
 * inside the WSL distro, avoiding the 9P filesystem boundary entirely. This
 * sidesteps the Windows kernel-level STATUS_IN_PAGE_ERROR (0xC0000006) crash
 * that affects Git for Windows when writing to ext4 via the 9P provider.
 *
 * Tradeoffs (documented in commit.ts):
 *  - Hook output is not surfaced through Desktop's hook progress UI
 *  - Hooks cannot use Desktop's credential helper / askpass
 *  - GPG signing relies on WSL-side gpg-agent
 *
 * Defaults to true alongside the rest of the WSL performance work; users can
 * disable via `GITHUB_DESKTOP_WSL_NATIVE_COMMIT=false`.
 */
export function enableWSLNativeCommit(): boolean {
  if (process.env.GITHUB_DESKTOP_WSL_NATIVE_COMMIT === 'false') {
    return false
  }
  return enableWSLPerformanceOptimizations()
}

/**
 * Should we allow reporting unhandled rejections as if they were crashes?
 */
export function enableUnhandledRejectionReporting(): boolean {
  return enableBetaFeatures()
}

/**
 * Should we allow x64 apps running under ARM translation to auto-update to
 * ARM64 builds?
 */
export function enableUpdateFromEmulatedX64ToARM64(): boolean {
  if (__DARWIN__) {
    return true
  }

  return enableBetaFeatures()
}

/** Should we show previous tags as suggestions? */
export function enablePreviousTagSuggestions(): boolean {
  return enableBetaFeatures()
}

/** Should we show a pull-requests quick view? */
export function enablePullRequestQuickView(): boolean {
  return enableDevelopmentFeatures()
}

/** Should we support image previews for dds files? */
export function enableImagePreviewsForDDSFiles(): boolean {
  return enableBetaFeatures()
}

export const enableCustomIntegration = () => true

export const enableResizingToolbarButtons = () => true

export const enableCommitMessageGeneration = (account: Account) => {
  return (
    (account.features ?? []).includes(
      'desktop_copilot_generate_commit_message'
    ) &&
    // IMPORTANT: Do not remove this feature flag without replacing its usages
    // with a check for the `isCopilotDesktopEnabled` property on the account.
    account.isCopilotDesktopEnabled
  )
}

export const enableCopilotSdkCommitMessageGeneration = (account: Account) => {
  return (
    enableBetaFeatures() &&
    (account.features ?? []).includes(
      'desktop_enable_copilot_sdk_commit_message_generation'
    )
  )
}

/** Should we enable Copilot-powered merge conflict resolution? */
export function enableCopilotConflictResolution(): boolean {
  return enableDevelopmentFeatures()
}

export function enableAccessibleListToolTips(): boolean {
  return enableBetaFeatures()
}

export const enableHooksEnvironment = () => true

export const enableHooksByDefault = enableBetaFeatures

export const enableFormattingPreferences = enableBetaFeatures
