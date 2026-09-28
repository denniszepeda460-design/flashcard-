import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { DeckInfo } from '../api/types';
import { getCachedDecks } from '../lib/db';
import { useDeckStore } from '../stores/deckStore';
import { EditDeckModal } from '../components/deck/EditDeckModal';
import { DeleteDeckModal } from '../components/deck/DeleteDeckModal';
import { Play, Plus, Search, Trash2, ArrowLeft, Layers, Edit2 } from 'lucide-react';

export default function DeckView() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const numericDeckId = deckId ? parseInt(deckId, 10) : 0;

  const { decks, loadDecksAndStats } = useDeckStore();
  const [deck, setDeck] = useState<DeckInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadDeck = async () => {
    // 1. Mostrar de inmediato si ya está en el store o en IndexedDB (sin esperar 6s de red)
    const inStore = useDeckStore.getState().decks.find((d) => d.id === numericDeckId);
    if (inStore) {
      setDeck(inStore);
      setIsLoading(false);
    } else {
      try {
        const cached = await getCachedDecks();
        const found = cached.find((d) => d.id === numericDeckId);
        if (found) {
          setDeck(found);
          setIsLoading(false);
        }
      } catch (cacheErr) {
        console.warn('[DeckView] Error buscando mazo en IndexedDB:', cacheErr);
      }
    }

    // 2. Refrescar en segundo plano con el store unificado
    try {
      await loadDecksAndStats();
      const updated = useDeckStore.getState().decks.find((d) => d.id === numericDeckId);
      if (updated) {
        setDeck(updated);
      }
    } catch (err) {
      console.warn('[DeckView] Servidor inaccesible, conservando mazo en memoria/IndexedDB');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeck();
  }, [numericDeckId]);

  if (isLoading) {
    return <div className="text-center py-16 text-slate-400">Cargando mazo...</div>;
  }

  if (!deck) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold">Mazo no encontrado</h2>
        <Link to="/">
          <Button variant="secondary">Volver al inicio</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 transition-colors pressable"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Detalle del Mazo
            </span>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-stone-400 dark:text-zinc-500" />
              <span>{deck.name}</span>
            </h1>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors pressable"
            title="Editar mazo y tarjetas"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-lg text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors pressable"
            title="Eliminar mazo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden bg-white dark:bg-zinc-900">
        <CardHeader className="bg-stone-50/60 dark:bg-zinc-950/40 border-b border-stone-200/80 dark:border-zinc-800 pb-3">
          <CardTitle className="text-xs text-stone-500 dark:text-zinc-400 font-medium">
            Tarjetas pendientes de estudio
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-6 space-y-6">
          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {deck.new_count || 0}
              </div>
              <div className="text-xs font-medium text-stone-500 dark:text-zinc-400 mt-0.5">Nuevas</div>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {deck.learn_count || 0}
              </div>
              <div className="text-xs font-medium text-stone-500 dark:text-zinc-400 mt-0.5">Aprendiendo</div>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {deck.review_count || 0}
              </div>
              <div className="text-xs font-medium text-stone-500 dark:text-zinc-400 mt-0.5">A repasar</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <Link to={`/review/${deck.id}`} className="block">
              <Button size="lg" className="w-full text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
                <Play className="h-4 w-4 fill-current" />
                <span>Estudiar ahora</span>
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowEditModal(true)}
              className="w-full text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              <span>Editar mazo y tarjetas</span>
            </Button>

            <Link to={`/editor?deckId=${deck.id}`} className="block">
              <Button variant="secondary" size="lg" className="w-full text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Crear tarjeta en este mazo</span>
              </Button>
            </Link>
            <Link to={`/browser?deckId=${deck.id}`} className="block">
              <Button variant="ghost" className="w-full text-stone-500 dark:text-zinc-400 text-xs py-2 rounded-xl flex items-center justify-center gap-2">
                <Search className="h-3.5 w-3.5" />
                <span>Ver tarjetas de este mazo en el explorador</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Edit Deck & Cards Modal */}
      <EditDeckModal
        deck={deck}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={loadDeck}
        onDeleteRequested={() => {
          setShowEditModal(false);
          setShowDeleteModal(true);
        }}
      />

      {/* Delete Deck Modal (single confirmation) */}
      <DeleteDeckModal
        deck={deck}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => navigate('/')}
      />
    </div>
  );
}
