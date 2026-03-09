import { useEffect, useMemo, useRef, useState } from "react";
import { FaComments, FaHeart, FaPaperPlane, FaReply, FaTimes } from "react-icons/fa";
import ChatAudioPlayer from "./ChatAudioPlayer";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

const pickAvatar = (...values) => values.find((value) => typeof value === "string" && value.trim()) || FALLBACK_AVATAR;

export default function PostCommentsModal({
  isOpen,
  onClose,
  tweet,
  comments,
  loading,
  sendComment,
  likeComment,
  commentLikeLoadingId,
  profile,
  timeAgo,
  containsArabic,
  onOpenProfile,
}) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    });
  }, [isOpen, comments.length]);

  useEffect(() => {
    if (!isOpen) return;
    setDraft("");
    setReplyTo(null);
  }, [isOpen, tweet?.id]);

  const commentsByParent = useMemo(() => {
    const map = {};
    (comments || []).forEach((comment) => {
      const key = comment.parentCommentId || "root";
      if (!map[key]) map[key] = [];
      map[key].push(comment);
    });
    return map;
  }, [comments]);

  if (!isOpen || !tweet) return null;

  const renderCommentTree = (parentId = "root", depth = 0) => {
    const nodes = commentsByParent[parentId] || [];
    if (!nodes.length) return null;
    return nodes.map((comment) => {
      const loadingKey = `${tweet.id}:${comment.id}`;
      return (
        <div key={comment.id} className={`comment-node depth-${Math.min(depth, 3)}`}>
          <button type="button" className="profile-link-btn" onClick={() => onOpenProfile?.(comment.authorUid)}>
            <img src={pickAvatar(comment.authorPhotoURL, comment.authorPhotoUrl)} alt={comment.authorNickname} className="avatar-sm" />
          </button>
          <div className="comment-node-body">
            <button type="button" className="profile-link-btn comment-author" onClick={() => onOpenProfile?.(comment.authorUid)}>
              <strong>{comment.authorNickname}</strong>
            </button>
            <p className={containsArabic(comment.text) ? "arabic-text" : ""}>{comment.text}</p>
            <div className="comment-node-actions">
              <small>{timeAgo(comment.createdAt)}</small>
              <button
                type="button"
                className={`comment-like-btn ${comment.likedByMe ? "active" : ""}`}
                disabled={commentLikeLoadingId === loadingKey}
                onClick={() => likeComment(tweet.id, comment.id)}
              >
                <FaHeart /> {comment.likesCount || 0}
              </button>
              <button type="button" className="comment-reply-btn" onClick={() => setReplyTo(comment)}>
                <FaReply /> Reply
              </button>
            </div>
            {renderCommentTree(comment.id, depth + 1)}
          </div>
        </div>
      );
    });
  };

  const submitComment = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await sendComment(tweet.id, text, replyTo?.id || "");
    setDraft("");
    setReplyTo(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content comments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><FaComments /> Post comments</h3>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close comments">
            <FaTimes />
          </button>
        </div>
        <div className="comments-modal-body">
          <article className="comments-focus-post">
            <button type="button" className="author-row author-btn" onClick={() => onOpenProfile?.(tweet.authorUid)}>
              <img src={pickAvatar(tweet.authorPhotoURL, tweet.authorPhotoUrl)} alt={tweet.authorNickname} className="avatar" />
              <div>
                <strong>{tweet.authorNickname}</strong>
                <small> {timeAgo(tweet.createdAt)}</small>
              </div>
            </button>
            {Boolean(tweet.content) && <p className={containsArabic(tweet.content) ? "arabic-text" : ""}>{tweet.content}</p>}
            {tweet.imageData && <img src={tweet.imageData} alt="Tweet media" className="feed-media-image" />}
            {tweet.audioData && <ChatAudioPlayer src={tweet.audioData} className="feed-media-audio" />}
            {tweet.videoData && <video src={tweet.videoData} className="feed-media-video" controls preload="metadata" />}
          </article>

          <div className="comments-thread" ref={listRef}>
            {loading ? (
              <div className="empty-messages"><div className="spinner" /></div>
            ) : (
              renderCommentTree()
            )}
            {!loading && !comments.length && (
              <p className="empty-messages">No comments yet.</p>
            )}
          </div>

          {replyTo && (
            <div className="replying-chip comment-replying-chip">
              Replying to {replyTo.authorNickname}
              <button type="button" onClick={() => setReplyTo(null)}>
                <FaTimes />
              </button>
            </div>
          )}

          <form className="row-form comment-compose-row" onSubmit={submitComment}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyTo ? `Reply to ${replyTo.authorNickname}` : "Write a comment"}
              minLength={2}
              required
            />
            <button type="submit" className="send-icon-btn" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : <FaPaperPlane />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
