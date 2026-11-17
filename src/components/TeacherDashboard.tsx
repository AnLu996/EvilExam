import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { QuestionBank, ExamSession } from "@/lib/supabase";

type BankWithSessions = QuestionBank & { exam_sessions: ExamSession[] };

export default function TeacherDashboard() {
  const [banks, setBanks] = useState<BankWithSessions[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/teacher/login"; return; }

      const { data } = await supabase
        .from("question_banks")
        .select("*, exam_sessions(*)")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      setBanks((data as BankWithSessions[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/teacher/login";
  }

  function copyCode(id: string) {
    navigator.clipboard.writeText(id);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Mis exámenes</h1>
        <div className="flex gap-3">
          <button onClick={() => { window.location.href = "/teacher/upload"; }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            + Nuevo banco
          </button>
          <button onClick={handleLogout} className="text-gray-500 text-sm hover:text-gray-800">
            Salir
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {banks.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No tienes bancos de preguntas aún.</p>
            <button onClick={() => { window.location.href = "/teacher/upload"; }}
              className="text-blue-600 text-sm mt-2 hover:underline">
              Crear el primero
            </button>
          </div>
        )}

        {banks.map((bank) => {
          const completed = bank.exam_sessions.filter((s) => s.status === "completed").length;
          const inProgress = bank.exam_sessions.filter((s) => s.status === "in_progress").length;

          return (
            <div key={bank.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-medium text-gray-900">{bank.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {bank.questions.length} preguntas · {bank.time_per_question}s por pregunta
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  {inProgress > 0 && (
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                      {inProgress} en curso
                    </span>
                  )}
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {completed} completados
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-mono truncate">{bank.id}</span>
                <button onClick={() => copyCode(bank.id)}
                  className="text-xs text-blue-600 hover:underline ml-2 shrink-0">
                  Copiar código
                </button>
              </div>

              {bank.exam_sessions.filter((s) => s.status === "completed").map((s) => (
                <button key={s.id}
                  onClick={() => { window.location.href = `/teacher/review/${s.id}`; }}
                  className="w-full flex items-center justify-between text-sm bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors mb-1.5">
                  <span className="font-medium text-gray-800">{s.student_name}</span>
                  <span className="text-gray-400 text-xs">{s.student_email}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </main>
  );
}
