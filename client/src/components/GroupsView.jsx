import { useEffect, useMemo, useRef } from "react";
import { FaComments, FaCopy, FaCrown, FaPaperPlane, FaReply, FaUsers } from "react-icons/fa";

export default function GroupsView(props) {
  const { isMobile, mobileGroupPage, setMobileGroupPage, createGroup, groupName, setGroupName, groupDesc, setGroupDesc, joinByCode, inviteCodeInput, setInviteCodeInput, groups, selectedGroup, setSelectedGroup, joinOrLeave, selectedGroupData, groupMessages, profile, timeAgo, setGroupReplyTo, groupReplyTo, groupDraft, setGroupDraft, sendGroup, groupSending, groupMembers, promote, removeMember } = props;
  const listRef = useRef(null);
  const sortedMembers = useMemo(() => {
    return [...groupMembers].sort((a, b) => {
      const aSelf = a.uid === profile?.uid;
      const bSelf = b.uid === profile?.uid;
      if (aSelf && !bSelf) return -1;
      if (!aSelf && bSelf) return 1;
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return (a.nickname || "").localeCompare(b.nickname || "");
    });
  }, [groupMembers, profile?.uid]);

  const NAME_COLORS = [
    "#ffad66",
    "#7cc7ff",
    "#8ff0a4",
    "#f7a8ff",
    "#ffd166",
    "#9ab7ff",
    "#67e8f9",
    "#fca5a5",
    "#a7f3d0",
    "#c4b5fd",
    "#fdba74",
    "#86efac",
  ];

  const usernameColor = (uid = "", nickname = "") => {
    const key = `${uid || ""}:${nickname || ""}`;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NAME_COLORS.length;
    return NAME_COLORS[index];
  };

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [groupMessages, selectedGroup]);

  return (
    <section className="groups-layout">
      {(!isMobile || mobileGroupPage === "list") && (
        <article className="panel groups-list-panel">
          <h3><FaUsers /> Groups</h3>
          <form onSubmit={createGroup} className="stack-form">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" minLength={3} required />
            <textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="About this group" rows={3} />
            <button className="primary-btn group-create-btn" type="submit">Create</button>
          </form>
          <form onSubmit={joinByCode} className="row-form invite-form"><input value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} placeholder="Invite code / link" /><button type="submit">Join</button></form>
          <div className="group-list">{groups.map((g) => <div key={g.id} className={`group-item ${selectedGroup === g.id ? "selected" : ""}`}><div onClick={() => { setSelectedGroup(g.id); if (isMobile) setMobileGroupPage("chat"); }}><strong>{g.name}</strong><p>{g.description}</p><small>{g.membersCount} members {g.isAdmin ? "• admin" : ""}</small></div><button type="button" onClick={() => joinOrLeave(g)}>{g.joined ? "Leave" : "Join"}</button></div>)}</div>
        </article>
      )}

      {(!isMobile || mobileGroupPage === "chat") && (
        <article className="panel groups-chat-panel chat-panel">
          {isMobile && <button type="button" className="back-btn" onClick={() => setMobileGroupPage("list")}>Back to groups</button>}
          <h3><FaComments /> Group Chat</h3>
          {selectedGroupData ? (
            selectedGroupData.joined ? (
              <>
                {selectedGroupData.isAdmin && selectedGroupData.inviteLink && <div className="invite-link-row"><span>{selectedGroupData.inviteLink}</span><button type="button" onClick={() => navigator.clipboard?.writeText(selectedGroupData.inviteLink)}><FaCopy /></button></div>}
                <div ref={listRef} className="messages-box">{groupMessages.length ? groupMessages.map((m) => <div key={m.id} className={`message-item ${m.senderUid === profile.uid ? "mine" : ""} ${m.senderUid !== profile.uid && m.replyTo?.senderUid === profile.uid ? "is-reply-to-me" : ""}`}><img src={m.senderPhotoURL || ""} alt={m.senderNickname} className="avatar-msg" /><div className="msg-bubble"><strong style={{ color: usernameColor(m.senderUid, m.senderNickname) }}>{m.senderNickname}</strong>{m.replyTo && <p className="reply-preview">@{m.replyTo.senderNickname}: {m.replyTo.text}</p>}<p>{m.text}</p><small>{timeAgo(m.createdAt)}</small>{m.senderUid !== profile.uid && <button type="button" className="reply-btn" onClick={() => setGroupReplyTo(m)}><FaReply /> Reply</button>}</div></div>) : <p className="empty-messages">No group messages yet.</p>}</div>
                {groupReplyTo && <div className="replying-chip">Replying to {groupReplyTo.senderNickname}<button type="button" onClick={() => setGroupReplyTo(null)}>x</button></div>}
                <form onSubmit={sendGroup} className="row-form chat-input-row"><input value={groupDraft} onChange={(e) => setGroupDraft(e.target.value)} placeholder="Write to group" required /><button type="submit" className="send-icon-btn" disabled={groupSending}>{groupSending ? <span className="btn-spinner" /> : <FaPaperPlane />}</button></form>
              </>
            ) : (
              <p>Join the group to see its messages.</p>
            )
          ) : <p>Select a group.</p>}
        </article>
      )}

      {!isMobile && (
        <article className="panel groups-members-panel">
          <h3><FaCrown /> Members</h3>
          {selectedGroupData?.isAdmin ? (
            <div className="admin-box">{sortedMembers.map((m) => <div key={m.uid} className="admin-member-row"><div className="member-main"><img src={m.photoURL || ""} alt={m.nickname} className="avatar-member" /><div><strong>{m.nickname}</strong>{m.isAdmin && <span className="admin-badge"><FaCrown /> Admin</span>}</div></div>{m.uid !== profile.uid && <div className="actions-row">{!m.isAdmin && <button type="button" onClick={() => promote(m.uid)}>Promote</button>}<button type="button" onClick={() => removeMember(m.uid)}>Remove</button></div>}</div>)}</div>
          ) : <p>Admins panel.</p>}
        </article>
      )}
    </section>
  );
}
