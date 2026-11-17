# Contrato técnico: Plataforma de Lecciones Orales

**Curso:** Diseño de Patrones
**Versión:** 1.0
**Fecha:** 16/11/2026

---

## 1. Objetivo

Construir una página web donde los alumnos rinden una lección oral grabada (rostro y voz). Al terminar, el sistema guarda el video en Google Drive junto con un análisis en `.txt` que indica en qué segundos hubo conductas sospechosas y una nota aproximada. Un administrador monitorea todos los ingresos y envíos y gestiona el banco de preguntas.

El sistema **solo alerta**: no bloquea ni anula exámenes. La decisión final la toma el docente.

---

## 2. Requisitos acordados

| Tema | Decisión |
|---|---|
| Acceso del alumno | Ingresa nombre y correo (sin contraseña) |
| Datos guardados | Nombre y correo |
| Dispositivo | Solo PC |
| Preguntas por examen | 5, al azar, sin repetir, del banco de 100 |
| Tiempo por pregunta | 15 s de lectura en silencio + 20 s de respuesta |
| Duración total | 5 × 35 s = 175 s (unos 3 minutos) |
| Reintentos | No. Una vez iniciado, no hay vuelta atrás |
| Grabación | Video completo |
| Destino | Carpeta de Google Drive, una subcarpeta por alumno |
| Trampa | Leer la pregunta en voz alta y mirar hacia abajo |
| Acción ante trampa | Solo alerta en el análisis, sin avisar al alumno |
| Banco de preguntas | CSV, editable desde la vista de admin |

---

## 3. Flujo del alumno

```
1. Ingreso          Nombre + correo
       │
2. Permisos         Cámara y micrófono
       │
3. Chequeo facial   Detecta rostro, iluminación y encuadre.
                    Calibra la posición "mirando a la pantalla" (línea base)
       │
4. Aviso            "El examen empezará y no podrás volver atrás"
       │
5. [Empezar examen] Inicia la grabación (una sola, continua)
       │
6. Por cada pregunta (×5):
       ├─ 15 s  Lectura en silencio  (pregunta visible, contador)
       └─ 20 s  Respuesta oral       (pregunta visible, contador)
       │
7. Fin              Se detiene la grabación y se sube el video
       │
8. Confirmación     "Tu lección fue enviada"
```

**Reglas del flujo**
- Las fases avanzan solas por tiempo; el alumno no puede saltar ni retroceder.
- Si recarga o cierra la pestaña, la sesión queda como **Interrumpida** y no puede volver a empezar. Solo el admin puede habilitarle un nuevo intento.
- Un mismo correo no puede rendir dos veces, salvo que el admin lo habilite.

---

## 4. Vistas

### 4.1 Vista del alumno
- Formulario de ingreso
- Chequeo facial con vista previa de la cámara
- Pantalla de aviso y botón **Empezar examen**
- Pantalla de examen: pregunta, fase actual (Lectura / Respuesta), contador regresivo y progreso (Pregunta 2 de 5)
- Pantalla final de confirmación

### 4.2 Vista del administrador
Acceso protegido con usuario y contraseña (o login con Google).

**Panel de monitoreo**

| Columna | Descripción |
|---|---|
| Alumno | Nombre y correo |
| Ingreso | Fecha y hora en que entró |
| Estado | Ingresó / En examen / Enviado / Interrumpido / Error de subida |
| Alertas | Cantidad de eventos sospechosos |
| Nota aprox. | Sobre 20 |
| Drive | Enlace a la carpeta del alumno |

Con filtros por estado y fecha, contadores arriba (ingresos totales, enviados, interrumpidos, con alertas) y acción para **habilitar nuevo intento**.

**Banco de preguntas**
- Tabla con buscar, agregar, editar, desactivar y eliminar
- Importar CSV (reemplazar o agregar) y exportar CSV
- Validación del formato al importar

---

## 5. Banco de preguntas

Formato actual del CSV:

```csv
N°,Categoría,Patrón,Pregunta
1,Estructural,Adapter,¿Qué problema resuelve el patrón Adapter y en qué situaciones resulta conveniente utilizarlo?
```

Contenido actual: 100 preguntas en 3 categorías (Estructural, Comportamiento, Integración).

**Columnas opcionales recomendadas** (mejoran la nota automática):

| Columna | Uso |
|---|---|
| `puntos_clave` | Ideas que debe mencionar una buena respuesta, separadas por `;` |
| `activa` | `si` / `no`, para sacar preguntas sin borrarlas |

Si `puntos_clave` está vacío, el evaluador califica con su conocimiento general de patrones de diseño.

**Selección:** 5 preguntas al azar entre las activas. Opción configurable: forzar mezcla de categorías (por ejemplo, 2 estructurales, 2 de comportamiento y 1 de integración).

