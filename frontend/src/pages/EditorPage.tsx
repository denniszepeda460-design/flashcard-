import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { createNote, getNote, updateNote } from '../api/notes';
import { useDeckStore } from '../stores/deckStore';
import { Check, ArrowLeft, Plus, Trash2, Layers, Volume2 } from 'lucide-react';
import { useTTS } from '../hooks/useTTS';

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: '🌐 Automático (Detectar ES / EN / DE...)' },
  { value: 'es-ES', label: '🇪🇸 Español (España)' },
  { value: 'es-MX', label: '🇲🇽 Español (Latinoamérica)' },
  { value: 'en-US', label: '🇺🇸 English (United States)' },
  { value: 'en-GB', label: '🇬🇧 English (United Kingdom)' },
  { value: 'de-DE', label: '🇩🇪 Deutsch' },
  { value: 'fr-FR', label: '🇫🇷 Français' },
  { value: 'it-IT', label: '🇮🇹 Italiano' },
  { value: 'pt-BR', label: '🇧🇷 Português' },
];

export default function EditorPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isEditing = Boolean(noteId);
  const initialDeckId = searchParams.get('deckId') ? parseInt(searchParams.get('deckId')!, 10) : 0;

  const { decks, loadDecksAndStats } = useDeckStore();
  const [selectedDeckId, setSelectedDeckId] = useState<number>(initialDeckId);
  const [selectedType, setSelectedType] = useState<string>('Basic');

  // Fields state
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [language, setLanguage] = useState('auto');
  const [question, setQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [wrongAnswers, setWrongAnswers] = useState<string[]>(['']); // Starts with 1 wrong answer (total 2 options)
  const [sentence, setSentence] = useState('');
  const [audioText, setAudioText] = useState('');
  const [translation, setTranslation] = useState('');
  const [tags, setTags] = useState('');

  const { speak, isSpeaking } = useTTS(language);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadDecksAndStats();
  }, [loadDecksAndStats]);

  useEffect(() => {
    if (!selectedDeckId && decks.length > 0) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  useEffect(() => {
    if (noteId) {
      setIsLoading(true);
      getNote(parseInt(noteId, 10))
        .then((note) => {
          setSelectedDeckId(note.deck_id);
          setSelectedType(note.note_type_name);
          setTags((note.tags || []).join(', '));

          // Populate fields
          if (note.fields['Front']) setFront(note.fields['Front']);
          if (note.fields['Back']) setBack(note.fields['Back']);
          if (note.fields['Language']) setLanguage(note.fields['Language']);
          if (note.fields['Question']) setQuestion(note.fields['Question']);
          if (note.fields['CorrectAnswer']) setCorrectAnswer(note.fields['CorrectAnswer']);
          if (note.fields['Sentence']) setSentence(note.fields['Sentence']);
          if (note.fields['AudioText']) setAudioText(note.fields['AudioText']);
          if (note.fields['Translation']) setTranslation(note.fields['Translation']);

          const wrongs: string[] = [];
          for (let i = 1; i <= 5; i++) {
            if (note.fields[`WrongAnswer${i}`]) {
              wrongs.push(note.fields[`WrongAnswer${i}`]);
            }
          }
          if (wrongs.length > 0) {
            setWrongAnswers(wrongs);
          }
        })
        .catch((err) => {
          setMessage({ type: 'error', text: 'No se pudo cargar la nota: ' + err.message });
        })
        .finally(() => setIsLoading(false));
    }
  }, [noteId]);

  // Multiple Choice option controls (min 2 total, max 6 total -> 1 correct + 1 to 5 wrong)
  const handleAddOption = () => {
    if (wrongAnswers.length < 5) {
      setWrongAnswers([...wrongAnswers, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (wrongAnswers.length > 1) {
      setWrongAnswers(wrongAnswers.filter((_, i) => i !== index));
    }
  };

  const handleWrongAnswerChange = (index: number, value: string) => {
    const updated = [...wrongAnswers];
    updated[index] = value;
    setWrongAnswers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeckId) {
      setMessage({ type: 'error', text: 'Por favor selecciona un mazo' });
      return;
    }

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Build payload fields according to selectedType
    const payloadFields: Record<string, string> = {};

    if (selectedType === 'Basic' || selectedType === 'Basic (and reversed card)') {
      payloadFields['Front'] = front.trim();
      payloadFields['Back'] = back.trim();
    } else if (selectedType === 'FC_TypeAnswer') {
      payloadFields['Front'] = front.trim();
      payloadFields['Back'] = back.trim();
      payloadFields['Language'] = language;
    } else if (selectedType === 'FC_MultipleChoice') {
      payloadFields['Question'] = question.trim();
      payloadFields['CorrectAnswer'] = correctAnswer.trim();
      wrongAnswers.forEach((ans, idx) => {
        if (ans.trim()) {
          payloadFields[`WrongAnswer${idx + 1}`] = ans.trim();
        }
      });
      payloadFields['Language'] = language;
    } else if (selectedType === 'FC_ScrambledSentence') {
      payloadFields['Sentence'] = sentence.trim();
      payloadFields['Language'] = language;
    } else if (selectedType === 'FC_Dictation') {
      payloadFields['AudioText'] = audioText.trim();
      payloadFields['Translation'] = translation.trim();
      payloadFields['Language'] = language;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      if (isEditing) {
        await updateNote(parseInt(noteId!, 10), {
          fields: payloadFields,
          tags: tagList,
        });
        setMessage({ type: 'success', text: 'Tarjeta actualizada correctamente' });
      } else {
        await createNote({
          deck_id: selectedDeckId,
          note_type_name: selectedType,
          fields: payloadFields,
          tags: tagList,
        });
        setMessage({ type: 'success', text: 'Tarjeta creada exitosamente' });

        // Reset inputs
        setFront('');
        setBack('');
        setQuestion('');
        setCorrectAnswer('');
        setWrongAnswers(['']);
        setSentence('');
        setAudioText('');
        setTranslation('');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error al guardar: ' + (err.message || String(err)) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200 transition-colors pressable"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
              {isEditing ? 'Editar Tarjeta' : 'Crear Tarjeta'}
            </h1>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              Personaliza el contenido para tu repaso espaciado
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
          }`}
        >
          {message.type === 'success' && <Check className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden bg-white dark:bg-zinc-900">
        <CardContent className="pt-6 sm:pt-7 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Top selectors row: Mazo and Tipo de tarjeta (Dropdown) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-1">
                  Mazo
                </label>
                <div className="relative">
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(Number(e.target.value))}
                    disabled={isEditing}
                    className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-800 px-3.5 py-2 text-xs font-medium text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-1">
                  Tipo de tarjeta
                </label>
                <div className="relative">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    disabled={isEditing}
                    className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="Basic">Básica (Anverso / Reverso)</option>
                    <option value="Basic (and reversed card)">Básica Invertida (2 tarjetas)</option>
                    <option value="FC_TypeAnswer">Teclear Respuesta</option>
                    <option value="FC_Dictation">Dictado (Escuchar y Escribir)</option>
                    <option value="FC_MultipleChoice">Opción Múltiple</option>
                    <option value="FC_ScrambledSentence">Oración Desordenada</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dynamic Form based on selectedType */}
            <div className="pt-4 border-t border-stone-200/80 dark:border-zinc-800 space-y-4">
              {/* Type: Basic or Basic Reversed */}
              {(selectedType === 'Basic' || selectedType === 'Basic (and reversed card)') && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Anverso (Pregunta o Concepto)
                    </label>
                    <textarea
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                      placeholder="Escribe el anverso..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3.5 py-2.5 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Reverso (Respuesta)
                    </label>
                    <textarea
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      placeholder="Escribe el reverso..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3.5 py-2.5 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>
                </>
              )}

              {/* Type: Type Answer */}
              {selectedType === 'FC_TypeAnswer' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Pregunta o término
                    </label>
                    <textarea
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                      placeholder="Escribe la pregunta o término a traducir..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3.5 py-2.5 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Respuesta exacta requerida
                    </label>
                    <Input
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      placeholder="Escribe la respuesta exacta..."
                      required
                      className="py-2 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Idioma para pronunciación (TTS)
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-800 px-3.5 py-2 text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Type: Dictation (Escuchar y Escribir) */}
              {selectedType === 'FC_Dictation' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Texto de audio (lo que se pronunciará y el usuario transcribirá)
                      </label>
                      <button
                        type="button"
                        onClick={() => speak(audioText, language)}
                        disabled={!audioText.trim()}
                        className={`text-[11px] font-medium flex items-center gap-1.5 py-1 px-2.5 rounded-lg border transition-colors pressable ${
                          isSpeaking
                            ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title="Probar pronunciación con TTS"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Probar audio</span>
                      </button>
                    </div>
                    <textarea
                      value={audioText}
                      onChange={(e) => setAudioText(e.target.value)}
                      placeholder="Escribe la frase o palabra que el usuario escuchará..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3.5 py-2.5 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Pista o Traducción (opcional, ayuda al usuario si la solicita)
                    </label>
                    <Input
                      value={translation}
                      onChange={(e) => setTranslation(e.target.value)}
                      placeholder="Ej: Significado o traducción en español..."
                      className="py-2 px-3 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Idioma para pronunciación (TTS)
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-800 px-3.5 py-2 text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Type: Multiple Choice */}
              {selectedType === 'FC_MultipleChoice' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Pregunta
                    </label>
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Escribe la pregunta..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3.5 py-2.5 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                      Respuesta Correcta
                    </label>
                    <Input
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      placeholder="Escribe la opción correcta..."
                      required
                      className="py-2 px-3 text-xs"
                    />
                  </div>

                  {/* Wrong options (minimum 1 wrong option -> total 2 options, up to 5 wrong -> total 6 options) */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400">
                        Opciones Incorrectas ({wrongAnswers.length + 1} de 6 opciones en total)
                      </label>
                      {wrongAnswers.length < 5 && (
                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors pressable"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Añadir opción</span>
                        </button>
                      )}
                    </div>

                    {wrongAnswers.map((ans, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={ans}
                          onChange={(e) => handleWrongAnswerChange(idx, e.target.value)}
                          placeholder={`Opción incorrecta ${idx + 1}...`}
                          required={idx === 0}
                          className="py-2 px-3 text-xs flex-1"
                        />
                        {wrongAnswers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors pressable"
                            title="Eliminar opción"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Idioma para pronunciación (TTS)
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-800 px-3.5 py-2 text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Type: Scrambled Sentence */}
              {selectedType === 'FC_ScrambledSentence' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Oración objetivo completa (se ordenará con fichas)
                    </label>
                    <textarea
                      value={sentence}
                      onChange={(e) => setSentence(e.target.value)}
                      placeholder="Escribe la oración completa..."
                      rows={3}
                      required
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3.5 py-2.5 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                      Idioma de la oración
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-800 px-3.5 py-2 text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Tags Input */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-1">
                Etiquetas (opcional, separadas por coma)
              </label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="vocabulario, lección 1..."
                className="py-2 px-3 text-xs"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-3 border-t border-stone-200/80 dark:border-zinc-800">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto px-6 font-medium flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>{isEditing ? 'Guardar Cambios' : 'Añadir Tarjeta'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
