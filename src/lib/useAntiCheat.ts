import { useRef, useCallback } from "react";
import type { Alert } from "./supabase";

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
interface ISpeechRecognitionEvent {
  results: { [i: number]: { [i: number]: { transcript: string } }; length: number };
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-záéíóúñ\s]/g, "");
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const bg = new Map<string, number>();
  for (let i = 0; i < na.length - 1; i++) {
    const k = na.substring(i, i + 2);
    bg.set(k, (bg.get(k) || 0) + 1);
  }
  let hit = 0;
  for (let i = 0; i < nb.length - 1; i++) {
    const k = nb.substring(i, i + 2);
    const c = bg.get(k) || 0;
    if (c > 0) { hit++; bg.set(k, c - 1); }
  }
  return (2 * hit) / (na.length + nb.length - 2);
}

export function useAntiCheat() {
  const alertsRef = useRef<Alert[]>([]);
  const recRef = useRef<ISpeechRecognition | null>(null);
  const faceRef = useRef<unknown>(null);
  const t0Ref = useRef<number>(0);

  const push = useCallback((a: Alert) => {
    alertsRef.current = [...alertsRef.current, a];
  }, []);

  const startSpeech = useCallback((questionText: string) => {
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const API = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!API) return;
    const rec = new API();
    rec.lang = "es-PE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(" ");
      const sim = similarity(text, questionText);
      if (sim > 0.4) {
        push({ type: "reading_aloud", timestamp: Date.now() - t0Ref.current, details: `Posible lectura en voz alta (${Math.round(sim * 100)}%)` });
        rec.stop();
      }
    };
    rec.onerror = () => {};
    rec.start();
    recRef.current = rec;
  }, [push]);

  const startGaze = useCallback(async (video: HTMLVideoElement) => {
    try {
      const [{ FaceMesh }, { Camera }] = await Promise.all([
        import("@mediapipe/face_mesh" as never) as Promise<{ FaceMesh: new (o: unknown) => { setOptions(o: unknown): void; onResults(cb: unknown): void; send(d: unknown): Promise<void>; close(): void } }>,
        import("@mediapipe/camera_utils" as never) as Promise<{ Camera: new (v: HTMLVideoElement, o: unknown) => { start(): void; stop(): void } }>,
      ]);
      let downSince: number | null = null;
      const THRESHOLD = 2000;
      const mesh = new FaceMesh({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
      mesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      mesh.onResults((r: { multiFaceLandmarks?: Array<Array<{ x: number; y: number; z: number }>> }) => {
        if (!r.multiFaceLandmarks?.length) return;
        const lm = r.multiFaceLandmarks[0];
        const ratio = (lm[1].y - lm[10].y) / Math.abs(lm[10].y - lm[152].y);
        if (ratio > 0.6) {
          if (!downSince) downSince = Date.now();
          else if (Date.now() - downSince > THRESHOLD) {
            push({ type: "gaze_down", timestamp: Date.now() - t0Ref.current, details: "Miró hacia abajo más de 2 segundos" });
            downSince = null;
          }
        } else { downSince = null; }
      });
      const cam = new Camera(video, { onFrame: async () => mesh.send({ image: video }), width: 640, height: 480 });
      cam.start();
      faceRef.current = { mesh, cam };
    } catch { /* MediaPipe no disponible, el examen continúa */ }
  }, [push]);

  const startMonitoring = useCallback((questionText: string, video: HTMLVideoElement) => {
    alertsRef.current = [];
    t0Ref.current = Date.now();
    startSpeech(questionText);
    startGaze(video);
  }, [startSpeech, startGaze]);

  const stopMonitoring = useCallback((): Alert[] => {
    recRef.current?.stop();
    recRef.current = null;
    const f = faceRef.current as { cam?: { stop(): void }; mesh?: { close(): void } } | null;
    f?.cam?.stop();
    f?.mesh?.close();
    faceRef.current = null;
    return alertsRef.current;
  }, []);

  return { startMonitoring, stopMonitoring };
}
