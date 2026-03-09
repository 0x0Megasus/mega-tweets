import { useEffect, useRef, useState } from "react";
import { FaComments, FaEllipsisH, FaGlobe, FaHeart, FaPlus } from "react-icons/fa";
import ChatAudioPlayer from "./ChatAudioPlayer";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

const pickAvatar = (...values) => values.find((value) => typeof value === "string" && value.trim()) || FALLBACK_AVATAR;
const handleAvatarError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = FALLBACK_AVATAR;
};
const extensionFromDataUrl = (dataUrl, fallback = "bin") => {
  if (!dataUrl?.startsWith("data:")) return fallback;
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  if (!mime.includes("/")) return fallback;
  const ext = mime.split("/")[1];
  return ext || fallback;
};

export default function FeedView(props) {
  const {
    tweets, editingId, editContent, setEditContent,
    saveEdit, setEditingId, timeAgo, containsArabic, likeTweet, likeLoadingId, commentLoadingId, toggleComments, profile, startEdit, delTweet,
    commentCache, sendComment, onOpenPublish, users, focusedPostId, onOpenProfile,
    title = "Tweets",
    showPublish = true,
    emptyText = "No tweets yet. Be the first to post one!",
  } = props;
  const userByUid = Object.fromEntries((users || []).map((user) => [user.uid, user]));
  const postRefs = useRef({});
  const [openMenuId, setOpenMenuId] = useState("");

  useEffect(() => {
    if (!focusedPostId) return;
    const target = postRefs.current[focusedPostId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedPostId, tweets]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const onDocClick = () => setOpenMenuId("");
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openMenuId]);

  return (
    <section className="feed-layout-full">
      <article className="panel">
        <div className="feed-header">
          <h3><FaGlobe /> {title}</h3>
          {showPublish && (
            <button className="primary-btn publish-btn" onClick={onOpenPublish}>
              <FaPlus /> New Tweet
            </button>
          )}
        </div>
        <div className="cards">
          {tweets.length === 0 ? (
            <div className="empty-state">
              <p>{emptyText}</p>
            </div>
          ) : (
            tweets.map((n) => (
              <div
                key={n.id}
                className={`tweet-card fb-card ${focusedPostId === n.id ? "focus-post" : ""}`}
                ref={(el) => {
                  if (el) postRefs.current[n.id] = el;
                }}
              >
                {editingId === n.id ? (
                  <form onSubmit={(e) => saveEdit(e, n.id)} className="stack-form">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} minLength={2} rows={6} required />
                    <div className="actions-row"><button type="submit">Save</button><button type="button" onClick={() => setEditingId("")}>Cancel</button></div>
                  </form>
                ) : (
                  <>
                    <div className="meta-row">
                      <button
                        type="button"
                        className="author-row author-btn"
                        onClick={() => onOpenProfile?.(n.authorUid)}
                      >
                        <img
                          src={pickAvatar(
                            n.authorPhotoURL,
                            n.authorPhotoUrl,
                            n.photoURL,
                            n.photoUrl,
                            userByUid[n.authorUid]?.photoURL,
                            userByUid[n.authorUid]?.photoUrl,
                          )}
                          alt={n.authorNickname}
                          className="avatar"
                          onError={handleAvatarError}
                        />
                        <div>
                          <strong>{n.authorNickname}</strong>
                          <small> {timeAgo(n.createdAt)}</small>
                        </div>
                      </button>
                      {n.authorUid === profile.uid && (
                        <div className="owner-options" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="owner-options-btn"
                            onClick={() => setOpenMenuId((prev) => (prev === n.id ? "" : n.id))}
                            aria-label="Post options"
                          >
                            <FaEllipsisH />
                          </button>
                          {openMenuId === n.id && (
                            <div className="owner-options-menu">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm("Edit this post?")) return;
                                  startEdit(n);
                                  setOpenMenuId("");
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => {
                                  if (!window.confirm("Delete this post permanently?")) return;
                                  delTweet(n.id);
                                  setOpenMenuId("");
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {Boolean(n.content) && <p className={containsArabic(n.content) ? "arabic-text" : ""}>{n.content}</p>}
                    {n.imageData && <img src={n.imageData} alt="Tweet media" className="feed-media-image" />}
                    {n.audioData && <ChatAudioPlayer src={n.audioData} className="feed-media-audio" />}
                    {n.videoData && (
                      <div className="feed-media-video-wrap">
                        <video src={n.videoData} className="feed-media-video" controls preload="metadata" />
                        <a href={n.videoData} download={`tweet-video-${n.id}.${extensionFromDataUrl(n.videoData, "mp4")}`} className="media-download">
                          Download
                        </a>
                      </div>
                    )}
                    <div className="actions-row">
                      <button type="button" className="action-btn" onClick={() => likeTweet(n.id)} disabled={likeLoadingId === n.id}>
                        {likeLoadingId === n.id ? <span className="btn-spinner" /> : <><FaHeart /> {n.likesCount}</>}
                      </button>
                      <button type="button" className="action-btn" onClick={() => toggleComments(n.id)} disabled={commentLoadingId === n.id}>
                        {commentLoadingId === n.id ? <span className="btn-spinner" /> : <><FaComments /> {n.commentsCount}</>}
                      </button>
                    </div>
                    {commentCache[n.id] && (
                      <div className="comment-box fb-comments">
                        {commentCache[n.id].map((c) => (
                          <div key={c.id} className="comment-item">
                            <img
                              src={pickAvatar(
                                c.authorPhotoURL,
                                c.authorPhotoUrl,
                                c.photoURL,
                                c.photoUrl,
                                userByUid[c.authorUid]?.photoURL,
                                userByUid[c.authorUid]?.photoUrl,
                              )}
                              alt={c.authorNickname}
                              className="avatar-sm"
                              onError={handleAvatarError}
                            />
                            <div>
                              <strong>{c.authorNickname}</strong>
                              <p>{c.text}</p>
                              <small>{timeAgo(c.createdAt)}</small>
                            </div>
                          </div>
                        ))}
                        <form onSubmit={(e) => sendComment(e, n.id)} className="row-form comment-form">
                          <input name="text" placeholder="Write comment" minLength={2} required />
                          <button type="submit" disabled={commentLoadingId === n.id}>{commentLoadingId === n.id ? <span className="btn-spinner" /> : 'Send'}</button>
                        </form>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
