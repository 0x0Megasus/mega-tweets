import { useEffect, useRef } from "react";
import { FaComments, FaPaperPlane, FaReply, FaUserCircle } from "react-icons/fa";

export default function DmView({ others, dmTargetUid, setDmTargetUid, setDmReplyTo, dmMessages, profile, timeAgo, dmReplyTo, setDmDraft, dmDraft, sendDm, dmSending }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [dmMessages, dmTargetUid]);

  return (
    <section className="grid-two dm-layout">
      <article className="panel"><h3><FaUserCircle /> Users</h3><div className="user-list dm-user-list">{others.map((u) => <button type="button" key={u.uid} className={`user-item dm-user-item ${dmTargetUid === u.uid ? "selected" : ""}`} onClick={() => { setDmTargetUid(u.uid); setDmReplyTo(null); }}><img src={u.photoURL || ""} alt={u.nickname} className="avatar" /><span>{u.nickname}</span></button>)}</div></article>
      <article className="panel chat-panel"><h3><FaComments /> Direct</h3>{dmTargetUid ? <><div ref={listRef} className="messages-box">{dmMessages.length ? dmMessages.map((m) => <div key={m.id} className={`message-item ${m.senderUid === profile.uid ? "mine" : ""} ${m.senderUid !== profile.uid && m.replyTo?.senderUid === profile.uid ? "is-reply-to-me" : ""}`}><img src={m.senderPhotoURL || ""} alt={m.senderNickname} className="avatar-msg" /><div className="msg-bubble"><strong>{m.senderNickname}</strong>{m.replyTo && <p className="reply-preview">@{m.replyTo.senderNickname}: {m.replyTo.text}</p>}<p>{m.text}</p><small>{timeAgo(m.createdAt)}</small>{m.senderUid !== profile.uid && <button type="button" className="reply-btn" onClick={() => setDmReplyTo(m)}><FaReply /> Reply</button>}</div></div>) : <p className="empty-messages">No messages yet.</p>}</div>{dmReplyTo && <div className="replying-chip">Replying to {dmReplyTo.senderNickname}<button type="button" onClick={() => setDmReplyTo(null)}>x</button></div>}<form onSubmit={sendDm} className="row-form chat-input-row"><input value={dmDraft} onChange={(e) => setDmDraft(e.target.value)} placeholder="Write DM" required /><button type="submit" className="send-icon-btn" disabled={dmSending}>{dmSending ? <span className="btn-spinner" /> : <FaPaperPlane />}</button></form></> : <p>Select a user.</p>}</article>
    </section>
  );
}
