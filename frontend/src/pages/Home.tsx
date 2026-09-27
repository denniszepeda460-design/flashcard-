import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { fetchDecks, createDeck } from '../api/decks';
import { fetchTodayStats } from '../api/stats';
import { DeckInfo, TodayStats } from '../api/types';
import { cacheDecks, getCachedDecks } from '../lib/db';
import { StudyCalendar } from '../components/deck/StudyCalendar';
import { DeckCharts } from '../components/deck/DeckCharts';
import { CsvImportModal } from '../components/deck/CsvImportModal';
import { AiBatchModal } from '../components/deck/AiBatchModal';
import { EditDeckModal } from '../components/deck/EditDeckModal';
import { DeleteDeckModal } from '../components/deck/DeleteDeckModal';
import {
  Sparkles,
  Plus,
  Play,
  Layers,
  Upload,
  Download,
  BarChart3,
  Edit2,
  Trash2,
  FolderOpen,
} from 'lucide-react';

export default function Home() {
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [stats, setStats] = useState<TodayStats | null>(null);

  // Modals state
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<DeckInfo | null>(null);
  const [deletingDeck, setDeletingDeck] = useState<DeckInfo | null>(null);

  // Tab: 'mazos' | 'progreso'
  const [activeTab, setActiveTab] = useState<'mazos' | 'progreso'>('mazos');

  const loadData = async () => {
    try {
      const freshDecks = await fetchDecks();
      setDecks(freshDecks);
      await cacheDecks(freshDecks);
    } catch (err) {
      console.warn('Servidor inaccesible, cargando mazos desde IndexedDB...', err);
      try {
        const cached = await getCachedDecks();
        if (cached && cached.length > 0) {
          setDecks(cached);
        }
      } catch (cacheErr) {
        console.error('Error cargando mazos de IndexedDB:', cacheErr);
      }
    }

    try {
      const freshStats = await fetchTodayStats();
      setStats(freshStats);
    } catch {
      // Estadísticas no disponibles offline
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await createDeck(newDeckName.trim());
      setNewDeckName('');
      setShowNewDeckModal(false);
      loadData();
    } catch (err) {
      alert('Error creando mazo: ' + err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportCsv = () => {
    window.open('/api/notes/export', '_blank');
  };

  const totalDue = decks.reduce((acc, d) => acc + (d.review_count || 0) + (d.learn_count || 0), 0);
  const totalCards = decks.reduce((acc, d) => acc + (d.card_count || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. Header with clear hierarchy, zero marketing fluff */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-stone-200/80 dark:border-zinc-800/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
            Tus Mazos
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1 font-medium">
            {totalDue > 0 ? `${totalDue} tarjetas para repasar hoy` : 'Todas las tarjetas al día'}
            {stats && stats.streak_days > 0 && ` · ${stats.streak_days} días de racha`}
            {stats && stats.studied_today > 0 && ` · ${stats.studied_today} estudiadas`}
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowAiModal(true)}
            className="rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Crear con IA</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowCsvModal(true)}
            className="rounded-xl text-xs font-semibold flex items-center gap-1.5"
            title="Importar mazo en formato CSV"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Importar</span>
          </Button>

          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={totalCards === 0}
            className="rounded-xl text-xs font-semibold flex items-center gap-1.5"
            title="Exportar tarjetas en CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowNewDeckModal(true)}
            className="rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nuevo Mazo</span>
          </Button>
        </div>
      </div>

      {/* 2. Navigation Tabs (Mazos / Progreso) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('mazos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
            activeTab === 'mazos'
              ? 'bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          Mazos ({decks.length})
        </button>
        <button
          onClick={() => setActiveTab('progreso')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
            activeTab === 'progreso'
              ? 'bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          Calendario y Progreso
        </button>
      </div>

      {/* 3. Tab: Mazos Grid */}
      {activeTab === 'mazos' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => {
              const due = (deck.review_count || 0) + (deck.learn_count || 0);
              return (
                <Card
                  key={deck.id}
                  className="flex flex-col justify-between border border-stone-200/90 dark:border-zinc-800 rounded-2xl hover:border-stone-300 dark:hover:border-zinc-700 transition-all duration-150 bg-white dark:bg-zinc-900 shadow-xs group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold text-stone-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                        {deck.name}
                      </CardTitle>
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingDeck(deck);
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Editar mazo y tarjetas"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingDeck(deck);
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Eliminar mazo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status badges */}
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 text-[11px]">
                        {deck.new_count || 0} nuevas
                      </span>
                      {due > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-semibold text-[11px]">
                          {due} a repasar
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-400 text-[11px]">
                          Al día
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Link to={`/deck/${deck.id}`} className="flex-1">
                        <Button variant="secondary" className="w-full text-xs font-semibold h-9 rounded-xl">
                          Ver
                        </Button>
                      </Link>
                      <Link to={`/review/${deck.id}`} className="flex-1">
                        <Button className="w-full text-xs font-semibold h-9 rounded-xl flex items-center justify-center gap-1.5">
                          <Play className="h-3 w-3 fill-current" />
                          <span>Estudiar</span>
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {decks.length === 0 && (
              <div className="col-span-full text-center py-14 px-4 border border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <FolderOpen className="h-8 w-8 mx-auto text-stone-300 dark:text-zinc-600" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-stone-700 dark:text-zinc-300">
                    No hay mazos en tu colección
                  </h3>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button onClick={() => setShowNewDeckModal(true)} className="text-xs rounded-xl">
                    Crear mazo
                  </Button>
                  <Button variant="secondary" onClick={() => setShowCsvModal(true)} className="text-xs rounded-xl">
                    Importar CSV
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Tab: Analytics */}
      {activeTab === 'progreso' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1">
              <StudyCalendar
                streakDays={stats?.streak_days || 0}
                studiedToday={stats?.studied_today || 0}
              />
            </div>

            <div className="lg:col-span-2">
              <DeckCharts
                decks={decks}
                studiedToday={stats?.studied_today || 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* New Deck Modal */}
      {showNewDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-stone-200 dark:border-zinc-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">Nuevo Mazo</h3>
            <form onSubmit={handleCreateDeck} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400 mb-1">
                  Nombre del mazo
                </label>
                <Input
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="ej: Vocabulario B2"
                  autoFocus
                  className="rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewDeckModal(false)}
                  className="rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!newDeckName.trim() || isCreating}
                  className="rounded-xl text-xs font-bold"
                >
                  {isCreating ? 'Creando...' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        decks={decks}
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onSuccess={loadData}
      />

      {/* AI Batch Modal */}
      <AiBatchModal
        decks={decks}
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onSuccess={loadData}
      />

      {/* Edit Deck & Cards Modal */}
      <EditDeckModal
        deck={editingDeck}
        isOpen={!!editingDeck}
        onClose={() => setEditingDeck(null)}
        onSuccess={loadData}
        onDeleteRequested={(deck) => {
          setEditingDeck(null);
          setDeletingDeck(deck);
        }}
      />

      {/* Delete Deck Single-Confirmation Modal */}
      <DeleteDeckModal
        deck={deletingDeck}
        isOpen={!!deletingDeck}
        onClose={() => setDeletingDeck(null)}
        onSuccess={loadData}
      />
    </div>
  );
}
