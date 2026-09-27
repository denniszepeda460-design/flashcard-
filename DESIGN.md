# DESIGN.md — Flashcard App Personal ("Anki, pero mejor")

> **Versión:** 1.0 — 2026-09-26  
> **Autor:** Antigravity (arquitecto automático)

---

## 1. Exploración de `anki_core` — Hallazgos clave

### 1.1 Estado del repositorio local

El repositorio en `Logica/anki_core` es un **sparse checkout** del monorepo oficial
`ankitects/anki` (commit `1f7c8d7`). Solo están presentes en disco:

- Archivos raíz (Cargo.toml, CLAUDE.md, justfile, etc.)
- `rslib/src/` — archivos fuente de nivel raíz
- `rslib/src/card/`, `rslib/src/revlog/`, `rslib/src/scheduler/`

**No** están en disco: `pylib/`, `qt/`, `ts/`, `ftl/`, `rslib/sync/`, `build/`, `docs/`.
Estos directorios existen en el repo completo pero fueron excluidos del sparse checkout.

### 1.2 AGENTS.md / CLAUDE.md

`AGENTS.md` simplemente apunta a `CLAUDE.md`, que documenta:
- La arquitectura multicapa: Rust core (`rslib`) → Python bridge (`pylib/rsbridge` via PyO3) → Python package (`pylib/anki`) → GUI (`aqt`)
- Sistema de build vía `justfile` + `ninja`
- Protobuf como IPC entre capas
- Internacionalización via Fluent (`.ftl`)

### 1.3 FSRS — Integración

El scheduler FSRS está integrado en `rslib/src/scheduler/fsrs/`:
- Usa el crate externo `fsrs = "6.6.2"` (`open-spaced-repetition/fsrs-rs`)
- Módulos clave: `params.rs` (optimización de parámetros), `memory_state.rs` (estado D/S/R), `rescheduler.rs` (recálculo masivo)
- El Card struct tiene campos nativos: `memory_state { stability, difficulty }`, `desired_retention`, `decay`
- El scheduler se invoca en `answering/mod.rs`: carga parámetros FSRS del deck config, instancia `FSRS::new(params)`, llama `fsrs.next_states()` para cada calificación (Again=1, Hard=2, Good=3, Easy=4)

### 1.4 Servidor de sincronización autoalojado

Existe como:
1. **Crate Rust independiente** en `rslib/sync/` → binario `anki-sync-server`
2. **Módulo Python** → `python -m anki.syncserver` (viene incluido en el paquete `pip install anki`)
3. **Flag del ejecutable desktop** → `anki --syncserver`

Configuración vía variables de entorno:
- `SYNC_USER1=usuario:contraseña` (agregar `SYNC_USER2`, etc. para más usuarios)
- `SYNC_BASE=/ruta/datos` (directorio de almacenamiento, default `~/.syncserver`)
- `SYNC_HOST=0.0.0.0` (interfaz de red)
- `SYNC_PORT=8080` (puerto)

---

## 2. Decisión: pip vs. compilar desde fuente

### ✅ Decisión: Usar `pip install anki` (paquete PyPI)

**Razones:**
1. El paquete v26.9.3 incluye el backend Rust precompilado como wheel `cp310-abi3-win_amd64.whl` (9.5 MB). No requiere Rust toolchain.
2. Funciona con Python 3.10–3.13 (64-bit). El sistema del usuario tiene Python 3.13.3 ✓.
3. Incluye `anki.syncserver` listo para usar.
4. Incluye el scheduler FSRS v6.6.2 ya integrado.
5. Incluye toda la API de `Collection` para manejo programático de la BD.

**Cuándo recompilar desde fuente sería necesario:**
- Si necesitáramos modificar el núcleo Rust (scheduler, sync protocol, schema). **No es nuestro caso**: reutilizamos la lógica tal cual.

**Trade-off documentado:**
- Dependemos de las versiones publicadas en PyPI. Si necesitamos un bugfix que no está publicado, tendríamos que compilar. Esto es aceptable para un proyecto personal.

---

## 3. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│              NAVEGADOR (PWA React + TypeScript)              │
│                                                              │
│  ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌─────────────┐ │
│  │ Estudiar │ │  Explorar  │ │  Crear /  │ │ Estadísticas│ │
│  │ (Review) │ │ (Browser)  │ │  Editar   │ │  / Stats    │ │
│  └──────────┘ └────────────┘ └───────────┘ └─────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │         IndexedDB (cache offline + cola pendiente)       ││
│  └──────────────────────────────────────────────────────────┘│
│              ↕ HTTP REST/WS ↕                                │
└──────────────────────────────────────────────────────────────┘
                         │
                    Red local (LAN)
                         │
