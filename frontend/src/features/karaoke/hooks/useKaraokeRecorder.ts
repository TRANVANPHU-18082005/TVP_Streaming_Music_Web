import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

interface UseKaraokeRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  recordingTime: number;
  micLevel: number;
  micReady: boolean;
  monitorVolume: number;
  setMonitorVolume: (volume: number) => void;
  enableMic: () => Promise<boolean>;
  disableMic: () => void;
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
  error: string | null;
}

export const useKaraokeRecorder = (): UseKaraokeRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [micReady, setMicReady] = useState(false);
  const [monitorVolume, setMonitorVolumeState] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const monitorVolumeRef = useRef(60);
  const takeIdRef = useRef(0);

  const stopTimer = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    timerIntervalRef.current = window.setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopMeter = () => {
    if (meterRafRef.current !== null) {
      window.cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setMicLevel(0);
  };

  const revokeUrl = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const disconnectGraph = () => {
    stopMeter();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    sourceRef.current = null;
    gainRef.current = null;
    analyserRef.current = null;
  };

  const stopStream = () => {
    disconnectGraph();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setMicReady(false);
  };

  const startMeter = (analyser: AnalyserNode) => {
    stopMeter();
    const samples = new Uint8Array(analyser.fftSize);
    let lastPublish = 0;

    const tick = (now: number) => {
      analyser.getByteTimeDomainData(samples);
      if (now - lastPublish > 80) {
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.min(1, Math.sqrt(sum / samples.length) * 3.2);
        setMicLevel((prev) => (Math.abs(prev - rms) < 0.02 ? prev : rms));
        lastPublish = now;
      }
      meterRafRef.current = window.requestAnimationFrame(tick);
    };

    meterRafRef.current = window.requestAnimationFrame(tick);
  };

  const attachMonitor = (stream: MediaStream) => {
    const Ctx = window.AudioContext;
    if (!Ctx) return;

    const ctx = audioContextRef.current ?? new Ctx();
    audioContextRef.current = ctx;
    void ctx.resume();

    disconnectGraph();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const gain = ctx.createGain();
    gain.gain.value = monitorVolumeRef.current / 100;
    source.connect(analyser);
    source.connect(gain);
    gain.connect(ctx.destination);
    sourceRef.current = source;
    analyserRef.current = analyser;
    gainRef.current = gain;
    startMeter(analyser);
  };

  const actionsRef = useRef({
    attachMonitor,
    stopStream,
    startTimer,
    stopTimer,
    revokeUrl,
  });
  actionsRef.current = {
    attachMonitor,
    stopStream,
    startTimer,
    stopTimer,
    revokeUrl,
  };

  const openStream = useCallback(async () => {
    const live = streamRef.current?.getAudioTracks().some((track) => track.readyState === "live");
    if (live && streamRef.current) return streamRef.current;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      const message = "Trình duyệt không hỗ trợ ghi âm.";
      setError(message);
      toast.error(message);
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      streamRef.current = stream;
      actionsRef.current.attachMonitor(stream);
      setMicReady(true);
      setError(null);
      return stream;
    } catch (err) {
      console.error("Lỗi Microphone:", err);
      const message = "Không thể truy cập Microphone. Vui lòng cấp quyền.";
      setError(message);
      setMicReady(false);
      toast.error(message);
      return null;
    }
  }, [actionsRef]);

  const enableMic = useCallback(async () => {
    const stream = await openStream();
    return Boolean(stream);
  }, [openStream]);

  const disableMic = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    actionsRef.current.stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    actionsRef.current.stopStream();
  }, [actionsRef]);

  const setMonitorVolume = useCallback((volume: number) => {
    const next = Math.min(100, Math.max(0, volume));
    monitorVolumeRef.current = next;
    setMonitorVolumeState(next);
    if (gainRef.current) gainRef.current.gain.value = next / 100;
  }, []);

  const startRecording = useCallback(async () => {
    const stream = await openStream();
    if (!stream) return false;

    actionsRef.current.revokeUrl();
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];
    const takeId = takeIdRef.current + 1;
    takeIdRef.current = takeId;

    const mimeType = "audio/webm;codecs=opus";
    const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined;
    const mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const stale = takeId !== takeIdRef.current;
      const recorderNow = mediaRecorderRef.current;
      const newerTakeActive = recorderNow !== null
        && recorderNow !== mediaRecorder
        && recorderNow.state !== "inactive";

      if (!stale) {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioBlob(blob);
        setAudioUrl(url);
      }

      if (!newerTakeActive) actionsRef.current.stopStream();
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(200);
    setIsRecording(true);
    setIsPaused(false);
    setRecordingTime(0);
    actionsRef.current.startTimer();
    return true;
  }, [openStream, actionsRef]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setIsRecording(false);
    setIsPaused(false);
    actionsRef.current.stopTimer();
  }, [actionsRef]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    setIsPaused(true);
    actionsRef.current.stopTimer();
  }, [actionsRef]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    setIsPaused(false);
    actionsRef.current.startTimer();
  }, [actionsRef]);

  const clearRecording = useCallback(() => {
    takeIdRef.current += 1;
    actionsRef.current.revokeUrl();
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setError(null);
  }, [actionsRef]);

  useEffect(() => {
    return () => {
      actionsRef.current.stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      actionsRef.current.stopStream();
      actionsRef.current.revokeUrl();
      void audioContextRef.current?.close();
    };
  }, [actionsRef]);

  return {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    recordingTime,
    micLevel,
    micReady,
    monitorVolume,
    setMonitorVolume,
    enableMic,
    disableMic,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    error,
  };
};
