import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Sparkles, Trash2, Layers, FileCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { DeckInfo } from '../../api/types';
import { post } from '../../api/client';

interface Props {
  decks: DeckInfo[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedCsv {
  delimiter: string;
  rows: string[][];
  headers: string[];
}

interface GeneratedCardItem {
  note_type_name: string;
  fields: Record<string, string>;
  tags: string[];
}

export function CsvImportModal({ decks, isOpen, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [rawFile, setRawFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedCsv | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Tab mode: 'ai' (Clasificar con IA) or 'columns' (Mapeo de Columnas Estándar)
  const [importMode, setImportMode] = useState<'ai' | 'columns'>('ai');

  // Common options: Ensure initial selection is synced
  const [selectedDeckId, setSelectedDeckId] = useState<number>(decks[0]?.id || 0);

  // Columns mode options
  const [allowHtml, setAllowHtml] = useState(false);
  const [selectedDelimiter, setSelectedDelimiter] = useState(';');
  const [selectedType, setSelectedType] = useState('Basic');
  const [existingAction, setExistingAction] = useState('add'); // "add", "update", "skip"
  const [fieldMapping, setFieldMapping] = useState<Record<number, string>>({
    0: 'Front',
    1: 'Back',
  });

  // AI mode state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiCards, setAiCards] = useState<GeneratedCardItem[]>([]);
  const [isSavingAi, setIsSavingAi] = useState(false);

  // General import loading and status
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Synchronize deck selection whenever decks list loads or changes
  useEffect(() => {
    if (decks.length > 0 && (!selectedDeckId || !decks.some((d) => d.id === selectedDeckId))) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, isOpen]);

  if (!isOpen) return null;

  // Auto-detect delimiter from text
  const detectDelimiter = (text: string): string => {
    const firstLines = text.split('\n').slice(0, 5).join('\n');
    const counts = {
      ';': (firstLines.match(/;/g) || []).length,
      ',': (firstLines.match(/,/g) || []).length,
      '\t': (firstLines.match(/\t/g) || []).length,
      '|': (firstLines.match(/\|/g) || []).length,
    };
    let best = ';';
    let maxCount = -1;
    for (const [delim, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        best = delim;
      }
    }
    return best;
  };

  // CSV parser supporting quotes
  const parseCsvText = (text: string, delim: string): string[][] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows: string[][] = [];

    for (const line of lines) {
      const row: string[] = [];
      let inQuotes = false;
      let currentField = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          row.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      row.push(currentField.trim());
      rows.push(row);
    }
    return rows;
  };

  const processFile = (file: File) => {
    setRawFile(file);
    setStatusMessage(null);
    setAiCards([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setRawText(content);

      const delim = detectDelimiter(content);
      setSelectedDelimiter(delim);

      const rows = parseCsvText(content, delim);
      const maxCols = Math.max(...rows.map((r) => r.length), 2);
      const headers = Array.from({ length: maxCols }, (_, i) => String(i + 1));

      setParsedData({ delimiter: delim, rows, headers });

      setFieldMapping({
        0: 'Front',
        1: 'Back',
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

  // HTML5 Drag and Drop handlers
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

  const handleDelimiterChange = (delim: string) => {
    setSelectedDelimiter(delim);
    if (rawText) {
      const rows = parseCsvText(rawText, delim);
      const maxCols = Math.max(...rows.map((r) => r.length), 2);
      const headers = Array.from({ length: maxCols }, (_, i) => String(i + 1));
      setParsedData({ delimiter: delim, rows, headers });
    }
  };

  const getFieldsForType = (type: string) => {
    switch (type) {
      case 'FC_TypeAnswer':
        return ['Front', 'Back', 'Language'];
      case 'FC_MultipleChoice':
        return ['Question', 'CorrectAnswer', 'WrongAnswer1', 'WrongAnswer2', 'WrongAnswer3', 'Language'];
      case 'FC_ScrambledSentence':
        return ['Sentence', 'Language'];
      default:
        return ['Front', 'Back'];
    }
  };

  const targetFields = getFieldsForType(selectedType);

  // AI Generation from uploaded file
  const handleGenerateWithAi = async () => {
    const targetDeck = selectedDeckId || (decks.length > 0 ? decks[0].id : 0);
    if (!targetDeck) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona un mazo de destino.' });
      return;
    }

    if (!rawText.trim()) {
      setStatusMessage({ type: 'error', text: 'El archivo está vacío o no contiene texto legible.' });
      return;
    }

    setIsGeneratingAi(true);
    setStatusMessage(null);

    try {
      const res = await post<{ cards: GeneratedCardItem[]; api_key_index: number }>(
        '/api/ai/generate-cards',
        {
          text: rawText.slice(0, 35000),
          deck_id: targetDeck,
        },
        90000
      );

      if (res.cards && res.cards.length > 0) {
        setAiCards(res.cards);
        setStatusMessage({
          type: 'success',
          text: `Se clasificaron ${res.cards.length} tarjetas con tipos óptimos.`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'La IA no pudo extraer tarjetas del archivo. Puedes usar la pestaña de Mapeo de Columnas.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error en la generación con IA: ' + (err.message || String(err)),
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleRemoveAiCard = (index: number) => {
    setAiCards(aiCards.filter((_, i) => i !== index));
  };

  // Save AI generated cards
  const handleSaveAiCards = async () => {
    if (aiCards.length === 0) return;
    const targetDeck = selectedDeckId || (decks.length > 0 ? decks[0].id : 0);
    if (!targetDeck) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona un mazo de destino.' });
      return;
    }

    setIsSavingAi(true);
    setStatusMessage(null);

    try {
      const payload = {
        deck_id: targetDeck,
        notes: aiCards.map((c) => ({
          deck_id: targetDeck,
          note_type_name: c.note_type_name,
          fields: c.fields,
          tags: c.tags && c.tags.length > 0 ? c.tags : ['importado-ia'],
        })),
        allow_html: true,
        existing_action: existingAction,
      };

      const res = await post<{ success: boolean; created: number }>('/api/notes/batch', payload);

      if (res.created > 0) {
        setStatusMessage({
          type: 'success',
          text: `Se crearon ${res.created} tarjetas en tu mazo.`,
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error al guardar tarjetas: ' + (err.message || String(err)),
      });
    } finally {
      setIsSavingAi(false);
    }
  };

  // Standard CSV Import with Column Mapping
  const handleImportColumns = async () => {
    if (!parsedData || parsedData.rows.length === 0) return;
    const targetDeck = selectedDeckId || (decks.length > 0 ? decks[0].id : 0);
    if (!targetDeck) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona un mazo de destino' });
      return;
    }

    setIsImporting(true);
    setStatusMessage(null);

    try {
      const notesToCreate = parsedData.rows.map((row) => {
        const fields: Record<string, string> = {};
        Object.entries(fieldMapping).forEach(([colIdxStr, fieldName]) => {
          if (fieldName && fieldName !== 'ignore') {
            const colIdx = Number(colIdxStr);
            let val = row[colIdx] || '';
            if (!allowHtml) {
              val = val.replace(/<[^>]*>/g, '');
            }
            fields[fieldName] = val;
          }
        });

        if (
          (selectedType === 'FC_TypeAnswer' ||
            selectedType === 'FC_MultipleChoice' ||
            selectedType === 'FC_ScrambledSentence') &&
          !fields['Language']
        ) {
          fields['Language'] = 'es-ES';
        }

        return {
          deck_id: targetDeck,
          note_type_name: selectedType,
          fields,
          tags: ['importado-csv'],
        };
      });

      const res = await post<{ success: boolean; created: number; errors: string[] }>('/api/notes/batch', {
        deck_id: targetDeck,
        notes: notesToCreate,
        allow_html: allowHtml,
        existing_action: existingAction,
      });

      if (res.created > 0) {
        setStatusMessage({
          type: 'success',
          text: `Se importaron ${res.created} tarjetas al mazo.`,
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1300);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'No se pudieron importar tarjetas: ' + (res.errors.join(', ') || 'error desconocido'),
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Error en la importación: ' + (err.message || String(err)),
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FC_TypeAnswer':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
            Teclear
          </span>
        );
      case 'FC_MultipleChoice':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
            Opción Múltiple
          </span>
        );
      case 'FC_ScrambledSentence':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
            Ordenar Frase
          </span>
        );
      case 'Basic (and reversed card)':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
            Invertida
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
            Básica
          </span>
        );
    }
  };

  const activeDeckId = selectedDeckId || (decks.length > 0 ? decks[0].id : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 p-6 sm:p-7 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-zinc-800/80 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Importar Flashcards desde Archivo</span>
            </h2>
            <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">
              Sube o arrastra tu archivo (.csv, .txt, .tsv). Puedes clasificarlo con IA o usar mapeo estándar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 text-xs font-semibold shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-950/60 text-green-800 dark:text-green-300 border border-green-200/80 dark:border-green-900/60'
                : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200/80 dark:border-red-900/60'
            }`}
          >
            {statusMessage.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* File Dropzone */}
          {!parsedData ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-150 space-y-3 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-stone-200 dark:border-zinc-800 hover:border-blue-500 bg-stone-50/50 dark:bg-zinc-950/40'
              }`}
            >
              <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-xs inline-block">
                <Upload className={`h-6 w-6 ${isDragging ? 'text-blue-600' : 'text-stone-400'}`} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-stone-800 dark:text-zinc-200">
                  {isDragging
                    ? 'Suelta el archivo aquí'
                    : 'Arrastra y suelta tu archivo aquí o haz clic para seleccionarlo'}
                </p>
                <p className="text-xs text-stone-400 dark:text-zinc-500">
                  Formatos: .CSV, .TXT, .TSV
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv,.md,.text"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-800 dark:text-zinc-200 flex items-center gap-2">
                    <span>{rawFile?.name}</span>
                    <span className="text-[10px] text-stone-400 font-mono">
                      ({((rawFile?.size || 0) / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {parsedData.rows.length} líneas detectadas
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParsedData(null);
                  setRawFile(null);
                  setRawText('');
                  setAiCards([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-600 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Cambiar archivo
              </button>
            </div>
          )}

          {/* Mode Tabs */}
          {parsedData && (
            <div className="space-y-4">
              <div className="flex p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-xl border border-stone-200/60 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setImportMode('ai')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    importMode === 'ai'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Crear con IA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('columns')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    importMode === 'columns'
                      ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Mapeo de Columnas (Estándar)</span>
                </button>
              </div>

              {/* MODE 1: CLASIFICAR CON IA */}
              {importMode === 'ai' && (
                <div className="space-y-4 bg-stone-50/70 dark:bg-zinc-800/40 p-4 sm:p-5 rounded-2xl border border-stone-200/80 dark:border-zinc-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200/60 dark:border-zinc-700/60">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                        Clasificación Inteligente
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-zinc-400">
                        La IA asigna a cada concepto el tipo óptimo de tarjeta.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-stone-500">Mazo:</span>
                      <select
                        value={activeDeckId}
                        onChange={(e) => setSelectedDeckId(Number(e.target.value))}
                        className="rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold"
                      >
                        {decks.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {aiCards.length === 0 ? (
                    <div className="py-4 text-center space-y-3">
                      <Button
                        type="button"
                        onClick={handleGenerateWithAi}
                        disabled={isGeneratingAi}
                        className="rounded-xl px-5 py-2.5 font-bold text-xs inline-flex items-center gap-2"
                      >
                        <Sparkles className={`h-4 w-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingAi ? 'Analizando archivo...' : 'Analizar y Generar Flashcards'}</span>
                      </Button>

                      {/* File preview */}
                      <div className="text-left bg-white dark:bg-zinc-900 p-3 rounded-xl border border-stone-200 dark:border-zinc-800 text-[11px] font-mono text-stone-600 dark:text-zinc-400 max-h-24 overflow-y-auto">
                        {rawText.slice(0, 400)}
                        {rawText.length > 400 && '...'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-500">
                          Tarjetas generadas ({aiCards.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleGenerateWithAi}
                          disabled={isGeneratingAi}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3" />
                          Volver a analizar
                        </button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {aiCards.map((c, idx) => {
                          const mainPrompt = c.fields['Front'] || c.fields['Question'] || c.fields['Sentence'] || '';
                          const mainAnswer = c.fields['Back'] || c.fields['CorrectAnswer'] || '';

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  {getTypeBadge(c.note_type_name)}
                                </div>
                                <div className="font-semibold text-stone-900 dark:text-zinc-100">
                                  {mainPrompt}
                                </div>
                                {mainAnswer && (
                                  <div className="text-stone-500 dark:text-zinc-400">
                                    → {mainAnswer}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveAiCard(idx)}
                                className="p-1 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button
                          onClick={handleSaveAiCards}
                          disabled={aiCards.length === 0 || isSavingAi}
                          className="rounded-xl px-5 text-xs font-bold"
                        >
                          {isSavingAi ? 'Guardando...' : `Guardar ${aiCards.length} tarjetas`}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 2: MAPEO DE COLUMNAS ESTÁNDAR */}
              {importMode === 'columns' && (
                <div className="space-y-4">
                  <div className="space-y-3 bg-stone-50/70 dark:bg-zinc-800/40 p-4 rounded-xl border border-stone-200/80 dark:border-zinc-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-500 mb-1">
                          Separador
                        </label>
                        <select
                          value={selectedDelimiter}
                          onChange={(e) => handleDelimiterChange(e.target.value)}
                          className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium"
                        >
                          <option value=";">Punto y coma (;)</option>
                          <option value=",">Coma (,)</option>
                          <option value="&#9;">Tabulación (Tab)</option>
                          <option value="|">Barra vertical (|)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-4 sm:pt-6">
                        <input
                          type="checkbox"
                          id="allowHtml"
                          checked={allowHtml}
                          onChange={(e) => setAllowHtml(e.target.checked)}
                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="allowHtml" className="text-xs font-semibold text-stone-600 dark:text-zinc-300 cursor-pointer">
                          Permitir HTML
                        </label>
                      </div>
                    </div>

                    {/* Table preview */}
                    <div className="rounded-xl border border-stone-200 dark:border-zinc-800 overflow-hidden">
                      <div className="overflow-x-auto max-h-32">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 font-semibold sticky top-0">
                            <tr>
                              {parsedData.headers.map((h) => (
                                <th key={h} className="px-3 py-1.5 border-r border-stone-200 dark:border-zinc-700 last:border-r-0 text-center">
                                  Col {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                            {parsedData.rows.slice(0, 4).map((row, rIdx) => (
                              <tr key={rIdx}>
                                {parsedData.headers.map((_, cIdx) => (
                                  <td key={cIdx} className="px-3 py-1.5 border-r border-stone-100 dark:border-zinc-800 last:border-r-0 max-w-[160px] truncate text-stone-700 dark:text-zinc-300">
                                    {row[cIdx] || ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-500 mb-1">
                          Tipo de nota
                        </label>
                        <select
                          value={selectedType}
                          onChange={(e) => {
                            setSelectedType(e.target.value);
                            const fields = getFieldsForType(e.target.value);
                            const newMapping: Record<number, string> = {};
                            fields.forEach((f, idx) => {
                              newMapping[idx] = f;
                            });
                            setFieldMapping(newMapping);
                          }}
                          className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold"
                        >
                          <option value="Basic">Básica</option>
                          <option value="Basic (and reversed card)">Invertida</option>
                          <option value="FC_TypeAnswer">Teclear Respuesta</option>
                          <option value="FC_MultipleChoice">Opción Múltiple</option>
                          <option value="FC_ScrambledSentence">Oración Desordenada</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-500 mb-1">
                          Mazo de destino
                        </label>
                        <select
                          value={activeDeckId}
                          onChange={(e) => setSelectedDeckId(Number(e.target.value))}
                          className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold"
                        >
                          {decks.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-500 mb-1">
                          Duplicados
                        </label>
                        <select
                          value={existingAction}
                          onChange={(e) => setExistingAction(e.target.value)}
                          className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium"
                        >
                          <option value="add">Añadir siempre</option>
                          <option value="update">Actualizar existentes</option>
                          <option value="skip">Omitir duplicados</option>
                        </select>
                      </div>
                    </div>

                    {/* Field mapping */}
                    <div className="pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {parsedData.headers.map((colHeader, colIdx) => (
                          <div key={colIdx} className="flex items-center gap-2">
                            <span className="w-12 text-xs font-mono font-bold text-stone-400 text-right shrink-0">
                              Col {colHeader}:
                            </span>
                            <select
                              value={fieldMapping[colIdx] || 'ignore'}
                              onChange={(e) =>
                                setFieldMapping({ ...fieldMapping, [colIdx]: e.target.value })
                              }
                              className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium"
                            >
                              <option value="ignore">(Ignorar)</option>
                              {targetFields.map((f) => (
                                <option key={f} value={f}>
                                  Campo: {f}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        onClick={handleImportColumns}
                        disabled={!parsedData || parsedData.rows.length === 0 || isImporting}
                        className="rounded-xl px-5 text-xs font-bold"
                      >
                        {isImporting ? 'Importando...' : `Importar ${parsedData.rows.length} tarjetas`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200/80 dark:border-zinc-800/80 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={isImporting || isSavingAi || isGeneratingAi} className="text-xs">
            Cerrar
          </Button>

          <div className="text-xs text-stone-400 font-medium">
            {parsedData && `${parsedData.rows.length} filas detectadas`}
          </div>
        </div>
      </div>
    </div>
  );
}
