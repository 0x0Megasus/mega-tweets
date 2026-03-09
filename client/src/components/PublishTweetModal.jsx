import { FaPlus, FaTimes } from "react-icons/fa";

export default function PublishTweetModal({
  isOpen,
  onClose,
  postContent,
  setPostContent,
  postTweet,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-publish" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><FaPlus /> Publish Tweet</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={postTweet} className="stack-form modal-form">
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="What's happening?"
            minLength={2}
            rows={8}
            required
          />
          <div className="modal-actions">
            <button className="primary-btn" type="submit">Post Tweet</button>
            <button className="secondary-btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
