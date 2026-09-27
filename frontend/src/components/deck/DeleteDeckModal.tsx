import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { DeckInfo } from '../../api/types';
import { deleteDeck } from '../../api/decks';

interface Props {
  deck: DeckInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteDeckModal({ deck, isOpen, onClose, onSuccess }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !deck) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteDeck(deck.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar el mazo');
      setIsDeleting(false);
    }
  };

  const totalCards = deck.card_count ?? (deck.new_count || 0) + (deck.learn_count || 0) + (deck.review_count || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 dark:bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 p-6 space-y-4">
        {/* Header with warning icon */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-900/40 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                Eliminar Mazo
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                Esta acción no se puede deshacer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors pressable"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Question body */}
        <div className="p-4 rounded-xl bg-stone-50/60 dark:bg-zinc-800/50 border border-stone-200/80 dark:border-zinc-800 space-y-1.5">
          <p className="text-xs font-medium text-stone-700 dark:text-zinc-300">
            ¿Estás seguro de que deseas eliminar el mazo <strong className="text-stone-950 dark:text-white font-semibold">"{deck.name}"</strong>?
          </p>
          <p className="text-[11px] text-stone-500 dark:text-zinc-400">
            Se eliminarán permanentemente el mazo y sus <span className="font-medium text-rose-600 dark:text-rose-400">{totalCards} tarjetas</span> asociadas.
          </p>
        </div>

        {/* Actions (Single confirmation as requested) */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-200/80 dark:border-zinc-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-1.5 text-xs font-medium"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-1.5 text-xs font-medium flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isDeleting ? 'Eliminando...' : 'Sí, eliminar mazo'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