---

## 6. Análisis

El análisis se divide para que sea ligero: la detección facial ocurre **en el navegador del alumno durante el examen** (el servidor no procesa video) y el servidor solo procesa el **audio de los 5 tramos de respuesta** (unos 100 s en total).

### 6.1 Detección de "mirar hacia abajo" (navegador)
- **MediaPipe Face Landmarker** analiza la cámara en vivo (5 a 10 fps es suficiente).
- Se calcula el ángulo vertical de la cabeza (*pitch*) y la posición del iris respecto a la línea base del paso 3.
- **Alerta** si la mirada está por debajo del umbral durante más de 2 s seguidos.
- También se registra si no hay rostro o si hay más de uno.
- Cada evento se guarda con su segundo de inicio y fin relativo al inicio del video.

### 6.2 Detección de "leer la pregunta en voz alta"
Dos señales complementarias:

| Señal | Dónde | Cómo |
|---|---|---|
| Habla durante los 15 s de lectura | Navegador | Detector de voz (Web Audio API / VAD). La lectura debe ser en silencio, así que cualquier habla sostenida en esa fase es alerta |
| Respuesta que repite la pregunta | Servidor | Similitud entre la transcripción y el texto de la pregunta. Si es alta, alerta |

### 6.3 Transcripción y nota (servidor)
1. Con los tiempos de cada fase, se recortan los 5 tramos de respuesta del audio (`ffmpeg`).
2. Se transcribe cada tramo con **Whisper** en español.
3. Un **LLM como evaluador** recibe la pregunta, los puntos clave (si existen) y la transcripción, y devuelve JSON:
   ```json
   { "puntaje": 3, "max": 4, "justificacion": "Explica el propósito pero no da ejemplo." }
   ```
4. Nota final = suma de los 5 puntajes (4 puntos por pregunta, total sobre 20).

---

## 7. Salida en Google Drive

**Estructura**

```
Diseño de Patrones - Lecciones Orales/
└── Perez Juan - jperez@unsa.edu.pe - 2026-11-20 10-32/
    ├── video.webm
    └── analisis.txt
```

**Formato de `analisis.txt`**

```
LECCIÓN ORAL - DISEÑO DE PATRONES
Alumno:   Juan Pérez
Correo:   jperez@unsa.edu.pe
Fecha:    20/11/2026 10:32
Duración: 02:55

NOTA APROXIMADA: 14 / 20

DETALLE POR PREGUNTA
[P1] 00:00 - 00:35 | Adapter | 3/4
  Pregunta: ¿Qué problema resuelve el patrón Adapter...?
  Transcripción: "El adapter sirve para que dos clases con interfaces..."
  Comentario: Explica el propósito, falta un caso de uso.

[P2] 00:35 - 01:10 | Observer | 2/4
  ...

ALERTAS (3)
00:07 - 00:12  Habla durante la fase de lectura (P1)
01:22 - 01:26  Mirada hacia abajo (P3)
02:30 - 02:33  Rostro no detectado (P5)

NOTA: Las alertas y la nota son orientativas. Revisar el video antes de tomar decisiones.
```

Los segundos están referidos al inicio del video para poder saltar directo al momento.

---

## 8. Herramientas

| Componente | Herramienta | Por qué |
|---|---|---|
| Frontend | React + Vite | Simple, rápido de desarrollar |
| Grabación | MediaRecorder (navegador) | Nativo, genera `.webm` sin instalar nada |
| Detección facial | MediaPipe Face Landmarker (JS) | Corre en el navegador del alumno, sin costo de servidor |
| Detección de voz en lectura | Web Audio API + VAD | Ligero, en el navegador |
| Backend | FastAPI (Python) | API, subida de archivos y procesamiento |
| Base de datos | PostgreSQL (o SQLite para empezar) | Sesiones, eventos y banco de preguntas |
| Recorte de audio | ffmpeg | Extraer los 5 tramos de respuesta |
| Transcripción | Whisper vía API, o faster-whisper `small` local | API: más rápido y sin carga en el servidor. Local: gratis, unos segundos por tramo en CPU |
| Nota | LLM ligero vía API (Claude Haiku o similar) | Evalúa respuestas abiertas mejor que la similitud de texto |
| Similitud pregunta/respuesta | Embeddings multilingües (`paraphrase-multilingual-MiniLM`) | Liviano, corre en CPU |
| Almacenamiento final | Google Drive API | Requisito del cliente |
| Tareas en segundo plano | `BackgroundTasks` de FastAPI | Suficiente para este volumen; migrar a Celery si crece |
| Hosting | VPS de 2 vCPU y 4 GB de RAM | Alcanza usando la API para Whisper; con Whisper local, 4 vCPU y 8 GB |

