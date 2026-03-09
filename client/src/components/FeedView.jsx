import { useEffect, useRef } from "react";
import { FaComments, FaGlobe, FaHeart, FaPlus, FaTrash } from "react-icons/fa";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

const pickAvatar = (...values) => values.find((value) => typeof value === "string" && value.trim()) || FALLBACK_AVATAR;
const handleAvatarError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = FALLBACK_AVATAR;
};

export default function FeedView(props) {
  const {
    novels, editingId, editContent, setEditContent,
    saveEdit, setEditingId, timeAgo, containsArabic, likeNovel, likeLoadingId, commentLoadingId, toggleComments, profile, startEdit, delNovel,
    commentCache, sendComment, onOpenPublish, users, focusedPostId,
  } = props;
  const userByUid = Object.fromEntries((users || []).map((user) => [user.uid, user]));
  const postRefs = useRef({});

  useEffect(() => {
    if (!focusedPostId) return;
    const target = postRefs.current[focusedPostId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedPostId, novels]);

  return (
    <section className="feed-layout-full">
      <article className="panel">
        <div className="feed-header">
          <h3><FaGlobe /> Tweets</h3>
          <button className="primary-btn publish-btn" onClick={onOpenPublish}>
            <FaPlus /> New Tweet
          </button>
        </div>
        <div className="cards">
          {novels.length === 0 ? (
            <div className="empty-state">
              <p>No tweets yet. Be the first to post one!</p>
            </div>
          ) : (
            novels.map((n) => (
              <div
                key={n.id}
                className={`novel-card fb-card ${focusedPostId === n.id ? "focus-post" : ""}`}
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
                      <div className="author-row">
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
                      </div>
                    </div>
                    <p className={containsArabic(n.content) ? "arabic-text" : ""}>{n.content}</p>
                    <div className="actions-row">
                      <button type="button" className="action-btn" onClick={() => likeNovel(n.id)} disabled={likeLoadingId === n.id}>
                        {likeLoadingId === n.id ? <span className="btn-spinner" /> : <><FaHeart /> {n.likesCount}</>}
                      </button>
                      <button type="button" className="action-btn" onClick={() => toggleComments(n.id)} disabled={commentLoadingId === n.id}>
                        {commentLoadingId === n.id ? <span className="btn-spinner" /> : <><FaComments /> {n.commentsCount}</>}
                      </button>
                      {n.authorUid === profile.uid && (
                        <>
                          <button type="button" onClick={() => startEdit(n)}>Edit</button>
                          <button type="button" onClick={() => delNovel(n.id)}><FaTrash /></button>
                        </>
                      )}
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
