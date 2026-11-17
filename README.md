# Plataforma de Lecciones Orales

Plataforma web para aplicar y calificar exámenes orales con grabación de video, detección de comportamiento sospechoso y revisión por parte del profesor.

---

## Características

- **Alumno**: ingresa nombre, correo y código de examen. Responde 5 preguntas al azar frente a la cámara, con un countdown configurable por pregunta.
- **Grabación**: video completo por pregunta, almacenado en Supabase Storage.
- **Antiplagio pasivo**: detecta en el navegador (sin costo) si el alumno mira hacia abajo o lee la pregunta en voz alta. Las alertas se registran con marca de tiempo.
- **Profesor**: sube un banco de preguntas en CSV, comparte un código a sus alumnos, y luego revisa los videos con las alertas destacadas para calificar de 0 a 20.
- **Concurrencia**: múltiples alumnos pueden rendir el mismo examen al mismo tiempo.

---

## Stack tecnológico

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Framework | **Astro 5** | Mínimo JS por defecto; los componentes interactivos se cargan como islands |
| UI interactiva | **React 18** | Islands con `client:load` para las partes con estado |
| Estilos | **Tailwind CSS v3** | Utility-first, sin CSS personalizado |
| Base de datos | **Supabase** (PostgreSQL) | Free tier generoso, RLS incorporado, fácil de configurar |
| Almacenamiento | **Supabase Storage** | 1 GB gratis, suficiente para cursos pequeños |
| Autenticación | **Supabase Auth** | Email + contraseña para profesores; alumnos son anónimos |
| Antiplagio (gaze) | **MediaPipe Face Mesh** | Corre en el browser, costo $0 |
| Antiplagio (voz) | **Web Speech API** | Nativa del navegador, costo $0 |
| Deploy | **Vercel / Netlify** | Free tier para apps con SSR |

**Costo estimado para un curso de 30 alumnos: $0**
- 5 preguntas × 20 s × 30 alumnos ≈ 300 MB de video → dentro del free tier de Supabase.
- Toda la IA corre en el navegador del alumno.

---

## Requisitos previos

