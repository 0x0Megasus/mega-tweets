import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowDown,
  FaComments,
  FaCopy,
  FaCrown,
  FaFileAudio,
  FaImage,
  FaMicrophone,
  FaPaperPlane,
  FaPlus,
  FaReply,
  FaStop,
  FaUsers,
  FaVideo,
  FaTimes,
} from "react-icons/fa";
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

export default function GroupsView(props) {
  const {
    isMobile,
    mobileGroupPage,
    setMobileGroupPage,
    showGroupMembers,
    setShowGroupMembers,
    createGroup,
    groupName,
    setGroupName,
    groupDesc,
    setGroupDesc,
    joinByCode,
    inviteCodeInput,
    setInviteCodeInput,
    groups,
    selectedGroup,
    setSelectedGroup,
    joinOrLeave,
    selectedGroupData,
    groupMessages,
    profile,
    timeAgo,
    setGroupReplyTo,
    groupReplyTo,
    groupDraft,
    setGroupDraft,
    sendGroup,
    groupSending,
    groupImageData,
    setGroupImageData,
    groupAudioData,
    setGroupAudioData,
    groupVideoData,
    setGroupVideoData,
    groupMembers,
    promote,
    removeMember,
    groupMessagesLoading,
    focusedGroupMessageId,
    onOpenProfile,
    clearGroupMessages,
    toggleGroupAutoDelete,
    groupSettingsSaving,
  } = props;

  const listRef = useRef(null);
  const chatInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewImage, setPreviewImage] = useState("");
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const messageRefs = useRef({});
  const memberByUid = Object.fromEntries((groupMembers || []).map((member) => [member.uid, member]));
  const lastMessageIdRef = useRef("");
  const lastGroupRef = useRef("");
  const [showScrollDown, setShowScrollDown] = useState(false);

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

  const isReplyToMe = (m) => m.senderUid !== profile.uid && m.replyTo?.senderUid === profile.uid;
  const toDataUrl = (file, maxBytes, onDone, label) => {
    if (!file) return;
    if (file.size > maxBytes) {
      window.alert(`${label} is too large. Max size is ${(maxBytes / 1_000_000).toFixed(1)}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onDone(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const resetRecorder = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setIsRecording(false);
  };

  const blobToDataUrl = (blob, onDone) => {
    const reader = new FileReader();
    reader.onloadend = () => onDone(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(blob);
  };

  const stopRecording = () => {
    if (!isRecording || !mediaRecorderRef.current) return;
    try {
      mediaRecorderRef.current.stop();
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Unable to start recording. Please check microphone permissions.");
      resetRecorder();
    }
  };

  const startRecording = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      window.alert("Voice messages are not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        blobToDataUrl(blob, (data) => {
          setGroupAudioData(data);
          if (data) {
            setGroupImageData("");
            setGroupVideoData("");
          }
        });
        resetRecorder();
      };
      recorder.start();
      setGroupAudioData("");
      setGroupVideoData("");
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Unable to start recording. Please check microphone permissions.");
      resetRecorder();
    }
  };

  useEffect(() => () => resetRecorder(), []);

  const isNearBottom = useCallback(() => {
    const list = listRef.current;
    if (!list) return true;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    return distanceFromBottom < 40;
  }, []);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
  }, []);

  const handleListScroll = useCallback(() => {
    setShowScrollDown(!isNearBottom());
  }, [isNearBottom]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.addEventListener("scroll", handleListScroll);
    return () => list.removeEventListener("scroll", handleListScroll);
  }, [handleListScroll, selectedGroup]);

  useEffect(() => {
    const latestMessageId = groupMessages[groupMessages.length - 1]?.id || "";
    const changedGroup = lastGroupRef.current !== selectedGroup;

    if (changedGroup) {
      lastGroupRef.current = selectedGroup;
      lastMessageIdRef.current = latestMessageId;
      requestAnimationFrame(() => setShowScrollDown(!isNearBottom()));
      return;
    }

    const hasNewMessage = Boolean(latestMessageId) && latestMessageId !== lastMessageIdRef.current;
    if (hasNewMessage && listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
    lastMessageIdRef.current = latestMessageId;
    requestAnimationFrame(() => setShowScrollDown(!isNearBottom()));
  }, [groupMessages, selectedGroup, isNearBottom]);

  useEffect(() => {
    if (!focusedGroupMessageId) return;
    const target = messageRefs.current[focusedGroupMessageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedGroupMessageId, groupMessages]);

  useEffect(() => {
    if (!selectedGroupData?.joined) return;
    if (isMobile && mobileGroupPage !== "chat") return;
    const timer = setTimeout(() => chatInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [selectedGroupData?.id, selectedGroupData?.joined, groupReplyTo, isMobile, mobileGroupPage]);

  useEffect(() => {
    if (!isMobile) setShowMediaOptions(false);
  }, [isMobile, selectedGroup]);

  useEffect(() => {
    setShowGroupMembers(false);
  }, [selectedGroup, setShowGroupMembers]);

  const renderMembers = (allowActions = false) => (
    <div className="admin-box">
      {sortedMembers.map((m) => (
        <div key={m.uid} className="admin-member-row">
          <div className="member-main">
            <button type="button" className="profile-link-btn member-profile-link" onClick={() => onOpenProfile?.(m.uid)}>
              <img
                src={pickAvatar(m.photoURL, m.photoUrl)}
                alt={m.nickname}
                className="avatar-member"
                onError={handleAvatarError}
              />
              <div>
                <strong>{m.nickname}</strong>
              </div>
            </button>
            <div>
              {m.isAdmin && (
                <span className="admin-badge">
                  <FaCrown /> Admin
                </span>
              )}
            </div>
          </div>
          {allowActions && m.uid !== profile.uid && (
            <div className="actions-row">
              {!m.isAdmin && (
                <button type="button" onClick={() => promote(m.uid)}>
                  Promote
                </button>
              )}
              <button type="button" onClick={() => removeMember(m.uid)}>
                Remove
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <section className="groups-layout">
      {(!isMobile || mobileGroupPage === "list") && (
        <article className="panel groups-list-panel">
          <h3><FaUsers /> Groups</h3>
          <form onSubmit={createGroup} className="stack-form">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              minLength={3}
              required
            />
            <textarea
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="About this group"
              rows={3}
            />
            <button className="primary-btn group-create-btn" type="submit">
              Create
            </button>
          </form>
          <form onSubmit={joinByCode} className="row-form invite-form">
            <input
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="Invite code / link"
            />
            <button type="submit">Join</button>
          </form>
          <div className="group-list">
            {groups.map((g) => (
              <div key={g.id} className={`group-item ${selectedGroup === g.id ? "selected" : ""}`}>
                <div
                  onClick={() => {
                    setSelectedGroup(g.id);
                    if (isMobile) setMobileGroupPage("chat");
                  }}
                >
                  <strong>{g.name}</strong>
                  <p>{g.description}</p>
                  <small>
                    {g.membersCount} members {g.isAdmin ? "• admin" : ""}
                  </small>
                </div>
                <button type="button" onClick={() => joinOrLeave(g)}>
                  {g.joined ? "Leave" : "Join"}
                </button>
              </div>
            ))}
          </div>
        </article>
      )}

      {(!isMobile || mobileGroupPage === "chat") && (
        <article className="panel groups-chat-panel chat-panel">
          {isMobile && (
            <button type="button" className="back-btn" onClick={() => setMobileGroupPage("list")}>
              Back to groups
            </button>
          )}
          <h3><FaComments /> Group Chat</h3>
          {selectedGroupData ? (
            selectedGroupData.joined ? (
              <>
                {isMobile && (
                  <div className="group-members-toggle-row">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setShowGroupMembers((prev) => !prev)}
                    >
                      {showGroupMembers ? "Hide members" : "Show members"}
                    </button>
                  </div>
                )}
                {selectedGroupData.isAdmin && selectedGroupData.inviteLink && (
                  <div className="invite-link-row">
                    <span>{selectedGroupData.inviteLink}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(selectedGroupData.inviteLink)}
                    >
                      <FaCopy />
                    </button>
                  </div>
                )}
                {selectedGroupData.isAdmin && (
                  <div className="group-admin-tools">
                    <button type="button" onClick={clearGroupMessages} disabled={groupSettingsSaving}>
                      Clear messages
                    </button>
                    <label className="group-auto-delete-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedGroupData.autoDelete24h)}
                        disabled={groupSettingsSaving}
                        onChange={(e) => toggleGroupAutoDelete(e.target.checked)}
                      />
                      Auto-delete 24h
                    </label>
                  </div>
                )}
                {isMobile && showGroupMembers && (
                  <div className="mobile-group-members-panel">
                    {renderMembers(false)}
                  </div>
                )}
                <div className="messages-wrap">
                  <div ref={listRef} className="messages-box">
                    {groupMessagesLoading ? (
                      <div className="empty-messages"><div className="spinner" /></div>
                    ) : groupMessages.length ? (
                      groupMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`message-item ${m.senderUid === profile.uid ? "mine" : ""} ${
                            isReplyToMe(m) ? "is-reply-to-me" : ""
                          } ${focusedGroupMessageId === m.id ? "focus-message" : ""}`}
                          ref={(el) => {
                            if (el) messageRefs.current[m.id] = el;
                          }}
                        >
                          <button type="button" className="profile-link-btn" onClick={() => onOpenProfile?.(m.senderUid)}>
                            <img
                              src={pickAvatar(
                                m.senderPhotoURL,
                                m.senderPhotoUrl,
                                m.photoURL,
                                m.photoUrl,
                                memberByUid[m.senderUid]?.photoURL,
                                memberByUid[m.senderUid]?.photoUrl,
                              )}
                              alt={m.senderNickname}
                              className="avatar-msg"
                              onError={handleAvatarError}
                            />
                          </button>
                          <div className={`msg-bubble ${m.imageData || m.audioData || m.videoData ? "has-media" : ""}`}>
                            <button
                              type="button"
                              className="profile-link-btn msg-user-link"
                              onClick={() => onOpenProfile?.(m.senderUid)}
                            >
                              <strong style={{ color: usernameColor(m.senderUid, m.senderNickname) }}>
                                {m.senderNickname}
                              </strong>
                            </button>
                            {m.replyTo && (
                              <p className="reply-preview">
                                @{m.replyTo.senderNickname}: {m.replyTo.text}
                              </p>
                            )}
                            <p>{m.text}</p>
                            {m.imageData && (
                              <>
                                <img
                                  src={m.imageData}
                                  alt="Attachment"
                                  className="chat-media-image msg-media"
                                  onClick={() => setPreviewImage(m.imageData)}
                                />
                                <div className="media-actions">
                                  <a href={m.imageData} download={`image-${m.id || "group"}.png`} className="media-download">Download</a>
                                  <button type="button" className="media-open" onClick={() => setPreviewImage(m.imageData)}>Open</button>
                                </div>
                              </>
                            )}
                            {m.audioData && (
                              <div className="audio-wrap msg-media">
                                <ChatAudioPlayer src={m.audioData} />
                                <a href={m.audioData} download={`voice-${m.id || "group"}.webm`} className="media-download">Download</a>
                              </div>
                            )}
                            {m.videoData && (
                              <div className="video-wrap msg-media">
                                <VideoPlayer src={m.videoData} className="chat-media-video msg-media" />
                                <a href={m.videoData} download={`video-${m.id || "group"}.${extensionFromDataUrl(m.videoData, "mp4")}`} className="media-download">Download</a>
                              </div>
                            )}
                            <small className="msg-time">{timeAgo(m.createdAt)}</small>
                            {m.senderUid !== profile.uid && (
                              <button
                                type="button"
                                className="reply-btn"
                                onClick={() => setGroupReplyTo(m)}
                              >
                                <FaReply /> Reply
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="empty-messages">No group messages yet.</p>
                    )}
                  </div>
                  {showScrollDown && groupMessages.length > 0 && !groupMessagesLoading && (
                    <button
                      type="button"
                      className="scroll-bottom-btn"
                      onClick={() => {
                        scrollToBottom();
                        setShowScrollDown(false);
                      }}
                    >
                      <FaArrowDown /> Latest
                    </button>
                  )}
                </div>
                {groupReplyTo && (
                  <div className="replying-chip">
                    Replying to {groupReplyTo.senderNickname}
                    <button type="button" onClick={() => setGroupReplyTo(null)}>
                      <FaTimes />
                    </button>
                  </div>
                )}
                {(groupImageData || groupAudioData || groupVideoData) && (
                  <div className="attachment-preview-row">
                    {groupImageData && <img src={groupImageData} alt="Selected attachment" className="chat-media-image preview" />}
                    {groupAudioData && (
                      <ChatAudioPlayer src={groupAudioData} className="is-preview" />
                    )}
                    {groupVideoData && (
                      <VideoPlayer src={groupVideoData} className="chat-media-video preview" />
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        setGroupImageData("");
                        setGroupAudioData("");
                        setGroupVideoData("");
                      }}
                    >
                      <FaTimes />
                    </button>
                  </div>
                )}
                <form onSubmit={sendGroup} className="row-form chat-input-row">
                  <input
                    ref={chatInputRef}
                    value={groupDraft}
                    onChange={(e) => setGroupDraft(e.target.value)}
                    placeholder="Write to group"
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden-file-input"
                    onChange={(e) => toDataUrl(e.target.files?.[0], 1_000_000, (data) => {
                      setGroupImageData(data);
                      if (data) {
                        setGroupAudioData("");
                        setGroupVideoData("");
                      }
                    }, "Image")}
                  />
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden-file-input"
                    onChange={(e) => toDataUrl(e.target.files?.[0], 2_200_000, (data) => {
                      setGroupAudioData(data);
                      if (data) {
                        setGroupImageData("");
                        setGroupVideoData("");
                      }
                    }, "Audio")}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden-file-input"
                    onChange={(e) => toDataUrl(e.target.files?.[0], 4_500_000, (data) => {
                      setGroupVideoData(data);
                      if (data) {
                        setGroupImageData("");
                        setGroupAudioData("");
                      }
                    }, "Video")}
                  />
                  {isMobile ? (
                    <div className="mobile-media-wrap">
                      <button
                        type="button"
                        className={`icon-btn mobile-options-btn ${showMediaOptions ? "open" : ""}`}
                        onClick={() => setShowMediaOptions((prev) => !prev)}
                        title="More options"
                      >
                        <FaPlus />
                      </button>
                      {showMediaOptions && (
                        <div className="mobile-media-menu">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => {
                              imageInputRef.current?.click();
                              setShowMediaOptions(false);
                            }}
                            title="Send image"
                          >
                            <FaImage />
                          </button>
                          <button
                            type="button"
                            className={`icon-btn ${isRecording ? "recording" : ""}`}
                            onClick={() => {
                              if (isRecording) stopRecording();
                              else startRecording();
                              setShowMediaOptions(false);
                            }}
                            title={isRecording ? "Stop recording" : "Record voice message"}
                          >
                            {isRecording ? <FaStop /> : <FaMicrophone />}
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => {
                              audioInputRef.current?.click();
                              setShowMediaOptions(false);
                            }}
                            title="Upload audio file"
                          >
                            <FaFileAudio />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => {
                              videoInputRef.current?.click();
                              setShowMediaOptions(false);
                            }}
                            title="Upload video"
                          >
                            <FaVideo />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <button type="button" className="icon-btn" onClick={() => imageInputRef.current?.click()}>
                        <FaImage />
                      </button>
                      <button
                        type="button"
                        className={`icon-btn ${isRecording ? "recording" : ""}`}
                        onClick={isRecording ? stopRecording : startRecording}
                        title={isRecording ? "Stop recording" : "Record voice message"}
                      >
                        {isRecording ? <FaStop /> : <FaMicrophone />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => audioInputRef.current?.click()}
                        title="Upload audio file"
                      >
                        <FaFileAudio />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => videoInputRef.current?.click()}
                        title="Upload video"
                      >
                        <FaVideo />
                      </button>
                    </>
                  )}
                  <button type="submit" className="send-icon-btn" disabled={groupSending}>
                    {groupSending ? <span className="btn-spinner" /> : <FaPaperPlane />}
                  </button>
                </form>
                {isRecording && (
                  <div className="recording-chip">
                    <span className="record-dot" /> Recording {recordingSeconds}s
                    <button type="button" onClick={stopRecording} className="stop-recording-btn">
                      <FaStop /> Stop
                    </button>
                  </div>
                )}
                {previewImage && (
                  <div className="image-lightbox" onClick={() => setPreviewImage("")} role="presentation">
                    <div className="image-lightbox-inner" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="lightbox-close" onClick={() => setPreviewImage("")}>
                        <FaTimes />
                      </button>
                      <img src={previewImage} alt="Preview" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p>Join the group to see its messages.</p>
            )
          ) : (
            <p>Select a group.</p>
          )}
        </article>
      )}

      {!isMobile && (
        <article className="panel groups-members-panel">
          <h3><FaCrown /> Members</h3>
          {selectedGroupData?.joined ? (
            renderMembers(Boolean(selectedGroupData?.isAdmin))
          ) : (
            <p>Join the group to see members.</p>
          )}
        </article>
      )}
    </section>
  );
}
