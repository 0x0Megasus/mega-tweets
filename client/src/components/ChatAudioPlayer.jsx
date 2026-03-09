import { useEffect, useRef, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa";

const formatTime = (value) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function ChatAudioPlayer({ src, className = "" }) {
  const audioRef = useRef(null);
  const frameRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      cancelAnimationFrame(frameRef.current);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(frameRef.current);
      return undefined;
    }
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrentTime(audio.currentTime || 0);
      if (!audio.paused && !audio.ended) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isPlaying]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(e.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={`chat-audio-player ${className}`.trim()}>
      <audio ref={audioRef} preload="metadata">
        <source src={src} />
      </audio>
      <button type="button" className="audio-play-btn" onClick={togglePlayback} aria-label={isPlaying ? "Pause voice message" : "Play voice message"}>
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        value={Math.min(currentTime, duration || 0)}
        step={0.01}
        className="audio-progress"
        onChange={handleSeek}
        style={{ "--progress": `${progress}%` }}
      />
      <small className="audio-time">{formatTime(currentTime)} / {formatTime(duration)}</small>
    </div>
  );
}
