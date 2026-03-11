import { useEffect, useRef, useState } from "react";
import { FaComments, FaEllipsisH, FaGlobe, FaHeart, FaPlus } from "react-icons/fa";
import ChatAudioPlayer from "./ChatAudioPlayer";
import VideoPlayer from "./VideoPlayer";

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
    saveEdit, setEditingId, timeAgo, containsArabic, likeTweet, likeLoadingId, commentLoadingId, openCommentsModal, profile, startEdit, delTweet,
    onOpenPublish, users, focusedPostId, onOpenProfile,
    title = "Tweets",
    showPublish = true,
    emptyText = "No tweets yet. Be the first to post one!",
    feedLoading = false,
    feedLoadedOnce = false,
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

  const postDownloadInfo = (post) => {
    if (post.videoData) return { href: post.videoData, filename: `tweet-video-${post.id}.${extensionFromDataUrl(post.videoData, "mp4")}` };
    if (post.imageData) return { href: post.imageData, filename: `tweet-image-${post.id}.${extensionFromDataUrl(post.imageData, "png")}` };
    if (post.audioData) return { href: post.audioData, filename: `tweet-audio-${post.id}.${extensionFromDataUrl(post.audioData, "webm")}` };
    return null;
  };

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
              {feedLoading || !feedLoadedOnce ? (
                <div className="loading-inline">
                  <div className="spinner" />
                  <p>Loading feed...</p>
                </div>
              ) : (
                <p>{emptyText}</p>
              )}
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
                {(() => {
                  const isOwner = n.authorUid === profile.uid;
                  const download = postDownloadInfo(n);
                  const hasOptions = isOwner || Boolean(download);
                  return editingId === n.id ? (
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
                        {hasOptions && (
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
                                {download && (
                                  <a href={download.href} download={download.filename} className="post-media-download-link">
                                    Download
                                  </a>
                                )}
                                {isOwner && (
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
                                )}
                                {isOwner && (
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
                                )}
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
                          <VideoPlayer src={n.videoData} className="feed-media-video" />
                        </div>
                      )}
                      <div className="actions-row">
                        <button
                          type="button"
                          className={`action-btn like-btn ${n.likedByMe ? "active" : ""}`}
                          onClick={() => likeTweet(n.id)}
                          disabled={likeLoadingId === n.id}
                        >
                          {likeLoadingId === n.id ? <span className="btn-spinner" /> : <><FaHeart /> {n.likesCount}</>}
                        </button>
                        <button type="button" className="action-btn" onClick={() => openCommentsModal(n.id)} disabled={commentLoadingId === n.id}>
                          {commentLoadingId === n.id ? <span className="btn-spinner" /> : <><FaComments /> {n.commentsCount}</>}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
