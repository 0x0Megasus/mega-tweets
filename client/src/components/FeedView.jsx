import { FaComments, FaGlobe, FaHeart, FaPlus, FaTrash } from "react-icons/fa";

export default function FeedView(props) {
  const {
    LANGS, postTitle, setPostTitle, postLanguage, setPostLanguage, postContent, setPostContent,
    postNovel, novels, editingId, editTitle, setEditTitle, editLang, setEditLang, editContent, setEditContent,
    saveEdit, setEditingId, timeAgo, containsArabic, likeNovel, likeLoadingId, commentLoadingId, toggleComments, profile, startEdit, delNovel,
    commentCache, sendComment, onOpenPublish,
  } = props;

  return (
    <section className="feed-layout-full">
      <article className="panel">
        <div className="feed-header">
          <h3><FaGlobe /> Feed</h3>
          <button className="primary-btn publish-btn" onClick={onOpenPublish}>
            <FaPlus /> New Post
          </button>
        </div>
        <div className="cards">
          {novels.length === 0 ? (
            <div className="empty-state">
              <p>No posts yet. Be the first to publish a novel!</p>
            </div>
          ) : (
            novels.map((n) => (
              <div key={n.id} className="novel-card fb-card">
                {editingId === n.id ? (
                  <form onSubmit={(e) => saveEdit(e, n.id)} className="stack-form">
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                    <select value={editLang} onChange={(e) => setEditLang(e.target.value)}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} minLength={20} rows={6} required />
                    <div className="actions-row"><button type="submit">Save</button><button type="button" onClick={() => setEditingId("")}>Cancel</button></div>
                  </form>
                ) : (
                  <>
                    <div className="meta-row">
                      <div className="author-row">
                        <img src={n.authorPhotoURL || ""} alt={n.authorNickname} className="avatar" />
                        <div>
                          <strong>{n.authorNickname}</strong>
                          <small> {timeAgo(n.createdAt)}</small>
                        </div>
                      </div>
                      <span className="tag">{n.language}</span>
                    </div>
                    <h4 className={containsArabic(n.title) ? "arabic-text" : ""}>{n.title}</h4>
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
                            <img src={c.authorPhotoURL || ""} alt={c.authorNickname} className="avatar-sm" />
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
