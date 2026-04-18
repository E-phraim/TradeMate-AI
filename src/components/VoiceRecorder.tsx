import { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone not supported on this browser/environment.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported MIME type
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/wav'].find(type => 
        MediaRecorder.isTypeSupported(type)
      ) || '';
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (audioBlob.size > 0) {
          onRecordingComplete(audioBlob);
        } else {
          console.error("Recording failed: Empty blob");
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${
        isRecording 
          ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-200" 
          : "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
      } disabled:opacity-50`}
    >
      {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
      {isRecording && (
        <motion.div
          layoutId="recording-indicator"
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white"
        />
      )}
    </button>
  );
}
