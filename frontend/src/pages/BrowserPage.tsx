import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Search, Trash2, Edit3, Plus, BookOpen } from 'lucide-react';
import { searchNotes, deleteNote } from '../api/notes';
import { fetchDecks } from '../api/decks';
import { NoteInfo, DeckInfo } from '../api/types';

export default function BrowserPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<number | undefined>(undefined);
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [notes, setNotes] = useState<NoteInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchDecks().then(setDecks).catch(console.error);
  }, []);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await searchNotes(query, selectedDeckId, 100, 0);
      setNotes(res.notes || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Error buscando notas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [query, selectedDeckId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadNotes();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadNotes]);

  const handleDelete = async (noteId: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta nota y sus tarjetas?')) {
      return;
    }
    setDeletingId(noteId);
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      alert('Error eliminando nota: ' + err);
    } finally {
      setDeletingId(null);
    }
  };

  const getFrontText = (note: NoteInfo) => {
    return (
      note.fields['Front'] ||
      note.fields['Question'] ||
      note.fields['Sentence'] ||
      Object.values(note.fields)[0] ||
      ''
    );
  };

  const getBackText = (note: NoteInfo) => {
    return (
      note.fields['Back'] ||
      note.fields['CorrectAnswer'] ||
      note.fields['Translation'] ||
      Object.values(note.fields)[1] ||
      ''
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
            Explorador de Tarjetas
          </h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            {total} {total === 1 ? 'tarjeta encontrada' : 'tarjetas encontradas'}
          </p>
        </div>
        <Link to="/editor">
          <Button className="flex items-center gap-1.5 text-xs font-medium">
            <Plus className="h-3.5 w-3.5" />
            <span>Crear Tarjeta</span>
          </Button>
        </Link>
      </div>

      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden bg-white dark:bg-zinc-900">
        <CardContent className="pt-5 space-y-4">
          {/* Search bar and Deck filter */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 py-2 rounded-xl text-xs font-medium"
                placeholder="Buscar por texto, etiqueta..."
              />
            </div>
            <select
              value={selectedDeckId ?? ''}
              onChange={(e) =>
                setSelectedDeckId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/40 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-stone-700 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos los mazos</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes Table */}
          <div className="rounded-xl border border-stone-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 dark:bg-zinc-900 text-stone-500 dark:text-zinc-400 font-semibold border-b border-stone-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 w-5/12 font-medium">Anverso / Pregunta</th>
                    <th className="px-4 py-3 w-5/12 font-medium">Reverso / Respuesta</th>
                    <th className="px-4 py-3 w-2/12 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/80">
                  {notes.map((note) => (
                    <tr
                      key={note.id}
                      className="hover:bg-stone-50/60 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-stone-800 dark:text-zinc-200">
                        <div
                          className="line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: getFrontText(note) }}
                        />
                        <div className="text-[10px] text-stone-400 dark:text-zinc-500 mt-1 flex items-center gap-1.5">
                          <span className="font-mono bg-stone-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            {note.note_type_name}
                          </span>
                          {note.tags && note.tags.length > 0 && (
                            <span className="text-blue-600 dark:text-blue-400 font-mono">
                              #{note.tags.join(' #')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-600 dark:text-zinc-400">
                        <div
                          className="line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: getBackText(note) }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => navigate(`/editor/${note.id}`)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors pressable"
                            title="Editar nota"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            disabled={deletingId === note.id}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors pressable"
                            title="Eliminar nota"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && notes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-stone-400 dark:text-zinc-500">
                        <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-30" />
                        No se encontraron tarjetas con los filtros actuales.
                      </td>
                    </tr>
                  )}
                  {isLoading && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-stone-400 dark:text-zinc-500">
                        Buscando tarjetas...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
