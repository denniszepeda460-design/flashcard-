import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Trash2, Check, AlertCircle, Upload, FileCheck, Volume2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { DeckInfo } from '../../api/types';
import { post } from '../../api/client';
import { useTTS } from '../../hooks/useTTS';

interface Props {
  decks: DeckInfo[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GeneratedCardItem {
  note_type_name: string;
  fields: Record<string, string>;
  tags: string[];
}

export function AiBatchModal({ decks, isOpen, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [inputText, setInputText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<number>(decks[0]?.id || 0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cards, setCards] = useState<GeneratedCardItem[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { speak, isSpeaking } = useTTS();

  useEffect(() => {
    if (decks.length > 0 && (!selectedDeckId || !decks.some((d) => d.id === selectedDeckId))) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, isOpen]);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setUploadedFile(file);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setInputText(content);
      setMessage({
        type: 'success',
        text: `Archivo "${file.name}" cargado (${(file.size / 1024).toFixed(1)} KB). Listo para clasificar con IA.`,
      });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Drag and drop event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleGenerateAi = async () => {
    if (!inputText.trim()) {
      setMessage({ type: 'error', text: 'Pega algún texto o arrastra un archivo para que la IA lo analice.' });
      return;
    }

    setIsGenerating(true);
    setMessage(null);

    try {
      const res = await post<{ cards: GeneratedCardItem[]; api_key_index: number }>(
        '/api/ai/generate-cards',
        {
          text: inputText.slice(0, 35000).trim(),
          deck_id: selectedDeckId,
        }
      );

      if (res.cards && res.cards.length > 0) {
        setCards(res.cards);
        setMessage({
          type: 'success',
          text: `¡Listo! La IA detectó los idiomas y generó ${res.cards.length} tarjetas con tipos óptimos.`,
        });
      } else {
        setMessage({ type: 'error', text: 'No se generaron tarjetas del contenido proporcionado.' });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: 'Error con la IA: ' + (err.message || String(err)),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Manual parse fallback: "Anverso | Reverso" or "Anverso ; Reverso" per line
  const handleManualParse = () => {
    if (!inputText.trim()) return;
    const lines = inputText.split('\n').filter((l) => l.trim().length > 0);
    const manualCards: GeneratedCardItem[] = [];

    for (const line of lines) {
      let sep = '|';
      if (line.includes('|')) sep = '|';
      else if (line.includes(';')) sep = ';';
      else if (line.includes('\t')) sep = '\t';
      else if (line.includes(' - ')) sep = ' - ';

      const parts = line.split(sep);
      if (parts.length >= 2) {
        manualCards.push({
          note_type_name: 'Basic',
          fields: {
            Front: parts[0].trim(),
            Back: parts[1].trim(),
          },
          tags: ['lote-manual'],
        });
      }
    }

    if (manualCards.length > 0) {
      setCards(manualCards);
      setMessage({
        type: 'success',
        text: `Se detectaron ${manualCards.length} tarjetas en formato lista.`,
      });
    } else {
      setMessage({
        type: 'error',
        text: 'No se detectó formato delimitado (ej: Pregunta | Respuesta). Usa "Crear con IA" para clasificarlo automáticamente.',
      });
    }
  };

  const handleRemoveCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    if (cards.length === 0) return;
    const targetDeck = selectedDeckId || (decks.length > 0 ? decks[0].id : 0);
    if (!targetDeck) {
      setMessage({ type: 'error', text: 'Por favor selecciona un mazo de destino.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const payload = {
        deck_id: targetDeck,
        notes: cards.map((c) => ({
          deck_id: targetDeck,
          note_type_name: c.note_type_name,
          fields: c.fields,
          tags: c.tags && c.tags.length > 0 ? c.tags : ['creado-ia'],
        })),
        allow_html: true,
        existing_action: 'add',
      };

      const res = await post<{ success: boolean; created: number }>('/api/notes/batch', payload);

      if (res.created > 0) {
        setMessage({
          type: 'success',
          text: `Se crearon ${res.created} tarjetas en tu colección.`,
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: 'Error guardando tarjetas: ' + (err.message || String(err)),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FC_Dictation':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1">
            <Volume2 className="h-3 w-3" />
            Dictado
          </span>
        );
      case 'FC_TypeAnswer':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/40">
            Teclear
          </span>
        );
      case 'FC_MultipleChoice':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
            Opción Múltiple
          </span>
        );
      case 'FC_ScrambledSentence':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
            Ordenar Frase
          </span>
        );
      case 'Basic (and reversed card)':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700">
            Invertida
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700">
            Básica
          </span>
        );
    }
  };

  const getLangBadge = (lang?: string) => {
    if (!lang) return null;
    const l = lang.toLowerCase();
    if (l.startsWith('es')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 font-mono font-medium">
          🇪🇸 Español
        </span>
      );
    }
    if (l.startsWith('en')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 font-mono font-medium">
          🇺🇸 Inglés
        </span>
      );
    }
    if (l.startsWith('de')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40 font-mono font-medium">
          🇩🇪 Alemán
        </span>
      );
    }
    if (l.startsWith('fr')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 font-mono font-medium">
          🇫🇷 Francés
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 font-mono">
        {lang}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 dark:bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 p-6 sm:p-7 space-y-5 my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                Creación con IA
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                Detecta automáticamente Español, Inglés o Alemán y asigna tipos de tarjeta óptimos (incluyendo Dictado).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors pressable"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium shrink-0 ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
            }`}
          >
            {message.type === 'success' ? <Check className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Deck selector and action bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1">
              <span className="text-xs font-medium text-stone-600 dark:text-zinc-400 shrink-0">Mazo destino:</span>
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(Number(e.target.value))}
                className="w-full sm:w-auto rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleManualParse}
                className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-medium text-stone-600 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors pressable"
              >
                Lista simple
              </button>
              <Button
                onClick={handleGenerateAi}
                disabled={isGenerating || !inputText.trim()}
                className="px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'Analizando con IA...' : 'Crear con IA'}</span>
              </Button>
            </div>
          </div>

          {/* Drag & Drop File Zone or Active File Badge */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-stone-200 dark:border-zinc-800 hover:border-blue-400 bg-stone-50/40 dark:bg-zinc-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-stone-100 dark:bg-zinc-800 rounded-lg text-stone-500 dark:text-zinc-400">
                {uploadedFile ? <FileCheck className="h-5 w-5 text-emerald-500" /> : <Upload className="h-5 w-5" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-stone-800 dark:text-zinc-200">
                  {uploadedFile ? uploadedFile.name : 'Arrastra un archivo aquí o haz clic para explorar'}
                </p>
                <p className="text-[11px] text-stone-400 dark:text-zinc-500">
                  {uploadedFile
                    ? `${(uploadedFile.size / 1024).toFixed(1)} KB · Listo para procesar`
                    : 'Admite archivos CSV, TSV, TXT, MD con listas o apuntes'}
                </p>
              </div>
            </div>

            {uploadedFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadedFile(null);
                  setInputText('');
                  setCards([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs px-2.5 py-1 rounded-md border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 transition-colors shrink-0 pressable"
              >
                Quitar archivo
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv,.md,.text"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Text input area */}
          <div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pega aquí tus notas, vocabulario o apuntes (Español, Inglés, Alemán)... La IA detectará automáticamente el idioma y generará tarjetas pedagógicas (incluyendo dictados y audios claros)."
              rows={cards.length > 0 ? 3 : 7}
              className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3.5 py-2.5 text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors font-mono resize-y"
            />
          </div>

          {/* Cards Preview Area */}
          {cards.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                  Tarjetas generadas para revisión ({cards.length})
                </span>
                <span className="text-[11px] text-stone-400 dark:text-zinc-500">
                  Puedes probar el audio o descartar tarjetas antes de guardar
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {cards.map((c, idx) => {
                  const mainPrompt =
                    c.fields['AudioText'] ||
                    c.fields['Front'] ||
                    c.fields['Question'] ||
                    c.fields['Sentence'] ||
                    '';
                  const mainAnswer =
                    c.fields['Translation'] ||
                    c.fields['Back'] ||
                    c.fields['CorrectAnswer'] ||
                    '';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/40 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {getTypeBadge(c.note_type_name)}
                          {getLangBadge(c.fields['Language'])}
                          {c.fields['Voice'] && (
                            <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">
                              🔊 {c.fields['Voice'].split('-')[2] || c.fields['Voice']}
                            </span>
                          )}
                          {c.tags && c.tags.length > 0 && (
                            <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">
                              #{c.tags.join(' #')}
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-stone-800 dark:text-zinc-200 text-xs">
                          {mainPrompt}
                        </div>
                        {mainAnswer && (
                          <div className="text-stone-500 dark:text-zinc-400">
                            → {mainAnswer}
                          </div>
                        )}
                        {c.note_type_name === 'FC_MultipleChoice' && c.fields['WrongAnswer1'] && (
                          <div className="text-[11px] text-stone-400 dark:text-zinc-500">
                            Distractores: {c.fields['WrongAnswer1']}
                            {c.fields['WrongAnswer2'] ? `, ${c.fields['WrongAnswer2']}` : ''}
                            {c.fields['WrongAnswer3'] ? `, ${c.fields['WrongAnswer3']}` : ''}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Botón de reproducción de prueba rápida */}
                        {mainPrompt && (
                          <button
                            type="button"
                            onClick={() => speak(mainPrompt, c.fields['Language'] || 'auto')}
                            className="p-1.5 text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-stone-200/50 dark:hover:bg-zinc-700/50 transition-colors pressable"
                            title="Escuchar pronunciación"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveCard(idx)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-stone-200/50 dark:hover:bg-zinc-700/50 transition-colors pressable"
                          title="Eliminar tarjeta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200/80 dark:border-zinc-800 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isSaving || isGenerating}>
            Cerrar
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={cards.length === 0 || isSaving}
            className="px-4 font-medium"
          >
            {isSaving ? 'Guardando en colección...' : `Guardar ${cards.length} tarjetas en mazo`}
          </Button>
        </div>
      </div>
    </div>
  );
}