- Node.js 20+
- Cuenta gratuita en [supabase.com](https://supabase.com)

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd oral-exam

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase
```

### Variables de entorno

```env
PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

> En Astro, las variables públicas (accesibles desde el browser) llevan el prefijo `PUBLIC_`.

---

## Configuración de Supabase

1. Crear un proyecto nuevo en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar el contenido de `supabase/schema.sql`
3. En **Storage**, verificar que el bucket `exam-videos` fue creado por el script
4. En **Authentication → Providers**, asegurarse de que Email esté habilitado
5. Copiar la **Project URL** y la **anon key** desde **Settings → API** al archivo `.env`

---

## Desarrollo local

```bash
npm run dev
# Abre http://localhost:4321
```

## Producción (Node.js standalone)

```bash
npm run build
node ./dist/server/entry.mjs
```

## Deploy en Vercel

```bash
# Cambiar el adapter en astro.config.mjs:
# import vercel from "@astrojs/vercel/serverless";
# adapter: vercel()

npm install @astrojs/vercel
vercel deploy
```

---

## Cómo usar la plataforma

### Flujo del Profesor

```
1. Ir a /teacher/login → registrarse o iniciar sesión
2. En el dashboard → "Nuevo banco"
3. Subir un archivo CSV con las preguntas (una por fila)
4. Configurar el tiempo por pregunta (default: 20 segundos)
5. Guardar → aparece el UUID del banco (código del examen)
6. Compartir ese código con los alumnos
7. Cuando los alumnos terminen → aparecen en el dashboard
8. Clic en un alumno → revisar videos + alertas → calificar 0-20 por pregunta
```

### Flujo del Alumno

```
1. Ir a / (página de inicio)
2. Ingresar nombre, correo y código del examen
3. Permitir acceso a cámara y micrófono
4. Clic en "Comenzar"
5. Se muestran 5 preguntas al azar, una por vez
6. Para cada pregunta: countdown + grabación automática
7. Al terminar → pantalla de confirmación
```

### Formato del CSV

```csv
pregunta
¿Qué es la fotosíntesis?
¿Cuántos cromosomas tiene el ser humano?
¿Cuál es la función del sistema nervioso central?
Explica el ciclo del agua
¿Qué es la mitosis?
```

La primera fila puede ser encabezado (`pregunta`) o directamente una pregunta. El banco debe tener al menos 5 preguntas.

---

## Estructura del proyecto

```
oral-exam/
├── src/
│   ├── layouts/
│   │   └── Layout.astro          # HTML base con Tailwind
│   ├── pages/                    # Enrutamiento (Astro file-based routing)
│   │   ├── index.astro           # Login alumno
│   │   ├── exam/
│   │   │   └── [sessionId].astro # Examen en curso (SSR dinámico)
│   │   └── teacher/
│   │       ├── login.astro
│   │       ├── dashboard.astro
│   │       ├── upload.astro
│   │       └── review/
│   │           └── [sessionId].astro  # Revisión y calificación
│   ├── components/               # React islands (client:load)
│   │   ├── StudentLoginForm.tsx  # Formulario de entrada del alumno
│   │   ├── ExamRecorder.tsx      # Grabador + countdown + antiplagio
│   │   ├── TeacherLoginForm.tsx  # Auth del profesor
│   │   ├── TeacherDashboard.tsx  # Lista de bancos y sesiones
│   │   ├── UploadBank.tsx        # Subida de CSV
│   │   └── ReviewSession.tsx     # Reproductor de videos + calificación
│   ├── lib/
│   │   ├── supabase.ts           # Cliente Supabase + tipos
│   │   └── useAntiCheat.ts       # Hook React: MediaPipe + Web Speech API
│   └── styles/
│       └── global.css            # @tailwind base/components/utilities
├── supabase/
│   └── schema.sql                # Tablas, RLS y bucket de storage
├── astro.config.mjs
├── tailwind.config.mjs
├── postcss.config.mjs
├── tsconfig.json
└── .env                          # Variables de entorno (no commitear)
```

---

## Esquema de base de datos

```
question_banks
  id               UUID (PK)
  teacher_id       UUID (ref. auth.users)
  name             TEXT
  time_per_question INTEGER (segundos)
  questions        JSONB  → string[]
  created_at       TIMESTAMPTZ

exam_sessions
  id               UUID (PK)
  bank_id          UUID (ref. question_banks)
  student_name     TEXT
  student_email    TEXT
  assigned_questions JSONB  → string[] (5 preguntas sorteadas)
  status           TEXT    → 'pending' | 'in_progress' | 'completed'
  started_at       TIMESTAMPTZ
  completed_at     TIMESTAMPTZ

answers
  id               UUID (PK)
  session_id       UUID (ref. exam_sessions)
  question_index   INTEGER
  question_text    TEXT
  video_url        TEXT    → URL en Supabase Storage
  alerts           JSONB   → Alert[]
  score            INTEGER (0–20, puesto por el profesor)
  teacher_notes    TEXT
```

---

## Sistema antiplagio

El sistema detecta dos comportamientos sospechosos **en el navegador del alumno**, sin enviar datos a ningún servidor externo:

### 1. Detección de mirada hacia abajo (MediaPipe Face Mesh)

- Carga el modelo Face Mesh de MediaPipe desde CDN al iniciar el examen.
- Analiza cada frame de la cámara y extrae landmarks faciales.
- Calcula el ratio entre la posición de la nariz, la frente y el mentón.
- Si la cabeza está inclinada hacia abajo **más de 2 segundos seguidos**, registra una alerta con marca de tiempo.

### 2. Detección de lectura en voz alta (Web Speech API)

- Activa el reconocimiento de voz en español (`es-PE`) durante la grabación.
- Transcribe lo que dice el alumno en tiempo real.
- Calcula la similitud entre la transcripción y el texto de la pregunta (coeficiente Dice sobre bigramas).
- Si la similitud supera el 40%, registra una alerta de posible lectura.

### Comportamiento

- El alumno **no es notificado** sobre las alertas (según requisitos).
- El examen **no se detiene** por las alertas.
- El profesor ve las alertas con marca de tiempo junto al video para decidir.

---

## Decisiones de arquitectura

### ¿Por qué Astro en lugar de Next.js?

| | Astro | Next.js |
|--|-------|---------|
| JS enviado al cliente | Solo los islands interactivos | Todo el bundle de React |
| Simplicidad | Páginas .astro son HTML + frontmatter | Todo es componente React |
| Compatibilidad | React, Vue, Svelte, etc. | Solo React |
| Deploy estático | Sí (con output: static) | Requiere servidor |

Para este proyecto, la mayor parte de las páginas son conchas HTML simples; solo el grabador y el revisor necesitan React pesado. Astro envía menos JavaScript al cliente.

### ¿Por qué Supabase en lugar de Firebase?

- PostgreSQL con SQL estándar, más predecible que Firestore.
- RLS (Row Level Security) maneja los permisos directamente en la DB.
- El free tier incluye autenticación, base de datos y storage sin costo adicional.

### ¿Por qué no usar Whisper de OpenAI para la transcripción?

La Web Speech API es suficiente para detectar si el alumno está leyendo la pregunta. Whisper costaría ~$0.006/min; para 150 clips de 20 s = $0.30 por clase, lo que se acumula. La API del browser es $0 y funciona offline.

---

## Licencia

MIT