**Nota sobre Google Drive:** las cuentas de servicio no tienen cuota propia de almacenamiento, así que no pueden subir archivos a un Drive personal. Hay dos opciones: usar una **Unidad compartida** (requiere Google Workspace) o autorizar con **OAuth la cuenta del docente** una sola vez y guardar el refresh token en el servidor.

---

## 9. Arquitectura

```
┌───────────────── Navegador del alumno ─────────────────┐
│  React                                                 │
│  ├─ MediaRecorder ──────── video.webm ───────────┐     │
│  ├─ MediaPipe ─── eventos de mirada/rostro ──┐   │     │
│  └─ VAD ──────── habla en fase de lectura ───┤   │     │
└──────────────────────────────────────────────┼───┼─────┘
                                               ▼   ▼
┌──────────────────────── Servidor ──────────────────────┐
│  FastAPI                                               │
│  ├─ PostgreSQL: sesiones, eventos, preguntas           │
│  └─ Tarea en segundo plano:                            │
│       ffmpeg → Whisper → LLM evaluador → analisis.txt  │
│                                    │                   │
└────────────────────────────────────┼───────────────────┘
                                     ▼
                          Google Drive (video + txt)
                                     ▲
                          Vista admin (monitoreo)
```

---

## 10. Modelo de datos

| Tabla | Campos principales |
|---|---|
| `preguntas` | id, numero, categoria, patron, pregunta, puntos_clave, activa |
| `sesiones` | id, nombre, correo, estado, inicio, fin, nota, n_alertas, drive_url, intento |
| `sesion_preguntas` | sesion_id, pregunta_id, orden, inicio_seg, fin_seg, transcripcion, puntaje, justificacion |
| `eventos` | sesion_id, tipo, inicio_seg, fin_seg, pregunta_orden |
| `admins` | id, usuario, hash_contraseña |

---

## 11. Requisitos no funcionales

- **Navegadores:** Chrome y Edge actualizados en PC.
- **Video:** 480p, unos 10 MB por alumno.
- **Tiempo de procesamiento:** el análisis debe estar en Drive en menos de 2 minutos tras el envío.
- **Robustez:** si falla la subida, se reintenta automáticamente y el admin ve el estado **Error de subida**.
- **Privacidad:** texto de consentimiento antes del chequeo facial, indicando que se graba rostro y voz y que el video se guarda en Drive del curso.
- **Seguridad:** vista de admin protegida; las credenciales de Drive y de las APIs solo en el servidor.

---

## 12. Fuera de alcance (versión 1)

- Uso desde celular
- Login con contraseña o verificación de identidad del alumno
- Avisos al alumno durante el examen
- Bloqueo o anulación automática por trampa
- Detección de otras voces (diarización)

---

## 13. Riesgos y supuestos

| Riesgo | Mitigación |
|---|---|
| Cualquiera puede escribir el correo de otro alumno | Opcional: código de 6 dígitos enviado al correo antes de empezar |
| Falsos positivos de "mirar abajo" (pensar, lentes, cámara baja) | Calibración inicial, umbral de 2 s y revisión humana |
| 20 s es poco para preguntas de diseño o integración | Considerar más tiempo para la categoría Integración |
| La nota automática puede equivocarse | Se presenta como aproximada; el docente decide |
| Cuota o permisos de Drive | Usar OAuth del docente o Unidad compartida (ver sección 8) |

---

## 14. Entregables y criterios de aceptación

| # | Entregable | Criterio de aceptación |
|---|---|---|
| 1 | Flujo del alumno completo | Rinde 5 preguntas con 15 s + 20 s cada una, sin poder retroceder |
| 2 | Grabación y subida | El video completo aparece en su carpeta de Drive con el nombre correcto |
| 3 | Detección facial | Mirar hacia abajo más de 2 s genera una alerta con el segundo correcto |
| 4 | Detección de lectura en voz alta | Hablar en la fase de lectura genera una alerta con el segundo correcto |
| 5 | Nota aproximada | `analisis.txt` incluye transcripción, puntaje por pregunta y nota sobre 20 |
| 6 | Panel de admin | Muestra todos los ingresos con estado, alertas, nota y enlace a Drive |
| 7 | Gestión del banco | El admin puede importar, editar, desactivar y exportar preguntas |

---

## 15. Fases sugeridas

1. Banco de preguntas y vista de admin (CRUD + importar CSV)
2. Flujo del alumno con temporizadores y grabación
3. Subida a Google Drive
4. MediaPipe y VAD en el navegador (eventos)
5. Transcripción, evaluación y generación de `analisis.txt`
6. Panel de monitoreo y pruebas con alumnos reales
