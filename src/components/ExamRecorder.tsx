import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAntiCheat } from "@/lib/useAntiCheat";
import type { ExamSession, Alert, Question } from "@/lib/supabase";

type Phase = "loading" | "ready" | "recording" | "uploading" | "done" | "error";

interface Props { sessionId: string }

export default function ExamRecorder({ sessionId }: Props) {
  const { startMonitoring, stopMonitoring } = useAntiCheat();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [timeLeft, setTimeLeft] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase
        .from("exam_sessions")
        .select("*, question_banks(time_per_question)")
        .eq("id", sessionId)
        .single();
      if (!s) { setPhase("error"); return; }
      setSession(s as ExamSession);
      const tpq = (s as ExamSession & { question_banks?: { time_per_question: number } }).question_banks?.time_per_question ?? 20;
      setTimePerQuestion(tpq);
      await supabase.from("exam_sessions").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", sessionId);
      setPhase("ready");
    }
    load();
  }, [sessionId]);

  useEffect(() => {
    if (phase !== "ready" && phase !== "recording") return;
    if (cameraReady) return;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; await videoRef.current.play(); }
        setCameraReady(true);
      } catch { setPhase("error"); }
    }
    startCamera();
  }, [phase, cameraReady]);

  const finishExam = useCallback(async () => {
    setPhase("done");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await supabase.from("exam_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sessionId);
  }, [sessionId]);

  const uploadAndNext = useCallback(async (blob: Blob, idx: number, alerts: Alert[]) => {
    setPhase("uploading");
    const fileName = `${sessionId}/q${idx}.webm`;
    let videoUrl: string | null = null;
    const { error: upErr } = await supabase.storage.from("exam-videos").upload(fileName, blob, { contentType: "video/webm", upsert: true });
    if (!upErr) {
      const { data } = supabase.storage.from("exam-videos").getPublicUrl(fileName);
      videoUrl = data.publicUrl;
    }
    await supabase.from("answers").upsert({
      session_id: sessionId,
      question_index: idx,
      question_text: (session!.assigned_questions[idx] as Question).pregunta,
      video_url: videoUrl,
      alerts,
    });
    const next = idx + 1;
    if (next >= session!.assigned_questions.length) await finishExam();
    else { setCurrentIndex(next); setPhase("recording"); }
  }, [session, sessionId, finishExam]);

  const startRecording = useCallback((idx: number) => {
    if (!streamRef.current || !videoRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp8,opus" });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorderRef.current = recorder;
    recorder.start(500);
    startMonitoring((session!.assigned_questions[idx] as Question).pregunta, videoRef.current);
    setTimeLeft(timePerQuestion);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          recorder.stop();
          const alerts = stopMonitoring();
          recorder.onstop = () => {
            uploadAndNext(new Blob(chunksRef.current, { type: "video/webm" }), idx, alerts);
          };
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [session, timePerQuestion, startMonitoring, stopMonitoring, uploadAndNext]);

  useEffect(() => {
    if (phase === "recording" && cameraReady && session) startRecording(currentIndex);
  }, [phase, cameraReady, currentIndex, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentQ = session?.assigned_questions[currentIndex] as Question | undefined;
  const question = currentQ?.pregunta ?? "";
  const questionMeta = currentQ ? `${currentQ.categoria}${currentQ.patron ? ` · ${currentQ.patron}` : ""}` : "";
  const total = session?.assigned_questions.length ?? 5;
  const progress = Math.round(((timePerQuestion - timeLeft) / timePerQuestion) * 100);

  if (phase === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 text-sm">Cargando examen...</p>
    </div>
  );

  if (phase === "error") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-red-600 font-medium mb-2">Error al iniciar el examen</p>
        <p className="text-gray-500 text-sm">Verifica que el código sea correcto o que tu cámara esté disponible.</p>
      </div>
    </div>
  );

  if (phase === "done") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center max-w-sm">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Examen completado</h2>
        <p className="text-gray-500 text-sm">Tu examen fue grabado correctamente. Tu profesor lo revisará pronto.</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-white font-medium text-sm">Lección Oral</span>
        <span className="text-gray-400 text-sm">Pregunta {currentIndex + 1} de {total}</span>
      </div>

      <div className="flex flex-1 gap-6 p-6">
        <div className="flex-1 relative bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-400 text-sm">Iniciando cámara...</p>
            </div>
          )}
          {phase === "recording" && (
            <div className="absolute top-4 right-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${timeLeft <= 5 ? "bg-red-600 text-white" : "bg-black/60 text-white"}`}>
                {timeLeft}
              </div>
            </div>
          )}
          {phase === "recording" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        <div className="w-80 flex flex-col gap-4">
          <div className="bg-gray-800 rounded-xl p-5 flex-1">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1 font-medium">Pregunta {currentIndex + 1}</p>
            {questionMeta && (
              <p className="text-xs text-blue-400 mb-3">{questionMeta}</p>
            )}
            <p className="text-white text-lg leading-relaxed">{question}</p>
          </div>

          {phase === "ready" && cameraReady && (
            <button onClick={() => setPhase("recording")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors">
              Comenzar
            </button>
          )}
          {phase === "recording" && (
            <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-300 text-sm">Grabando respuesta...</span>
            </div>
          )}
          {phase === "uploading" && (
            <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-gray-300 text-sm">Guardando video...</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
