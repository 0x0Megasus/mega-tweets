import { useEffect, useRef, useState } from "react";
import { FaFileAudio, FaImage, FaMicrophone, FaPlus, FaStop, FaTimes, FaVideo } from "react-icons/fa";
import ChatAudioPlayer from "./ChatAudioPlayer";
import VideoPlayer from "./VideoPlayer";

export default function PublishTweetModal({
  isOpen,
  onClose,
  postContent,
  setPostContent,
  postImageData,
  setPostImageData,
  postAudioData,
  setPostAudioData,
  postVideoData,
  setPostVideoData,
  postTweet,
}) {
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

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
    if (!navigator?.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const data = typeof reader.result === "string" ? reader.result : "";
          setPostAudioData(data);
          if (data) {
            setPostImageData("");
            setPostVideoData("");
          }
        };
        reader.readAsDataURL(blob);
        resetRecorder();
      };
      recorder.start();
      setPostAudioData("");
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-publish" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><FaPlus /> Publish Tweet</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={postTweet} className="stack-form modal-form">
          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="What's happening?"
            rows={8}
          />
          {(postImageData || postAudioData || postVideoData) && (
            <div className="attachment-preview-row">
              {postImageData && <img src={postImageData} alt="Selected media" className="chat-media-image preview" />}
              {postAudioData && <ChatAudioPlayer src={postAudioData} className="is-preview" />}
              {postVideoData && <VideoPlayer src={postVideoData} className="chat-media-video preview" />}
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setPostImageData("");
                  setPostAudioData("");
                  setPostVideoData("");
                }}
              >
                <FaTimes />
              </button>
            </div>
          )}
          <div className="modal-media-row">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden-file-input"
              onChange={(e) => toDataUrl(e.target.files?.[0], 1_000_000, (data) => {
                setPostImageData(data);
                if (data) {
                  setPostAudioData("");
                  setPostVideoData("");
                }
              }, "Image")}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden-file-input"
              onChange={(e) => toDataUrl(e.target.files?.[0], 2_200_000, (data) => {
                setPostAudioData(data);
                if (data) {
                  setPostImageData("");
                  setPostVideoData("");
                }
              }, "Audio")}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden-file-input"
              onChange={(e) => toDataUrl(e.target.files?.[0], 4_500_000, (data) => {
                setPostVideoData(data);
                if (data) {
                  setPostImageData("");
                  setPostAudioData("");
                }
              }, "Video")}
            />
            <button type="button" className="icon-btn" onClick={() => imageInputRef.current?.click()}>
              <FaImage />
            </button>
            <button
              type="button"
              className={`icon-btn ${isRecording ? "recording" : ""}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? <FaStop /> : <FaMicrophone />}
            </button>
            <button type="button" className="icon-btn" onClick={() => audioInputRef.current?.click()}>
              <FaFileAudio />
            </button>
            <button type="button" className="icon-btn" onClick={() => videoInputRef.current?.click()} title="Upload video">
              <FaVideo />
            </button>
            {isRecording && <small>Recording {recordingSeconds}s</small>}
          </div>
          <div className="modal-actions">
            <button className="primary-btn" type="submit">Post Tweet</button>
            <button className="secondary-btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