┌──────────────────────────────────────────────────────────────┐
│              SERVIDOR (máquina principal)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          FastAPI + Uvicorn (:8000)                      │  │
│  │                                                        │  │
│  │  /api/decks     → col.decks.*                         │  │
│  │  /api/notes     → col.add_note(), col.update_note()   │  │
│  │  /api/cards     → col.find_cards(), col.get_card()    │  │
│  │  /api/review    → col.sched.get_queued_cards(),       │  │
│  │                    col.sched.answer_card()             │  │
│  │  /api/notetypes → col.models.*                        │  │
│  │  /api/sync      → trigger manual sync                 │  │
│  │  /api/stats     → estadísticas de repaso              │  │
│  │  /ws/review     → WebSocket para sesión de repaso     │  │
│  │                                                        │  │
│  │  Middleware: API key vía header X-API-Key              │  │
│  └───────────────────────┬────────────────────────────────┘  │
│                          │                                    │
│  ┌───────────────────────▼────────────────────────────────┐  │
│  │       anki.Collection (SQLite: collection.anki2)       │  │
│  │       + FSRS Scheduler (rslib via PyO3)                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │     anki.syncserver (:8080)                            │  │
│  │     Servidor de sync autoalojado                       │  │
│  │     Compatible con Anki Desktop / AnkiDroid            │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Dos servidores, un script de inicio

El sistema corre dos procesos independientes en la misma máquina:

| Servicio | Puerto | Propósito |
|----------|--------|-----------|
| **FastAPI** (nuestra API) | 8000 | API REST para el frontend PWA |
| **anki.syncserver** | 8080 | Protocolo de sync nativo de Anki (para AnkiDroid, Anki Desktop u otros clientes) |

Ambos comparten el mismo directorio de datos (`SYNC_BASE`), pero **no** la misma instancia de `Collection` simultáneamente — FastAPI abre la colección directamente vía `Collection()`, mientras que el sync server maneja su propia copia. Para evitar conflictos de lock SQLite:

**Estrategia de coexistencia:**
- El FastAPI server y el sync server **no** deben escribir a la misma BD simultáneamente.
- Opción elegida: FastAPI opera sobre su propia copia de `collection.anki2` en un directorio separado. El sync server opera sobre la copia en `SYNC_BASE`. La sincronización entre ambos se hace a nivel de protocolo Anki sync (nuestro backend actúa como **cliente** del sync server local).
- Alternativa más simple (v1): Solo un servidor a la vez accede a la BD. FastAPI trabaja directamente con `SYNC_BASE/user/collection.anki2`, y el sync server se pausa/reinicia para sync con clientes externos. Evaluaremos esto en implementación.

> **⚠️ Trade-off importante:** El sync server de Anki crea su propia estructura de datos en `SYNC_BASE/{username}/`. Si nuestro FastAPI modifica directamente esa BD mientras el sync server está corriendo, podemos causar conflictos. La solución más robusta es que FastAPI use el **protocolo de sync de Anki como cliente** para comunicarse con el sync server local, en lugar de acceder directamente al archivo SQLite. Esto requiere investigación adicional del protocolo de sync.

> **Decisión pragmática v1:** Para la primera versión, FastAPI abrirá directamente `collection.anki2` (sin sync server corriendo simultáneamente). El sync server se levantará bajo demanda (cuando el usuario presione "Sincronizar" o cada 10 min), FastAPI cerrará la Collection temporalmente, el sync server sincronizará, y FastAPI reabrirá la Collection. Esto es simple y funciona para un solo usuario.

---

## 4. Tipos de nota — Mapeo a Anki

### 4.1 Tipos que mapean directamente a notas Anki estándar

| Tipo UI | Note Type Anki | Campos | Templates |
|---------|---------------|--------|-----------|
| Básica | `Basic` | Front, Back | 1 (Front→Back) |
| Básica invertida | `Basic (and reversed card)` | Front, Back | 2 (Front→Back + Back→Front) |

### 4.2 Tipos custom (campos extra, renderizado por frontend)

