import { FaPlus, FaTimes } from "react-icons/fa";

export default function PublishNovelModal({
  isOpen,
  onClose,
  LANGS,
  postTitle,
  setPostTitle,
  postLanguage,
  setPostLanguage,
  postContent,
  setPostContent,
  postNovel,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-publish" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><FaPlus /> Publish novel</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={postNovel} className="stack-form modal-form">
          <input
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
            placeholder="title"
            required
          />
          <select
            value={postLanguage}
            onChange={(e) => setPostLanguage(e.target.value)}
          >
            {LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="story..."
            minLength={20}
            rows={8}
            required
          />
          <div className="modal-actions">
            <button className="primary-btn" type="submit">Post novel</button>
            <button className="secondary-btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
