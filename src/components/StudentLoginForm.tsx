import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function StudentLoginForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: bank, error: bankErr } = await supabase
      .from("question_banks")
      .select("*")
      .eq("id", bankCode.trim())
      .single();

    if (bankErr || !bank) {
      setError("Código de examen inválido. Consulta con tu profesor.");
      setLoading(false);
      return;
    }

    const questions: string[] = bank.questions;
    const assigned = [...questions].sort(() => Math.random() - 0.5).slice(0, Math.min(5, questions.length));

    const { data: session, error: sessionErr } = await supabase
      .from("exam_sessions")
      .insert({
        bank_id: bank.id,
        student_name: name.trim(),
        student_email: email.trim().toLowerCase(),
        assigned_questions: assigned,
        status: "pending",
      })
      .select()
      .single();

    if (sessionErr || !session) {
      setError("Error al iniciar el examen. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    window.location.href = `/exam/${session.id}`;
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Lección Oral</h1>
        <p className="text-sm text-gray-500 mb-8">Ingresa tus datos para comenzar</p>

        <form onSubmit={handleStart} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@universidad.edu.pe"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Código del examen</label>
            <input type="text" required value={bankCode} onChange={(e) => setBankCode(e.target.value)}
              placeholder="Código proporcionado por tu profesor"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? "Iniciando..." : "Comenzar examen"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          ¿Eres profesor?{" "}
          <a href="/teacher/login" className="text-blue-600 hover:underline">Accede aquí</a>
        </p>
      </div>
    </main>
  );
}
