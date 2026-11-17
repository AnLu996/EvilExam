import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ExamSession, Answer, Alert } from "@/lib/supabase";

interface Props { sessionId: string }

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function AlertBadge({ alert }: { alert: Alert }) {
  const isRead = alert.type === "reading_aloud";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isRead ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
      {isRead ? "⚠ Posible lectura" : "👁 Miró hacia abajo"} · {fmt(alert.timestamp)}
    </span>
  );
}

export default function ReviewSession({ sessionId }: Props) {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/teacher/login"; return; }
      const [{ data: s }, { data: a }] = await Promise.all([
        supabase.from("exam_sessions").select("*").eq("id", sessionId).single(),
        supabase.from("answers").select("*").eq("session_id", sessionId).order("question_index"),
      ]);
      setSession(s);
      setAnswers(a ?? []);
      setLoading(false);
    }
    load();
  }, [sessionId]);

  async function patch(id: string, data: Partial<Answer>) {
    setSaving(id);
    await supabase.from("answers").update(data).eq("id", id);
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, ...data } : a)));
    setSaving(null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm">Cargando revisión...</p>
    </div>
  );

  const totalScore = answers.reduce((s, a) => s + (a.score ?? 0), 0);
  const graded = answers.filter((a) => a.score !== null).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <button onClick={() => { window.location.href = "/teacher/dashboard"; }}
            className="text-sm text-gray-500 hover:text-gray-800 mb-1 flex items-center gap-1">
            ← Dashboard
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{session?.student_name}</h1>
          <p className="text-sm text-gray-400">{session?.student_email}</p>
        </div>
        {graded === answers.length && answers.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Puntaje total</p>
            <p className="text-2xl font-bold text-gray-900">
              {totalScore} <span className="text-sm font-normal text-gray-400">/ {answers.length * 20}</span>
            </p>
          </div>
        )}
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {answers.map((ans, i) => (
          <div key={ans.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Pregunta {i + 1}</p>
              <p className="text-gray-900 font-medium">{ans.question_text}</p>
            </div>

            <div className="px-5 py-4">
              {ans.video_url ? (
                <video src={ans.video_url} controls className="w-full rounded-lg bg-black aspect-video" />
              ) : (
                <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400 text-sm">Video no disponible</p>
                </div>
              )}
            </div>

            {ans.alerts.length > 0 && (
              <div className="px-5 pb-4 flex flex-wrap gap-2">
                {ans.alerts.map((a, j) => <AlertBadge key={j} alert={a} />)}
              </div>
            )}

            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas del profesor</label>
                <textarea rows={2} value={ans.teacher_notes ?? ""}
                  onChange={(e) => setAnswers((prev) => prev.map((a) => a.id === ans.id ? { ...a, teacher_notes: e.target.value } : a))}
                  onBlur={(e) => patch(ans.id, { teacher_notes: e.target.value })}
                  placeholder="Observaciones..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nota (0–20)</label>
                <input type="number" min={0} max={20} value={ans.score ?? ""}
                  onChange={(e) => setAnswers((prev) => prev.map((a) => a.id === ans.id ? { ...a, score: e.target.value === "" ? null : Number(e.target.value) } : a))}
                  onBlur={(e) => patch(ans.id, { score: e.target.value === "" ? null : Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {saving === ans.id && <span className="text-xs text-gray-400 pb-2">Guardando...</span>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
