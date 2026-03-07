export default function ConfirmLeaveModal({ onConfirm, onCancel }) {
  return (
    <div className="loading-overlay" role="dialog" aria-modal="true">
      <div className="confirm-card">
        <h4>Leave Group</h4>
        <p>You are the only admin. Leaving will delete this group.</p>
        <div className="actions-row">
          <button type="button" onClick={onConfirm}>Delete & Leave</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
