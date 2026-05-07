import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
];

function getRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionFromMime(type) {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('mpeg')) return 'mp3';
  return 'webm';
}

export default function VoiceNoteRecorder({ C, disabled, onTranscribed, transcribeAudio, floating = false }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [bars, setBars] = useState(Array.from({ length: 18 }, () => 0.18));
  const [audioUrl, setAudioUrl] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setPlaying] = useState(false);

  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioRef = useRef(null);
  const nativePlayerRef = useRef(null);
  const nativePlayerSubRef = useRef(null);
  const urlRef = useRef('');
  const cancelRef = useRef(false);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.cancelAnimationFrame?.(rafRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close?.();
    if (urlRef.current && typeof URL !== 'undefined') URL.revokeObjectURL(urlRef.current);
    urlRef.current = '';
    nativePlayerSubRef.current?.remove?.();
    nativePlayerSubRef.current = null;
    nativePlayerRef.current?.remove?.();
    nativePlayerRef.current = null;
  }

  function resetPreview() {
    if (urlRef.current && typeof URL !== 'undefined') URL.revokeObjectURL(urlRef.current);
    urlRef.current = '';
    audioRef.current?.pause?.();
    audioRef.current = null;
    nativePlayerSubRef.current?.remove?.();
    nativePlayerSubRef.current = null;
    nativePlayerRef.current?.remove?.();
    nativePlayerRef.current = null;
    setAudioUrl('');
    setAudioBlob(null);
    setPlaying(false);
    setDuration(0);
    setBars(Array.from({ length: 18 }, () => 0.18));
  }

  function updateWaveform() {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const nextBars = Array.from({ length: 18 }, (_, index) => {
      const start = Math.floor(index * data.length / 18);
      const slice = data.slice(start, start + Math.floor(data.length / 18));
      const avg = slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
      return Math.max(0.12, Math.min(1, avg / 170));
    });

    setBars(nextBars);
    rafRef.current = window.requestAnimationFrame(updateWaveform);
  }

  async function startRecording() {
    if (disabled || state === 'recording') return;

    resetPreview();
    setError('');

    if (Platform.OS !== 'web') {
      await startNativeRecording();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice notes are not supported by this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        updateWaveform();
      }

      chunksRef.current = [];
      cancelRef.current = false;
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (cancelRef.current) {
          stream.getTracks().forEach(track => track.stop());
          audioContextRef.current?.close?.();
          window.cancelAnimationFrame?.(rafRef.current);
          return;
        }
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        const nextAudioUrl = URL.createObjectURL(blob);
        urlRef.current = nextAudioUrl;
        setAudioUrl(nextAudioUrl);
        setState('preview');
        stream.getTracks().forEach(track => track.stop());
        audioContextRef.current?.close?.();
        window.cancelAnimationFrame?.(rafRef.current);
      };

      recorder.start();
      setState('recording');
      timerRef.current = setInterval(() => setDuration(value => value + 1), 1000);
    } catch (err) {
      setError(err?.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access and try again.'
        : 'Could not start the microphone. Please try again.');
      setState('idle');
    }
  }

  async function startNativeRecording() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission was denied. Allow microphone access and try again.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldDuckAndroid: true,
      });

      const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await recording.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

      recorderRef.current = recording;
      recording.record();
      setState('recording');
      timerRef.current = setInterval(() => {
        const status = recording.getStatus();
        const seconds = Math.max(0, Math.floor((status.durationMillis || 0) / 1000));
        const meter = typeof status.metering === 'number'
          ? Math.max(0.12, Math.min(1, (status.metering + 60) / 60))
          : 0.25 + Math.random() * 0.55;
        setDuration(seconds);
        setBars(prev => [...prev.slice(1), meter]);
      }, 120);
    } catch (err) {
      console.error('Native recording error:', err);
      setError('Could not start the microphone. Please try again.');
      setState('idle');
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current);
    if (Platform.OS !== 'web') {
      const recording = recorderRef.current;
      if (!recording) return;

      try {
        await recording.stop();
        await setAudioModeAsync({ allowsRecording: false });
        const uri = recording.uri || recording.getStatus?.()?.url;
        if (!uri) throw new Error('Recording file was not created');
        setAudioBlob({
          uri,
          name: 'voice-note.m4a',
          type: Platform.OS === 'android' ? 'audio/mp4' : 'audio/m4a',
        });
        setAudioUrl(uri);
        setState('preview');
      } catch (err) {
        console.error('Stop recording error:', err);
        setError('Could not save the recording. Please try again.');
        setState('idle');
      }
      return;
    }

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  function cancelRecording() {
    cancelRef.current = true;
    if (Platform.OS === 'web' && recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (Platform.OS !== 'web') {
      recorderRef.current?.stop?.().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
    cleanup();
    resetPreview();
    setState('idle');
    setError('');
  }

  async function togglePlayback() {
    if (!audioUrl) return;
    if (Platform.OS !== 'web') {
      if (isPlaying) {
        nativePlayerRef.current?.pause?.();
        setPlaying(false);
        return;
      }

      if (!nativePlayerRef.current) {
        const player = createAudioPlayer({ uri: audioUrl }, { updateInterval: 250 });
        nativePlayerRef.current = player;
        nativePlayerSubRef.current = player.addListener?.('playbackStatusUpdate', status => {
          if (status.didJustFinish) setPlaying(false);
        });
      }

      await nativePlayerRef.current.seekTo?.(0);
      nativePlayerRef.current.play();
      setPlaying(true);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new window.Audio(audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  async function sendVoiceNote() {
    if (!audioBlob || !transcribeAudio || !onTranscribed) return;
    setState('processing');
    setError('');

    try {
      const type = audioBlob.type || 'audio/webm';
      const transcript = await transcribeAudio({
        blob: audioBlob,
        name: audioBlob.name || `voice-note.${extensionFromMime(type)}`,
        type,
      });
      resetPreview();
      setState('idle');
      await onTranscribed(transcript);
    } catch (err) {
      setError(err?.message || 'Transcription failed. Please try again.');
      setState('preview');
    }
  }

  if (state === 'idle') {
    return (
      <View style={styles.compactWrap}>
        <Pressable
          onPress={startRecording}
          disabled={disabled}
          style={({ pressed }) => [styles.iconBtn, disabled && styles.disabled, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Record voice note"
        >
          <Ionicons name="mic-outline" size={22} color={C.mutedForeground} />
        </Pressable>
        {!!error && <Text style={[styles.inlineError, { color: C.destructive }]}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.panel, floating && styles.floatingPanel, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.panelTop}>
        <Pressable onPress={cancelRecording} style={styles.smallBtn} accessibilityLabel="Cancel voice note">
          <Ionicons name="close" size={18} color={C.mutedForeground} />
        </Pressable>

        <View style={styles.waveRow}>
          {bars.map((height, index) => (
            <View
              key={index}
              style={[
                styles.waveBar,
                {
                  height: 8 + height * 24,
                  backgroundColor: state === 'recording' ? C.accent : C.mutedForeground,
                  opacity: state === 'recording' ? 1 : 0.45,
                },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.timer, { color: C.textSecondary }]}>{duration}s</Text>
      </View>

      <View style={styles.actionsRow}>
        {state === 'recording' && (
          <Pressable onPress={stopRecording} style={[styles.primaryBtn, { backgroundColor: C.destructive }]}>
            <Ionicons name="stop" size={16} color="#fff" />
            <Text style={styles.primaryText}>Stop</Text>
          </Pressable>
        )}

        {state === 'preview' && (
          <>
            <Pressable onPress={togglePlayback} style={[styles.secondaryBtn, { borderColor: C.border }]}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={C.tint} />
              <Text style={[styles.secondaryText, { color: C.tint }]}>{isPlaying ? 'Pause' : 'Play'}</Text>
            </Pressable>
            <Pressable onPress={startRecording} style={[styles.secondaryBtn, { borderColor: C.border }]}>
              <Ionicons name="refresh" size={16} color={C.tint} />
              <Text style={[styles.secondaryText, { color: C.tint }]}>Re-record</Text>
            </Pressable>
            <Pressable onPress={sendVoiceNote} style={[styles.primaryBtn, { backgroundColor: C.tint }]}>
              <Ionicons name="send" size={16} color={C.primaryForeground} />
              <Text style={[styles.primaryText, { color: C.primaryForeground }]}>Send</Text>
            </Pressable>
          </>
        )}

        {state === 'processing' && (
          <View style={styles.processingRow}>
            <ActivityIndicator color={C.accent} size="small" />
            <Text style={[styles.secondaryText, { color: C.textSecondary }]}>Transcribing...</Text>
          </View>
        )}
      </View>

      {!!error && <Text style={[styles.errorText, { color: C.destructive }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  compactWrap: { alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  inlineError: { position: 'absolute', bottom: 42, width: 220, fontSize: 11, textAlign: 'center' },
  panel: { borderWidth: 1, borderRadius: 16, padding: 10, marginHorizontal: 16, marginBottom: 8, gap: 8 },
  floatingPanel: { position: 'absolute', left: 0, right: 0, bottom: 48, marginHorizontal: 0, zIndex: 20 },
  panelTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  waveRow: { flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  waveBar: { width: 3, borderRadius: 2 },
  timer: { width: 34, fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  primaryBtn: { minHeight: 34, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  primaryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { minHeight: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  secondaryText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  processingRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
