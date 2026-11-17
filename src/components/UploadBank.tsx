import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Question } from "@/lib/supabase";
import Papa from "papaparse";

// Detecta si el CSV tiene el formato enriquecido (N°,Categoría,Patrón,Pregunta)
// o el formato simple (una sola columna de preguntas)
function parseQuestions(rows: Record<string, string>[]): Question[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
  const hasEnrichedFormat = headers.includes("pregunta") || headers.includes("pregunta");

  if (hasEnrichedFormat) {
    // Formato enriquecido: N°,Categoría,Patrón,Pregunta[,puntos_clave,activa]
    return rows
      .map((row, i) => {
        const pregunta = (row["Pregunta"] ?? row["pregunta"] ?? "").trim();
        if (!pregunta) return null;
        const activa = row["activa"] !== undefined
          ? row["activa"].trim().toLowerCase() !== "no"
          : true;
        return {
          numero: parseInt(row["N°"] ?? row["n°"] ?? row["numero"] ?? String(i + 1), 10) || i + 1,
          categoria: (row["Categoría"] ?? row["categoría"] ?? row["categoria"] ?? "General").trim(),
          patron: (row["Patrón"] ?? row["patrón"] ?? row["patron"] ?? "").trim(),
          pregunta,
          puntos_clave: (row["puntos_clave"] ?? "").trim() || undefined,
          activa,
        } satisfies Question;
      })
      .filter((q): q is NonNullable<typeof q> => q !== null && q.activa !== false)
      .map((q) => q as Question);
  } else {
    // Formato simple: primera columna es la pregunta
    return rows
      .map((row, i) => {
        const vals = Object.values(row);
        const pregunta = vals[0]?.toString().trim() ?? "";
        if (!pregunta) return null;
        return { numero: i + 1, categoria: "General", patron: "", pregunta, activa: true };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .map((q) => q as Question);
  }
}

export default function UploadBank() {
  const [name, setName] = useState("");
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = parseQuestions(result.data);
        setQuestions(parsed);
        if (parsed.length === 0) setError("No se encontraron preguntas válidas en el archivo.");
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (questions.length < 5) { setError("El banco debe tener al menos 5 preguntas."); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/teacher/login"; return; }

    const { error: err } = await supabase.from("question_banks").insert({
      teacher_id: user.id,
      name: name.trim(),
      time_per_question: timePerQuestion,
      questions,
    });

    if (err) { setError("Error al guardar. Intenta de nuevo."); setLoading(false); return; }
    window.location.href = "/teacher/dashboard";
  }

  // Agrupar por categoría para la vista previa
  const byCategory = questions.reduce<Record<string, number>>((acc, q) => {
    acc[q.categoria] = (acc[q.categoria] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-lg mx-auto">
        <button onClick={() => history.back()} className="text-sm text-gray-500 hover:text-gray-800 mb-6 flex items-center gap-1">
          ← Volver
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">Nuevo banco de preguntas</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del examen</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Lección Oral - Patrones de Diseño"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tiempo de respuesta por pregunta (segundos)</label>
              <input type="number" required min={5} max={300} value={timePerQuestion}
                onChange={(e) => setTimePerQuestion(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Banco de preguntas (CSV)</label>
              <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-8 cursor-pointer hover:border-blue-400 transition-colors">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-500">{fileName || "Arrastra o haz clic para subir"}</span>
                <span className="text-xs text-gray-400 mt-1">Formato simple o enriquecido (ver abajo)</span>
                <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>

              {questions.length > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-green-600">{questions.length} preguntas cargadas</p>
                  <div className="flex gap-2">
                    {Object.entries(byCategory).map(([cat, count]) => (
                      <span key={cat} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {cat}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {questions.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-2 font-medium">Vista previa</p>
                {questions.slice(0, 10).map((q, i) => (
                  <div key={i} className="py-1 border-b border-gray-100 last:border-0">
                    <p className="text-xs text-gray-700">{q.numero}. {q.pregunta}</p>
                    {q.patron && (
                      <p className="text-xs text-gray-400 mt-0.5">{q.categoria} · {q.patron}</p>
                    )}
                  </div>
                ))}
                {questions.length > 10 && (
                  <p className="text-xs text-gray-400 mt-2">... y {questions.length - 10} más</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading || questions.length === 0}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? "Guardando..." : "Guardar banco"}
            </button>
          </form>
        </div>

        <div className="mt-4 bg-blue-50 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-blue-800 mb-1">Formato enriquecido (recomendado)</p>
            <p className="text-xs text-blue-600 font-mono">N°,Categoría,Patrón,Pregunta,puntos_clave,activa</p>
            <p className="text-xs text-blue-600 font-mono">1,Estructural,Adapter,¿Qué problema resuelve...?,idea1;idea2,si</p>
          </div>
          <div>
            <p className="text-xs font-medium text-blue-800 mb-1">Formato simple</p>
            <p className="text-xs text-blue-600 font-mono">pregunta</p>
            <p className="text-xs text-blue-600 font-mono">¿Qué es el patrón Adapter?</p>
          </div>
          <p className="text-xs text-blue-500">La columna <code>activa</code> permite desactivar preguntas sin borrarlas (valor <code>no</code>).</p>
        </div>
      </div>
    </main>
  );
}
