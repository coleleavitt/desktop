/** Per-file resolution result returned by the Copilot conflict resolution engine. */
export interface IFileResolution {
  /** Repository-relative file path */
  readonly path: string
  /** The fully resolved file content produced by Copilot */
  readonly resolvedContent: string
  /** A short, human-readable explanation of how the conflict was resolved */
  readonly reasoning: string
}

/**
 * Full response from the Copilot conflict resolution engine.
 *
 * Contains per-file resolutions for all conflicted files that Copilot
 * was able to resolve, plus any files that were skipped.
 */
export interface ICopilotConflictResolutionResponse {
  /** Successfully resolved files */
  readonly resolutions: ReadonlyArray<IFileResolution>
  /** Files that Copilot could not resolve, with reasons */
  readonly skippedFiles: ReadonlyArray<{
    readonly path: string
    readonly reason: string
  }>
}
