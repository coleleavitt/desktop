import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { ICopilotConflictResolutionResponse } from '../../lib/copilot-conflict-resolution'

interface ICopilotConflictResolutionDialogProps {
  /** Title for the dialog header. */
  readonly headerTitle: string | JSX.Element
  /** Label for the submit button (e.g., "Continue Merge"). */
  readonly submitButton: string
  /** Label for the abort button (e.g., "Abort Merge"). */
  readonly abortButton: string
  /** The Copilot resolution response containing per-file results. */
  readonly copilotResponse: ICopilotConflictResolutionResponse
  /** Called when the user clicks "Continue merge" to apply resolutions. */
  readonly onSubmit: () => Promise<void>
  /** Called when the user clicks abort. */
  readonly onAbort: () => Promise<void>
  /** Called when the user dismisses the dialog. */
  readonly onDismissed: () => void
  /** Called to exit Copilot mode and return to the standard conflicts dialog. */
  readonly onExitCopilotMode: () => void
}

interface ICopilotConflictResolutionDialogState {
  readonly isCommitting: boolean
  readonly isAborting: boolean
}

/**
 * Shell dialog for Copilot conflict resolution (MVP).
 *
 * Shows a summary of how many files Copilot resolved and a "Continue merge"
 * button. Future slices will add per-file controls, tabs, and settings.
 */
export class CopilotConflictResolutionDialog extends React.Component<
  ICopilotConflictResolutionDialogProps,
  ICopilotConflictResolutionDialogState
> {
  public constructor(props: ICopilotConflictResolutionDialogProps) {
    super(props)
    this.state = { isCommitting: false, isAborting: false }
  }

  private onSubmit = async () => {
    this.setState({ isCommitting: true })
    await this.props.onSubmit()
  }

  private onAbort = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    this.setState({ isAborting: true })
    await this.props.onAbort()
    this.setState({ isAborting: false })
  }

  public render() {
    const { headerTitle, submitButton, abortButton, copilotResponse } =
      this.props
    const { resolutions, skippedFiles } = copilotResponse
    const resolvedCount = resolutions.length
    const totalCount = resolvedCount + skippedFiles.length
    const allResolved = skippedFiles.length === 0

    return (
      <Dialog
        id="copilot-conflict-resolution-dialog"
        title={headerTitle}
        onDismissed={this.props.onDismissed}
        onSubmit={this.onSubmit}
        loading={this.state.isCommitting}
        disabled={this.state.isCommitting}
      >
        <DialogContent>
          <div className="copilot-resolution-summary">
            <div className="copilot-resolution-icon">
              <Octicon symbol={octicons.copilot} />
            </div>
            <p className="copilot-resolution-message">
              {allResolved
                ? `Copilot resolved all ${resolvedCount} conflicted ${
                    resolvedCount === 1 ? 'file' : 'files'
                  }.`
                : `Copilot resolved ${resolvedCount} of ${totalCount} conflicted ${
                    totalCount === 1 ? 'file' : 'files'
                  }.`}
            </p>
            {skippedFiles.length > 0 && (
              <p className="copilot-resolution-warning">
                {skippedFiles.length}{' '}
                {skippedFiles.length === 1 ? 'file' : 'files'} could not be
                resolved and will need manual resolution.
              </p>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <div className="copilot-resolution-footer">
            <button
              className="button-component"
              onClick={this.props.onExitCopilotMode}
              disabled={this.state.isCommitting}
            >
              Back to manual resolution
            </button>
            <OkCancelButtonGroup
              okButtonText={submitButton}
              okButtonDisabled={!allResolved && resolvedCount === 0}
              cancelButtonText={abortButton}
              onCancelButtonClick={this.onAbort}
              cancelButtonDisabled={this.state.isAborting}
            />
          </div>
        </DialogFooter>
      </Dialog>
    )
  }
}