| Tipo UI | Note Type Anki (custom) | Campos | Notas |
|---------|------------------------|--------|-------|
| Teclear respuesta | `FC_TypeAnswer` | Front, Back, Language | El frontend compara la respuesta carácter a carácter |
| Opción múltiple | `FC_MultipleChoice` | Question, CorrectAnswer, WrongAnswer1, WrongAnswer2, WrongAnswer3, Language | El frontend baraja y muestra botones |
| Oraciones desordenadas | `FC_ScrambledSentence` | Sentence, Translation (opcional), Language | El frontend tokeniza, baraja, y el usuario reordena |

**Principio de diseño:** Todos los datos se almacenan como campos de nota Anki estándar dentro de `collection.anki2`. Los templates HTML de Anki para los tipos custom serán básicos (solo mostrar campos), ya que la lógica de interacción la maneja nuestro frontend React. Esto mantiene compatibilidad: si el usuario abre la colección en Anki oficial, verá las notas (sin la interactividad especial, pero sin perder datos).

### 4.3 Dictado (modo transversal)

No es un tipo de nota. Es un **modo de interacción** disponible sobre cualquier tarjeta:
- Requiere un campo `Language` en el tipo de nota (o configuración a nivel de mazo) para seleccionar la voz correcta de `window.speechSynthesis`.
- Se activa con botón 🔊 o `Ctrl+T`.
- En "modo dictado completo": oculta texto, reproduce audio, usuario escribe, se compara con distancia de Levenshtein.

---

## 5. Estructura de carpetas del proyecto

```
Flashcard/
├── DESIGN.md                    ← Este documento
├── start.bat                    ← Script de arranque Windows
├── docker-compose.yml           ← Alternativa Docker (futuro)
│
├── backend/
│   ├── pyproject.toml           ← Dependencias Python (FastAPI, anki, uvicorn)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              ← FastAPI app, lifespan, CORS
│   │   ├── config.py            ← Settings (rutas, API key, puertos)
│   │   ├── collection_manager.py← Singleton thread-safe para anki.Collection
│   │   ├── routers/
│   │   │   ├── decks.py         ← CRUD mazos
│   │   │   ├── notetypes.py     ← CRUD tipos de nota
│   │   │   ├── notes.py         ← CRUD notas
│   │   │   ├── cards.py         ← Búsqueda y detalle de cartas
│   │   │   ├── review.py        ← Cola de repaso + answer
│   │   │   ├── sync.py          ← Trigger sync manual
│   │   │   └── stats.py         ← Estadísticas
│   │   ├── schemas/             ← Pydantic models
│   │   ├── services/
│   │   │   ├── sync_service.py  ← Lógica de sync con sync server
│   │   │   └── tts_config.py    ← Config de idiomas para TTS
│   │   └── middleware/
│   │       └── auth.py          ← Validación API key
│   └── tests/
│       ├── test_review.py
│       ├── test_scoring.py      ← Tests de calificación (Levenshtein, etc.)
│       └── conftest.py
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json
│   │   ├── pwa-192x192.png
│   │   └── pwa-512x512.png
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                 ← Cliente HTTP para el backend
│       │   ├── client.ts
│       │   ├── decks.ts
│       │   ├── notes.ts
│       │   ├── review.ts
│       │   └── sync.ts
│       ├── components/
│       │   ├── ui/              ← Componentes base (shadcn-style)
│       │   ├── layout/          ← Shell, Sidebar, Navbar
│       │   ├── deck/            ← Lista de mazos, detalle
│       │   ├── editor/          ← Editor de notas
│       │   ├── review/          ← Motor de repaso
│       │   │   ├── ReviewSession.tsx
│       │   │   ├── BasicCard.tsx
│       │   │   ├── TypeAnswerCard.tsx
│       │   │   ├── MultipleChoiceCard.tsx
│       │   │   ├── ScrambledSentenceCard.tsx
│       │   │   ├── DictationMode.tsx
│       │   │   ├── ProgressBar.tsx
│       │   │   └── FeedbackOverlay.tsx
│       │   ├── sync/            ← Botón y estado de sync
│       │   └── stats/           ← Pantalla de estadísticas
│       ├── hooks/
│       │   ├── useReview.ts
│       │   ├── useOffline.ts
│       │   ├── useTTS.ts
│       │   └── useSync.ts
│       ├── stores/              ← Zustand stores
│       │   ├── reviewStore.ts
│       │   ├── settingsStore.ts
│       │   └── offlineStore.ts
│       ├── lib/
│       │   ├── scoring.ts       ← Levenshtein, comparación de texto
│       │   ├── scramble.ts      ← Tokenización y barajado de oraciones
│       │   └── db.ts            ← idb wrapper para IndexedDB
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── DeckView.tsx
│       │   ├── ReviewPage.tsx
│       │   ├── EditorPage.tsx
│       │   ├── BrowserPage.tsx
│       │   └── StatsPage.tsx
│       └── styles/
│           └── globals.css      ← Tailwind base + custom tokens
│
├── data/                        ← Directorio de datos (gitignored)
│   └── .gitkeep
│
└── Logica/
    └── anki_core/               ← Repo Anki (referencia, no se modifica)
```

