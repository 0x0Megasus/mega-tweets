import { useEffect, useRef, useState } from "react";
import { FaExpand, FaPause, FaPlay, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

const formatTime = (value) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function VideoPlayer({ src, className = "", poster = "" }) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onLoadedMetadata = () => setDuration(video.duration || 0);
    const onTimeUpdate = () => setCurrentTime(video.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(video.duration || 0);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.pause();
      cancelAnimationFrame(frameRef.current);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [src]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(frameRef.current);
      return undefined;
    }
    const tick = () => {
      const video = videoRef.current;
      if (!video) return;
      setCurrentTime(video.currentTime || 0);
      if (!video.paused && !video.ended) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isPlaying]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await video.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Number(e.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setIsMuted(next);
  };

  const toggleFullscreen = () => {
    const node = wrapperRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      node.requestFullscreen?.();
    }
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={`video-player ${className}`.trim()} ref={wrapperRef}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="video-player__video"
        preload="metadata"
        onClick={togglePlayback}
      />
      <div className={`video-player__controls ${isPlaying ? "is-playing" : ""}`}>
        <button
          type="button"
          className="video-player__btn"
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pause video" : "Play video"}
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={Math.min(currentTime, duration || 0)}
          step={0.01}
          className="video-player__progress"
          onChange={handleSeek}
          style={{ "--progress": `${progress}%` }}
        />
        <small className="video-player__time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </small>
        <button
          type="button"
          className="video-player__btn ghost"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
        >
          {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
        </button>
        <button
          type="button"
          className="video-player__btn ghost"
          onClick={toggleFullscreen}
          aria-label="Fullscreen"
        >
          <FaExpand />
        </button>
      </div>
    </div>
  );
}
