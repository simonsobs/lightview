import {
  MouseEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { CloseIcon } from './icons/CloseIcon';
import './styles/confirm-dialog.css';

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** May return a promise - the confirm button shows a busy state and both buttons are disabled
   * until it settles. Rejections propagate to the caller and leave the dialog open (so the user
   * can retry or cancel) rather than being swallowed here. */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

/** A destructive-action confirmation modal: use before any decision that can't be undone (e.g.
 * merging sources). Cancel is auto-focused on every open, not Confirm, so pressing Enter out
 * of habit doesn't accidentally commit the action. */
export function ConfirmDialog({
  open,
  title = '',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
      // Re-asserted on every open (not just mount, unlike the HTML autofocus attribute/React's
      // autoFocus prop) since this element persists across opens/closes rather than remounting.
      cancelButtonRef.current?.focus();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  }, [open]);

  // The native "cancel" event fires only for user-initiated dismissal (the Escape key) - not for
  // our own programmatic close() call above - so forwarding it to onCancel can't double-fire.
  // Its default action is what actually closes the dialog, so it's intentionally not prevented.
  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;
    const handleCancel = () => onCancel();
    dialogEl.addEventListener('cancel', handleCancel);
    return () => dialogEl.removeEventListener('cancel', handleCancel);
  }, [onCancel]);

  // Clicking the ::backdrop targets the <dialog> element itself (it isn't a real descendant
  // node); padding: 0 on .confirm-dialog means every other click target is inside
  // .confirm-dialog-content, so this check can't misfire on a genuine content click.
  const handleBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={handleBackdropClick}
    >
      <div className="confirm-dialog-content">
        <div className="confirm-dialog-header">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="confirm-dialog-close-button"
            aria-label="Close"
            onClick={onCancel}
            disabled={isConfirming}
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
        {description && (
          <div id={descriptionId} className="confirm-dialog-description">
            {description}
          </div>
        )}
        <div className="confirm-dialog-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="confirm-dialog-cancel-button"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-dialog-confirm-button"
            onClick={() => void handleConfirm()}
            disabled={isConfirming}
          >
            {isConfirming ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
