import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaArrowDown,
  FaComments,
  FaFileAudio,
  FaImage,
  FaMicrophone,
  FaPaperPlane,
  FaReply,
  FaStop,
  FaUserCircle,
  FaTimes,
} from "react-icons/fa";

const FALLBACK_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#575b66"/><circle cx="32" cy="24" r="12" fill="#cfd2d8"/><rect x="16" y="40" width="32" height="16" rx="8" fill="#cfd2d8"/></svg>',
)}`;

const pickAvatar = (...values) => values.find((value) => typeof value === "string" && value.trim()) || FALLBACK_AVATAR;
const handleAvatarError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.src = FALLBACK_AVATAR;
};

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

export default function DmView({
  isMobile,
  mobileDmPage,
  setMobileDmPage,
  others,
  dmTargetUid,
  setDmTargetUid,
  setDmReplyTo,
  dmMessages,
  dmMessagesLoading,
  profile,
  timeAgo,
  dmReplyTo,
  setDmDraft,
  dmDraft,
  sendDm,
  dmSending,
  dmImageData,
  setDmImageData,
  dmAudioData,
  setDmAudioData,
}) {
  const listRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const profileByUid = Object.fromEntries(
    [profile, ...others].filter(Boolean).map((user) => [user.uid, user]),
  );
  const lastMessageIdRef = useRef("");
  const lastTargetRef = useRef("");
  const [showScrollDown, setShowScrollDown] = useState(false);
  const usernameColor = useCallback((uid = "", nickname = "") => {
    const key = `${uid || ""}:${nickname || ""}`;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % NAME_COLORS.length;
    return NAME_COLORS[index];
  }, []);

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
  }, [handleListScroll, dmTargetUid]);

  useEffect(() => {
    const latestMessageId = dmMessages[dmMessages.length - 1]?.id || "";
    const changedTarget = lastTargetRef.current !== dmTargetUid;

    if (changedTarget) {
      lastTargetRef.current = dmTargetUid;
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
  }, [dmMessages, dmTargetUid, isNearBottom]);

  const isReplyToMe = (m) => m.senderUid !== profile.uid && m.replyTo?.senderUid === profile.uid;
  const toDataUrl = (file, maxBytes, onDone) => {
    if (!file) return;
    if (file.size > maxBytes) return;
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
    } catch {
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
          setDmAudioData(data);
          if (data) setDmImageData("");
        });
        resetRecorder();
      };
      recorder.start();
      setDmAudioData("");
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      window.alert("Unable to start recording. Please check microphone permissions.");
      resetRecorder();
    }
  };

  useEffect(() => () => resetRecorder(), []);

  return (
    <section className="grid-two dm-layout">
      {(!isMobile || mobileDmPage === "list") && (
        <article className="panel">
          <h3><FaUserCircle /> Users</h3>
          <div className="user-list dm-user-list">
            {others.map((u) => (
              <button
                type="button"
                key={u.uid}
                className={`user-item dm-user-item ${dmTargetUid === u.uid ? "selected" : ""}`}
                onClick={() => {
                  setDmTargetUid(u.uid);
                  setDmReplyTo(null);
                  if (isMobile) setMobileDmPage("chat");
                }}
              >
                <img
                  src={pickAvatar(u.photoURL, u.photoUrl)}
                  alt={u.nickname}
                  className="avatar"
                  onError={handleAvatarError}
                />
                <span style={{ color: usernameColor(u.uid, u.nickname) }}>{u.nickname}</span>
              </button>
            ))}
          </div>
        </article>
      )}

      {(!isMobile || mobileDmPage === "chat") && (
        <article className="panel chat-panel">
          {isMobile && (
            <button type="button" className="back-btn" onClick={() => setMobileDmPage("list")}>
              Back to users
            </button>
          )}
          <h3><FaComments /> Direct</h3>
          {dmTargetUid ? (
            <>
              <div className="messages-wrap">
                <div ref={listRef} className="messages-box">
                  {dmMessagesLoading ? (
                    <div className="empty-messages"><div className="spinner" /></div>
                  ) : dmMessages.length ? (
                    dmMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`message-item ${m.senderUid === profile.uid ? "mine" : ""} ${
                          isReplyToMe(m) ? "is-reply-to-me" : ""
                        }`}
                      >
                        <img
                          src={pickAvatar(
                            m.senderPhotoURL,
                            m.senderPhotoUrl,
                            m.photoURL,
                            m.photoUrl,
                            profileByUid[m.senderUid]?.photoURL,
                            profileByUid[m.senderUid]?.photoUrl,
                          )}
                          alt={m.senderNickname}
                          className="avatar-msg"
                          onError={handleAvatarError}
                        />
                        <div className="msg-bubble">
                          <strong style={{ color: usernameColor(m.senderUid, m.senderNickname) }}>
                            {m.senderNickname}
                          </strong>
                          {m.replyTo && (
                            <p className="reply-preview">
                              @{m.replyTo.senderNickname}: {m.replyTo.text}
                            </p>
                          )}
                          <p>{m.text}</p>
                          {m.imageData && <img src={m.imageData} alt="Attachment" className="chat-media-image" />}
                          {m.audioData && (
                            <audio controls className="chat-media-audio">
                              <source src={m.audioData} />
                            </audio>
                          )}
                          <small className="msg-time">{timeAgo(m.createdAt)}</small>
                          {m.senderUid !== profile.uid && (
                            <button
                              type="button"
                              className="reply-btn"
                              onClick={() => setDmReplyTo(m)}
                            >
                              <FaReply /> Reply
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-messages">No messages yet.</p>
                  )}
                </div>
                {showScrollDown && dmMessages.length > 0 && !dmMessagesLoading && (
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
              {dmReplyTo && (
                <div className="replying-chip">
                  Replying to {dmReplyTo.senderNickname}
                  <button type="button" onClick={() => setDmReplyTo(null)}>
                    <FaTimes />
                  </button>
                </div>
              )}
              {(dmImageData || dmAudioData) && (
                <div className="attachment-preview-row">
                  {dmImageData && <img src={dmImageData} alt="Selected attachment" className="chat-media-image preview" />}
                  {dmAudioData && (
                    <audio controls className="chat-media-audio">
                      <source src={dmAudioData} />
                    </audio>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setDmImageData("");
                      setDmAudioData("");
                    }}
                  >
                    <FaTimes />
                  </button>
                </div>
              )}
              <form onSubmit={sendDm} className="row-form chat-input-row">
                <input
                  value={dmDraft}
                  onChange={(e) => setDmDraft(e.target.value)}
                  placeholder="Write DM"
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden-file-input"
                  onChange={(e) => toDataUrl(e.target.files?.[0], 1_000_000, (data) => {
                    setDmImageData(data);
                    if (data) setDmAudioData("");
                  })}
                />
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden-file-input"
                  onChange={(e) => toDataUrl(e.target.files?.[0], 2_200_000, (data) => {
                    setDmAudioData(data);
                    if (data) setDmImageData("");
                  })}
                />
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
                <button type="submit" className="send-icon-btn" disabled={dmSending}>
                  {dmSending ? <span className="btn-spinner" /> : <FaPaperPlane />}
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
            </>
          ) : (
            <p>Select a user.</p>
          )}
        </article>
      )}
    </section>
  );
}
