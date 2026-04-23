import { writeFile } from 'fs/promises'
import { resolveWithin } from './path'

/**
 * Result of applying Copilot resolutions to the working directory.
 *
 * On success, `failedFiles` is empty. On partial failure, it contains
 * the files that could not be written along with the error reason.
 */
export interface IApplyResolutionsResult {
  readonly appliedFiles: ReadonlyArray<string>
  readonly failedFiles: ReadonlyArray<{
    readonly path: string
    readonly error: string
  }>
}

/**
 * Write accepted Copilot conflict resolutions to the working directory.
 *
 * Each file path is validated against the repository root to prevent
 * directory traversal attacks. Files that fail validation or cannot be
 * written are collected in the result rather than throwing.
 *
 * @param repositoryPath - Absolute path to the repository root
 * @param resolutions - Map of repository-relative file paths to their
 *                      resolved content
 * @returns Result indicating which files were applied and which failed
 */
export async function applyCopilotResolutionsToWorkingDirectory(
  repositoryPath: string,
  resolutions: ReadonlyMap<string, string>
): Promise<IApplyResolutionsResult> {
  const appliedFiles: Array<string> = []
  const failedFiles: Array<{ readonly path: string; readonly error: string }> =
    []

  for (const [filePath, content] of resolutions) {
    try {
      const absolutePath = await resolveWithin(repositoryPath, filePath)
      if (absolutePath === null) {
        failedFiles.push({
          path: filePath,
          error: 'File path is outside the repository',
        })
        continue
      }

      await writeFile(absolutePath, content, 'utf8')
      appliedFiles.push(filePath)
    } catch (e) {
      failedFiles.push({
        path: filePath,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { appliedFiles, failedFiles }
}
