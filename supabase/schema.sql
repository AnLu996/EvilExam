create extension if not exists "uuid-ossp";

create table question_banks (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  time_per_question integer not null default 20,
  questions jsonb not null default '[]',
  created_at timestamptz default now()
);

create table exam_sessions (
  id uuid primary key default uuid_generate_v4(),
  bank_id uuid references question_banks(id) on delete cascade not null,
  student_name text not null,
  student_email text not null,
  assigned_questions jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table answers (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references exam_sessions(id) on delete cascade not null,
  question_index integer not null,
  question_text text not null,
  video_url text,
  alerts jsonb not null default '[]',
  score integer check (score >= 0 and score <= 20),
  teacher_notes text,
  created_at timestamptz default now()
);

alter table question_banks enable row level security;
alter table exam_sessions enable row level security;
alter table answers enable row level security;

-- Profesor solo ve sus propios bancos
create policy "profesor_owns_banks" on question_banks
  for all using (auth.uid() = teacher_id);

-- Alumno puede crear sesiones (anónimo)
create policy "alumno_insert_session" on exam_sessions
  for insert with check (true);

-- Alumno puede actualizar su propia sesión
create policy "alumno_update_session" on exam_sessions
  for update using (true);

-- Profesor ve sesiones de sus bancos
create policy "profesor_reads_sessions" on exam_sessions
  for select using (
    exists (select 1 from question_banks qb where qb.id = exam_sessions.bank_id and qb.teacher_id = auth.uid())
  );

-- Alumno puede insertar/actualizar respuestas
create policy "alumno_insert_answers" on answers for insert with check (true);
create policy "alumno_update_answers" on answers for update using (true);

-- Profesor puede leer y actualizar respuestas de sus sesiones
create policy "profesor_manages_answers" on answers
  for all using (
    exists (
      select 1 from exam_sessions es
      join question_banks qb on qb.id = es.bank_id
      where es.id = answers.session_id and qb.teacher_id = auth.uid()
    )
  );

-- Storage bucket para videos
insert into storage.buckets (id, name, public) values ('exam-videos', 'exam-videos', false)
  on conflict do nothing;

create policy "upload_exam_video" on storage.objects
  for insert with check (bucket_id = 'exam-videos');

create policy "profesor_reads_videos" on storage.objects
  for select using (bucket_id = 'exam-videos' and auth.role() = 'authenticated');
