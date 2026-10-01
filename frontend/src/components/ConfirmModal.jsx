export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="confirm-modal-card">
        <div className={`confirm-icon-wrapper ${variant}`}>
          {variant === 'danger' ? '🛑' : '↩️'}
        </div>
        <div className="confirm-content">
          <h4 id="confirm-modal-title" className="confirm-title">{title}</h4>
          <div className="confirm-message">{message}</div>
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn-confirm btn-confirm-${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <span className="status-spinner" style={{ marginRight: '0.4rem' }} />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
