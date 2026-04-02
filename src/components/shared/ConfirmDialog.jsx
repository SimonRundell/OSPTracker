/**
 * ConfirmDialog - modal confirmation dialog.
 * @module ConfirmDialog
 */

/**
 * @param {{ message: string, onConfirm: Function, onCancel: Function, confirmLabel?: string }} props
 */
export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Confirm' }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
