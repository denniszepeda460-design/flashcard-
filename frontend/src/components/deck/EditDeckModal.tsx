import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  Search,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DeckInfo, NoteInfo } from '../../api/types';
import { renameDeck } from '../../api/decks';
import { searchNotes, updateNote, deleteNote, createNote } from '../../api/notes';

interface Props {
  deck: DeckInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDeleteRequested?: (deck: DeckInfo) => void;
}

export function EditDeckModal({
  deck,
  isOpen,
  onClose,
  onSuccess,
  onDeleteRequested,
}: Props) {
  const [deckName, setDeckName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);

  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Local modified fields for notes: { [noteId]: { fieldName: value } }
  const [cardEdits, setCardEdits] = useState<Record<number, Record<string, string>>>({});
  const [savingCardId, setSavingCardId] = useState<number | null>(null);
  const [savedCardSuccess, setSavedCardSuccess] = useState<Record<number, boolean>>({});

  // Quick Add new card state
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardType, setNewCardType] = useState('Basic');
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [isAddingCard, setIsAddingCard] = useState(false);

  // Expanded distractors state for Multiple Choice cards
  const [expandedDistractors, setExpandedDistractors] = useState<Record<number, boolean>>({});

  // Error/Status message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && deck) {
      setDeckName(deck.name);
      setNameSavedSuccess(false);
      loadNotes(deck.id);
    } else {
      setNotes([]);
      setCardEdits({});
      setMessage(null);
    }
  }, [isOpen, deck]);

  if (!isOpen || !deck) return null;

  const loadNotes = async (deckId: number) => {
    setIsLoadingNotes(true);
    try {
      const res = await searchNotes('', deckId, 150);
      setNotes(res.notes || []);
      // Initialize card edits
      const initialEdits: Record<number, Record<string, string>> = {};
      (res.notes || []).forEach((n) => {
        initialEdits[n.id] = { ...n.fields };
      });
      setCardEdits(initialEdits);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error al cargar las tarjetas: ' + (err.message || String(err)) });
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // 1. Rename Deck Handler
  const handleRenameDeck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!deckName.trim() || deckName.trim() === deck.name) return;

    setIsSavingName(true);
    try {
      await renameDeck(deck.id, deckName.trim());
      setNameSavedSuccess(true);
      setTimeout(() => setNameSavedSuccess(false), 2500);
      onSuccess();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error al renombrar el mazo: ' + (err.message || String(err)) });
    } finally {
      setIsSavingName(false);
    }
  };

  // 2. Field Change for existing card
  const handleFieldChange = (noteId: number, fieldName: string, value: string) => {
    setCardEdits((prev) => ({
      ...prev,
      [noteId]: {
        ...(prev[noteId] || {}),
        [fieldName]: value,
      },
    }));
  };

  // 3. Save single card changes (Anverso & Reverso)
  const handleSaveCard = async (note: NoteInfo) => {
    const editedFields = cardEdits[note.id];
    if (!editedFields) return;

    setSavingCardId(note.id);
    setMessage(null);

    try {
      await updateNote(note.id, { fields: editedFields });
      setSavedCardSuccess((prev) => ({ ...prev, [note.id]: true }));
      setTimeout(() => {
        setSavedCardSuccess((prev) => ({ ...prev, [note.id]: false }));
      }, 2000);

      // Update the local note object
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, fields: { ...editedFields } } : n))
      );
      onSuccess();
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error al guardar tarjeta #${note.id}: ` + (err.message || String(err)) });
    } finally {
      setSavingCardId(null);
    }
  };

  // 4. Delete single card
  const handleDeleteCard = async (noteId: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta tarjeta del mazo?')) {
      return;
    }

    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setCardEdits((prev) => {
        const copy = { ...prev };
        delete copy[noteId];
        return copy;
      });
      onSuccess();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error al eliminar tarjeta: ' + (err.message || String(err)) });
    }
  };

  // 5. Quick Add Card into Deck
  const handleCreateNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardFront.trim() || !newCardBack.trim()) {
      setMessage({ type: 'error', text: 'Por favor ingresa tanto el Anverso como el Reverso.' });
      return;
    }

    setIsAddingCard(true);
    setMessage(null);

    try {
      const fields: Record<string, string> = {};
      if (newCardType === 'FC_MultipleChoice') {
        fields['Question'] = newCardFront.trim();
        fields['CorrectAnswer'] = newCardBack.trim();
        fields['WrongAnswer1'] = 'Opción alternativa';
        fields['WrongAnswer2'] = 'Opción alternativa';
      } else if (newCardType === 'FC_ScrambledSentence') {
        fields['Sentence'] = newCardFront.trim();
      } else if (newCardType === 'FC_Dictation') {
        fields['AudioText'] = newCardFront.trim();
        if (newCardBack.trim()) {
          fields['Translation'] = newCardBack.trim();
        }
        fields['Language'] = 'es-ES';
      } else {
        fields['Front'] = newCardFront.trim();
        fields['Back'] = newCardBack.trim();
      }

      await createNote({
        deck_id: deck.id,
        note_type_name: newCardType,
        fields,
        tags: ['manual'],
      });

      setNewCardFront('');
      setNewCardBack('');
      setShowAddCard(false);
      setMessage({ type: 'success', text: '¡Tarjeta añadida con éxito al mazo!' });
      // Reload notes list
      loadNotes(deck.id);
      onSuccess();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error al añadir tarjeta: ' + (err.message || String(err)) });
    } finally {
      setIsAddingCard(false);
    }
  };

  // Helper to get front / back values for any note type
  const getCardFrontField = (note: NoteInfo) => {
    if (note.fields['Question'] !== undefined) return 'Question';
    if (note.fields['Sentence'] !== undefined) return 'Sentence';
    if (note.fields['AudioText'] !== undefined) return 'AudioText';
    return 'Front';
  };

  const getCardBackField = (note: NoteInfo) => {
    if (note.fields['CorrectAnswer'] !== undefined) return 'CorrectAnswer';
    if (note.fields['Translation'] !== undefined) return 'Translation';
    return 'Back';
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const front = (n.fields['Front'] || n.fields['Question'] || n.fields['Sentence'] || n.fields['AudioText'] || '').toLowerCase();
    const back = (n.fields['Back'] || n.fields['CorrectAnswer'] || n.fields['Translation'] || '').toLowerCase();
    return front.includes(q) || back.includes(q);
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FC_Dictation':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 dark:bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 p-6 sm:p-7 space-y-5 my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                Editar Mazo y Tarjetas
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                Modifica el nombre del mazo o edita el anverso y reverso de sus tarjetas
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

        <div className="space-y-5 overflow-y-auto flex-1 pr-1">
          {/* SECTION 1: Editar Nombre del Mazo */}
          <div className="p-4 rounded-xl bg-stone-50/60 dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-800 space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
              Nombre del Mazo
            </label>
            <form onSubmit={handleRenameDeck} className="flex gap-2">
              <Input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Nombre del mazo..."
                className="py-1.5 px-3 rounded-lg text-xs font-medium flex-1"
              />
              <Button
                type="submit"
                disabled={isSavingName || !deckName.trim() || deckName.trim() === deck.name}
                className="px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5"
              >
                {nameSavedSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Guardado</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSavingName ? 'Guardando...' : 'Actualizar Nombre'}</span>
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* SECTION 2: Cartas adentro del mazo */}
          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>Tarjetas en este mazo</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 font-mono">
                    {notes.length}
                  </span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  Edita el Anverso y Reverso directamente en cada tarjeta y guarda los cambios
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddCard(!showAddCard)}
                  className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{showAddCard ? 'Cerrar creador' : 'Añadir tarjeta'}</span>
                </Button>
              </div>
            </div>

            {/* Quick Add Card Form */}
            {showAddCard && (
              <form
                onSubmit={handleCreateNewCard}
                className="p-4 rounded-xl bg-stone-50/80 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                    Nueva Tarjeta en {deck.name}
                  </span>
                  <select
                    value={newCardType}
                    onChange={(e) => setNewCardType(e.target.value)}
                    className="rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-stone-800 dark:text-zinc-200"
                  >
                    <option value="Basic">Básica</option>
                    <option value="Basic (and reversed card)">Invertida</option>
                    <option value="FC_TypeAnswer">Teclear Respuesta</option>
                    <option value="FC_Dictation">Dictado (Audio)</option>
                    <option value="FC_MultipleChoice">Opción Múltiple</option>
                    <option value="FC_ScrambledSentence">Ordenar Frase</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-zinc-400 mb-1">
                      {newCardType === 'FC_Dictation' ? 'Texto de Audio (a escuchar)' : 'Anverso (Pregunta / Frente)'}
                    </label>
                    <textarea
                      value={newCardFront}
                      onChange={(e) => setNewCardFront(e.target.value)}
                      placeholder={newCardType === 'FC_Dictation' ? 'Escribe lo que se escuchará...' : 'Escribe el anverso...'}
                      rows={2}
                      className="w-full rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  {newCardType !== 'FC_ScrambledSentence' && (
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-zinc-400 mb-1">
                        {newCardType === 'FC_Dictation' ? 'Pista o Traducción (opcional)' : 'Reverso (Respuesta)'}
                      </label>
                      <textarea
                        value={newCardBack}
                        onChange={(e) => setNewCardBack(e.target.value)}
                        placeholder={newCardType === 'FC_Dictation' ? 'Pista o traducción...' : 'Escribe el reverso...'}
                        rows={2}
                        className="w-full rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddCard(false)}
                    className="py-1 px-3 text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isAddingCard || !newCardFront.trim()}
                    className="py-1 px-3.5 text-xs font-medium"
                  >
                    {isAddingCard ? 'Guardando...' : 'Crear Tarjeta'}
                  </Button>
                </div>
              </form>
            )}

            {/* Search filter for cards */}
            {notes.length > 3 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar tarjetas por pregunta o respuesta..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-900 text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Notes list */}
            {isLoadingNotes ? (
              <div className="text-center py-10 text-stone-400 dark:text-zinc-500 text-xs">
                Cargando tarjetas del mazo...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-stone-200 dark:border-zinc-800 rounded-xl text-stone-400 dark:text-zinc-500 text-xs space-y-2">
                <p>No se encontraron tarjetas en este mazo con los criterios de búsqueda.</p>
                <Button
                  variant="secondary"
                  onClick={() => setShowAddCard(true)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Añadir la primera tarjeta
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {filteredNotes.map((note) => {
                  const frontKey = getCardFrontField(note);
                  const backKey = getCardBackField(note);
                  const edits = cardEdits[note.id] || note.fields;
                  const isSavingThis = savingCardId === note.id;
                  const isSavedThis = savedCardSuccess[note.id];

                  // Check if any field changed
                  const hasChanges = Object.keys(edits).some(
                    (k) => edits[k] !== note.fields[k]
                  );

                  return (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5 hover:border-stone-300 dark:hover:border-zinc-700 transition-colors shadow-2xs"
                    >
                      {/* Card Row Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getTypeBadge(note.note_type_name)}
                          <span className="text-[10px] font-mono text-stone-400 dark:text-zinc-500">
                            #{note.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {hasChanges && (
                            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 px-2 py-0.5 rounded-md">
                              Modificado
                            </span>
                          )}

                          <Button
                            type="button"
                            onClick={() => handleSaveCard(note)}
                            disabled={isSavingThis || !hasChanges}
                            className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1 ${
                              hasChanges ? '' : 'opacity-40'
                            }`}
                            title="Guardar cambios de esta tarjeta"
                          >
                            {isSavedThis ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-200" />
                                <span>Guardado</span>
                              </>
                            ) : (
                              <>
                                <Save className="h-3 w-3" />
                                <span>{isSavingThis ? '...' : 'Guardar'}</span>
                              </>
                            )}
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCard(note.id)}
                            className="p-1 rounded-md text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors pressable"
                            title="Eliminar esta tarjeta"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Anverso and Reverso Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-stone-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Anverso (Pregunta / Frente)
                          </label>
                          <textarea
                            value={edits[frontKey] ?? ''}
                            onChange={(e) => handleFieldChange(note.id, frontKey, e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3 py-1.5 text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>

                        {note.note_type_name !== 'FC_ScrambledSentence' && (
                          <div>
                            <label className="block text-[10px] font-semibold text-stone-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                              Reverso (Respuesta)
                            </label>
                            <textarea
                              value={edits[backKey] ?? ''}
                              onChange={(e) => handleFieldChange(note.id, backKey, e.target.value)}
                              rows={2}
                              className="w-full rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-3 py-1.5 text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                        )}
                      </div>

                      {/* Optional Distractors for Multiple Choice */}
                      {note.note_type_name === 'FC_MultipleChoice' && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDistractors((prev) => ({
                                ...prev,
                                [note.id]: !prev[note.id],
                              }))
                            }
                            className="text-[11px] font-medium text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 flex items-center gap-1 pressable"
                          >
                            <span>Distractores / Alternativas incorrectas</span>
                            {expandedDistractors[note.id] ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>

                          {expandedDistractors[note.id] && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                              {['WrongAnswer1', 'WrongAnswer2', 'WrongAnswer3'].map((wKey, idx) => (
                                <div key={wKey}>
                                  <label className="block text-[10px] text-stone-400 dark:text-zinc-500 mb-0.5">
                                    Opción {idx + 1}
                                  </label>
                                  <input
                                    type="text"
                                    value={edits[wKey] ?? ''}
                                    onChange={(e) => handleFieldChange(note.id, wKey, e.target.value)}
                                    className="w-full rounded-md border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-950/40 px-2 py-1 text-xs text-stone-800 dark:text-zinc-200"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions: Danger zone (Delete deck) on left, Close on right */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200/80 dark:border-zinc-800 shrink-0">
          <div>
            {onDeleteRequested && (
              <button
                type="button"
                onClick={() => onDeleteRequested(deck)}
                className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 pressable"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar este mazo</span>
              </button>
            )}
          </div>

          <Button variant="secondary" onClick={onClose} className="px-4 text-xs font-medium">
            Listo / Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
