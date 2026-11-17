import { createClient } from "@supabase/supabase-js";

// En Astro las variables públicas usan el prefijo PUBLIC_
export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL as string,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string
);

export type Question = {
  numero: number;
  categoria: string;
  patron: string;
  pregunta: string;
  puntos_clave?: string;
  activa?: boolean;
};

export type QuestionBank = {
  id: string;
  teacher_id: string;
  name: string;
  time_per_question: number;
  questions: Question[];
  created_at: string;
};

export type ExamSession = {
  id: string;
  bank_id: string;
  student_name: string;
  student_email: string;
  assigned_questions: Question[];
  status: "pending" | "in_progress" | "completed";
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type Answer = {
  id: string;
  session_id: string;
  question_index: number;
  question_text: string;
  video_url: string | null;
  alerts: Alert[];
  score: number | null;
  teacher_notes: string | null;
  created_at: string;
};

export type Alert = {
  type: "gaze_down" | "reading_aloud";
  timestamp: number;
  details: string;
};