---

## 6. Stack tecnológico detallado

### Backend

| Componente | Versión | Propósito |
|-----------|---------|-----------|
| Python | 3.13.3 (sistema) | Runtime |
| `anki` | 26.9.3 (PyPI) | Collection API + FSRS + sync server |
| FastAPI | 0.115+ | Framework HTTP async |
| Uvicorn | 0.30+ | Servidor ASGI |
| Pydantic | 2.x | Validación de esquemas |
| python-dotenv | — | Variables de entorno |

### Frontend

| Componente | Versión | Propósito |
|-----------|---------|-----------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Tipado estricto |
| Vite | 6.x | Bundler + dev server |
| Tailwind CSS | 3.x | Estilos utilitarios |
| shadcn/ui | — | Componentes base |
| vite-plugin-pwa | 0.20+ | Service Worker + manifest |
| idb | 8.x | IndexedDB wrapper |
| Zustand | 5.x | Estado global |
| react-router | 7.x | Navegación SPA |

---

## 7. Flujo de repaso (Review Flow)

```
Usuario abre "Estudiar" en un mazo
       │
       ▼
GET /api/review/queue?deck_id=X&limit=20
       │
       ▼
Backend: col.sched.get_queued_cards(fetch_limit=20)
       │  Devuelve lista de cartas con:
       │  - card_id, note_id, deck_id
       │  - question (HTML renderizado por Anki)
       │  - answer (HTML renderizado)
       │  - note fields (raw, para nuestro rendering custom)
       │  - note_type_name → determina qué componente React usar
       │  - scheduling_states (Again/Hard/Good/Easy con intervalos)
       │
       ▼
Frontend: Selecciona componente según note_type_name:
  "Basic" / "Basic (and reversed card)" → BasicCard
  "FC_TypeAnswer"                       → TypeAnswerCard
  "FC_MultipleChoice"                   → MultipleChoiceCard
  "FC_ScrambledSentence"                → ScrambledSentenceCard
       │
       ▼
Usuario interactúa (voltea, escribe, selecciona, ordena)
       │
       ▼
Frontend califica localmente:
  - Básica: usuario elige 1-4 manualmente
  - Teclear: compara texto → mapea a 1-4 según similitud
  - Opción múltiple: correcto=Good(3), incorrecto=Again(1)
  - Desordenadas: correcto=Good(3), parcial=Hard(2), incorrecto=Again(1)
       │
       ▼
POST /api/review/answer { card_id, rating: 1-4 }
       │
       ▼
Backend: col.sched.answer_card(answer)
  → FSRS calcula nuevo stability, difficulty, interval
  → Card se actualiza en collection.anki2
  → Revlog entry se registra
       │
       ▼
Frontend: Muestra siguiente carta
```

---

## 8. Modo offline

### Flujo

1. **Detección**: El frontend hace `ping` periódico a `GET /api/health`. Si falla → modo offline.
2. **Datos locales**: Al sincronizar exitosamente, el frontend cachea en IndexedDB:
   - Lista de mazos
   - Notas y campos del mazo activo
   - Cola de cartas pendientes de repaso
3. **Estudio offline**: El usuario estudia usando datos de IndexedDB. Las respuestas se encolan como `PendingReview[]` en IndexedDB.
4. **Reconexión**: Al detectar conexión, el frontend envía primero toda la cola de `PendingReview` al backend (POST batch), y luego solicita datos frescos.
5. **Banner**: Se muestra "📡 Sin conexión — estudiando en modo local" con estilo ambar/warning.

---

## 9. Servidor de sync autoalojado — Implementación

### Comando final

```batch
REM En Windows (start.bat)
set SYNC_USER1=usuario:contraseña
set SYNC_BASE=C:\Users\Admin\Documents\Dennis working 2026\Proyectos\Flashcard\data\sync
set SYNC_HOST=0.0.0.0
set SYNC_PORT=8080

start "Anki Sync Server" python -m anki.syncserver
start "Flashcard API" python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Clientes que se conectan

- **Nuestra PWA**: Se conecta a FastAPI (:8000), no directamente al sync server.
- **Anki Desktop / AnkiDroid**: Se configuran para apuntar a `http://<IP>:8080/` como custom sync server.
- **Sincronización cruzada**: Cuando nuestra PWA modifica la colección (vía FastAPI), y el usuario quiere que esos cambios lleguen a Anki Desktop, nuestro backend puede actuar como cliente sync y subir cambios al sync server. O más simple: ambos (PWA y Anki Desktop) sync contra el sync server como fuente de verdad.

---

## 10. Seguridad

- **API key simple**: Variable de entorno `FLASHCARD_API_KEY`. El frontend la envía en header `X-API-Key`.
- **Red local**: El servidor está diseñado para red doméstica. No se expone a internet.
- **Sync server**: Protegido por `SYNC_USER1` (usuario:contraseña).
- **Sin telemetría**: Cero llamadas externas. La Web Speech API es local del navegador.
- **HTTPS**: No incluido en v1 (red local). Se puede agregar con Caddy reverse proxy si se desea.

---

## 11. Calificación de tipos de tarjeta — Lógica de scoring

### Teclear respuesta (`FC_TypeAnswer`)
```
similitud = 1 - (levenshtein(input, expected) / max(len(input), len(expected)))
si similitud == 1.0    → "Perfecto" + rating 4 (Easy)
si similitud >= 0.85   → "Casi" + rating 3 (Good)
si similitud >= 0.60   → "Parcial" + rating 2 (Hard)
si similitud < 0.60    → "Incorrecto" + rating 1 (Again)
```
Retroalimentación visual: diff carácter a carácter con verde (correcto), rojo (incorrecto), amarillo (faltante).

### Opción múltiple (`FC_MultipleChoice`)
```
si correcto → rating 3 (Good)
si incorrecto → rating 1 (Again)
```
El usuario puede overridear a Easy (4) si siente que fue muy fácil.

### Oraciones desordenadas (`FC_ScrambledSentence`)
```
si orden == perfecto     → rating 3 (Good)
si orden parcialmente OK → rating 2 (Hard)  // >50% de tokens en posición correcta
si orden incorrecto      → rating 1 (Again)
```

### Dictado (modo transversal)
```
similitud = 1 - (levenshtein(transcripción, original) / max(len(...), len(...)))
Mismos umbrales que "Teclear respuesta"
```

---

## 12. Diseño visual — Principios

Inspirado en Busuu, toda la interfaz en español:

1. **Una pregunta a la vez**: Pantalla limpia, sin distracciones.
2. **Tarjeta central**: Contenedor redondeado (`rounded-2xl`), sombra suave, ancho máximo 480px.
3. **Barra de progreso**: Arriba de la tarjeta, muestra progreso dentro de la sesión de repaso.
4. **Botones de opciones**: Redondeados, padding generoso, texto claro.
5. **Retroalimentación con color**:
   - ✅ Verde (`emerald-500`): correcto
   - ❌ Rojo (`rose-500`): incorrecto
   - 🟡 Amarillo (`amber-500`): parcial
6. **Tipografía**: Inter o system font, limpia, tamaños generosos.
7. **Modo oscuro**: Toggle persistente, respeta `prefers-color-scheme` por defecto.
   - Fondo oscuro: `slate-900` / `zinc-900`
   - Tarjeta oscura: `slate-800` con borde sutil
8. **Atajos de teclado**: Barra espaciadora (voltear/continuar), 1-4 (calificar), Ctrl+T (TTS).

---

## 13. Preguntas abiertas / Decisiones pendientes

### Resuelta: Coexistencia FastAPI ↔ Sync Server
**Decisión v1**: FastAPI trabaja con su propia copia de la colección. El sync server gestiona la copia "canónica". Antes de cada sync, FastAPI cierra su Collection, ejecuta un sync bidireccional (actuando como cliente del sync server local), y reabre. Esto evita conflictos de lock SQLite.

### Para discutir con el usuario:
1. **¿Quieres que el sync server esté siempre corriendo** (para que AnkiDroid pueda sincronizar en cualquier momento), o solo bajo demanda?
   - *Recomendación*: Siempre corriendo. Es ligero.
2. **¿Contraseña del API key y del sync server**: quieres configurarlas la primera vez via un archivo `.env`, o prefieres un wizard de primer arranque en el navegador?
   - *Recomendación*: Archivo `.env` para v1, wizard como mejora futura.
3. **¿Virtual environment dedicado** para el backend, o instalar las dependencias globalmente?
   - *Recomendación*: venv dedicado para no contaminar el Python del sistema.
