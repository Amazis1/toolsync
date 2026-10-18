import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ToolList from '../components/tools/ToolList'
import ToolForm from '../components/tools/ToolForm'
import ToolQuickFilters from '../components/tools/ToolQuickFilters'
import ConfirmDialog from '../components/ConfirmDialog'
import LendModal from '../components/movements/LendModal'
import ReturnModal from '../components/movements/ReturnModal'
import { KeyboardIcon, PencilIcon, XIcon } from '../components/icons'
import type { ToastVariant } from '../lib/useToasts'
import {
  createTool,
  deleteTool,
  getPlants,
  getToolTypes,
  getTools,
  setToolFavorite,
  updateTool,
} from '../api/tools'
import type { Plant, Tool, ToolInput, ToolSortKey, ToolType } from '../api/types'
import type { SerialArticle } from '../types/serial-article'
import type { SparePart } from '../types/spare-part'
import type { DataSheet } from '../types/data-sheet'
import {
  DEFAULT_TOOL_QUERY,
  nextSort,
  pageCount,
  readToolQuery,
  toApiQuery,
  withPageReset,
  writeToolQuery,
} from '../lib/toolQuery'
import type { ToolQuery } from '../lib/toolQuery'
import { toolLabel } from '../lib/toolLabel'

interface ToolsProps {
  /** Auftrag vom Header-Button „+ Anlegen“: eindeutiges Token, null = keiner */
  createRequest?: number | null
  /** Wird aufgerufen, sobald der Auftrag das Formular geöffnet hat. */
  onCreateRequestHandled?: () => void
  /**
   * Auftrag aus dem Serienartikel-Bereich: Es gibt **einen** Anlegen-Knopf, und
   * das Formular öffnet sich mit dem Reiter „Serienartikel“ (DEC-056 Punkt 5).
   * `article: null` = anlegen, sonst bearbeiten.
   */
  serialRequest?: { token: number; article: SerialArticle | null } | null
  /** Der Auftrag ist verbraucht. */
  onSerialRequestHandled?: () => void
  /** Ein Serienartikel wurde gespeichert. */
  onSerialArticleSaved?: (article: SerialArticle, mode: 'create' | 'edit') => void
  /** Das Formular wurde geschlossen, während es für Serienartikel offen war. */
  onSerialFormClosed?: () => void
  /**
   * Auftrag aus dem Ersatzteil-Bereich (DEC-064/DEC-066): dasselbe Muster wie
   * beim Serienartikel – **ein** Anlegen-Knopf, Reiter „Ersatzteil“ offen.
   * `part: null` = anlegen, sonst bearbeiten.
   */
  sparePartRequest?: { token: number; part: SparePart | null } | null
  /** Der Auftrag ist verbraucht. */
  onSparePartRequestHandled?: () => void
  /** Ein Ersatzteil wurde gespeichert. */
  onSparePartSaved?: (part: SparePart, mode: 'create' | 'edit') => void
  /** Das Formular wurde geschlossen, während es für Ersatzteile offen war. */
  onSpareFormClosed?: () => void
  /**
   * Auftrag aus dem Datenblatt-Bereich (DEC-065): dasselbe Muster wie beim
   * Serienartikel – **ein** Anlegen-Knopf, Reiter „Datenblatt" offen.
   * `sheet: null` = anlegen, sonst bearbeiten.
   */
  dataSheetRequest?: { token: number; sheet: DataSheet | null } | null
  /** Der Auftrag ist verbraucht. */
  onDataSheetRequestHandled?: () => void
  /** Ein Datenblatt wurde gespeichert. */
  onDataSheetSaved?: (sheet: DataSheet, mode: 'create' | 'edit') => void
  /** Das Formular wurde geschlossen, während es für Datenblätter offen war. */
  onDataSheetFormClosed?: () => void
  /**
   * Auftrag aus der Werkzeugzeile: Datenblätter **dieses** Werkzeugs zeigen
   * (DEC-065 Punkt 10). Die App wechselt in den Bereich und filtert dort.
   */
  onOpenDataSheets?: (tool: Tool) => void
  /**
   * Rückmeldung anzeigen – **eine** Quelle für alles, was dieses Formular
   * meldet. Der Toast gehört der App, weil diese Liste beim Speichern
   * verschwindet (Karte zu → Reiterwechsel) und ihre eigene Toast-Ebene damit
   * mitnähme (siehe `onNotify` in `App.tsx`).
   */
  onNotify?: (variant: ToastVariant, title: string, message?: string) => void
}

/** Wartezeit zwischen letztem Tastendruck und Abfrage (wie im Formular: 400 ms). */
const SEARCH_DEBOUNCE_MS = 350

export default function Tools({
  createRequest,
  onCreateRequestHandled,
  serialRequest,
  onSerialRequestHandled,
  onSerialArticleSaved,
  onSerialFormClosed,
  sparePartRequest,
  onSparePartRequestHandled,
  onSparePartSaved,
  onSpareFormClosed,
  onOpenDataSheets,
  dataSheetRequest,
  onDataSheetRequestHandled,
  onDataSheetSaved,
  onDataSheetFormClosed,
  onNotify,
}: ToolsProps) {
  // Filter, Sortierung und Seite: EINE Quelle für Abfrage, Adresszeile und
  // Oberfläche. Startwert ist die Adresszeile, damit ein Neuladen die Ansicht
  // behält und ein Link auf eine gefilterte Liste funktioniert.
  const [query, setQuery] = useState<ToolQuery>(() => readToolQuery(window.location.search))
  const [searchText, setSearchText] = useState(query.q)

  const [tools, setTools] = useState<Tool[]>([])
  const [total, setTotal] = useState(0)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Rückmeldungen zu Aktionen laufen als Toast (unten rechts), nicht als
  // Meldung im Block: sie schieben die Liste nicht nach unten und werden nicht
  // beim Blättern übersehen. **Eine** Quelle: `showToast` kommt aus der App,
  // damit dieselbe Meldung auch dann steht, wenn diese Seite verschwindet –
  // beim Speichern aus dem Anlege-Formular ist genau das der Fall. Die Listen-
  // Fehler (`listError`, `actionError`) bleiben bewusst im Block: sie gehören
  // zur Tabelle und müssen stehen bleiben, bis der Benutzer handelt.
  const showToast = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      onNotify?.(variant, title, message)
    },
    [onNotify],
  )

  const [plants, setPlants] = useState<Plant[]>([])
  const [toolTypes, setToolTypes] = useState<ToolType[]>([])

  const [busyFavoriteId, setBusyFavoriteId] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // „Lädt gerade" wird abgeleitet und nicht gesetzt: die Abfrage ist fertig,
  // sobald genau diese Anfrage beantwortet wurde. Damit kann der Ladezustand
  // nicht mit der angezeigten Seite auseinanderlaufen.
  const apiQuery = useMemo(() => toApiQuery(query), [query])
  const requestKey = useMemo(
    () => `${JSON.stringify(apiQuery)}|${reloadKey}`,
    [apiQuery, reloadKey],
  )
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== requestKey

  // Dialoge
  const [showForm, setShowForm] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  // Läuft das Formular für einen Serienartikel? Dann ist der Reiter „Serienartikel“
  // aktiv und der Zurück-Weg führt in den Serienartikel-Bereich.
  const [serialMode, setSerialMode] = useState<'create' | 'edit' | null>(null)
  const [editingSerialArticle, setEditingSerialArticle] = useState<SerialArticle | null>(null)
  // Dasselbe für den Ersatzteil-Bereich (DEC-064): Reiter „Ersatzteil" aktiv,
  // der Zurück-Weg führt in die Ersatzteil-Liste.
  const [spareMode, setSpareMode] = useState<'create' | 'edit' | null>(null)
  const [editingSparePart, setEditingSparePart] = useState<SparePart | null>(null)
  // Und dasselbe für den Datenblatt-Bereich (DEC-065).
  const [sheetMode, setSheetMode] = useState<'create' | 'edit' | null>(null)
  const [editingDataSheet, setEditingDataSheet] = useState<DataSheet | null>(null)
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [lendTool, setLendTool] = useState<Tool | null>(null)
  // Rückgabe (DEC-078): ein Werkzeug wird **einzeln** über das Zeilenmenü
  // zurückgegeben – eigener Dialog, damit der Vorgang klar erkennbar ist.
  const [returningTool, setReturningTool] = useState<Tool | null>(null)

  // Welche Art von Verlaufseintrag die nächste Änderung erzeugt: Tippen
  // ersetzt den Eintrag (sonst stünde nach „Stempel“ viermal im Verlauf),
  // ein Klick auf Filter, Sortierung oder Seite legt einen Eintrag an.
  const historyMode = useRef<'push' | 'replace'>('replace')
  const requestId = useRef(0)

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  /**
   * Immer die **aktuelle** `closeForm`-Funktion, ohne sie in die
   * Abhängigkeiten des Esc-Zuhörers zu holen. Ohne diesen Umweg würde der
   * Zuhörer bei jedem Zustandswechsel ab- und wieder eingehängt – er soll nur
   * einmal hängen, solange das Formular offen ist.
   */
  const closeFormRef = useRef<() => void>(() => {})

  /** Filter/Sortierung ändern – setzt auf Seite 1 zurück und legt einen Verlaufseintrag an. */
  const changeQuery = useCallback((patch: Partial<ToolQuery>) => {
    historyMode.current = 'push'
    setQuery((prev) => withPageReset({ ...prev, ...patch }))
  }, [])

  const goToPage = useCallback((page: number) => {
    historyMode.current = 'push'
    setQuery((prev) => ({ ...prev, page }))
  }, [])

  const changePageSize = useCallback((pageSize: number) => {
    historyMode.current = 'push'
    setQuery((prev) => ({ ...prev, pageSize, page: 1 }))
  }, [])

  const handleSort = useCallback((key: ToolSortKey) => {
    historyMode.current = 'push'
    setQuery((prev) => ({ ...prev, ...nextSort(prev, key) }))
  }, [])

  const resetFilters = useCallback(() => {
    historyMode.current = 'push'
    setSearchText('')
    setQuery((prev) => ({ ...DEFAULT_TOOL_QUERY, pageSize: prev.pageSize }))
  }, [])

  // Stammdaten für die Filter einmal laden (Werke und Werkzeugtypen).
  useEffect(() => {
    let cancelled = false
    Promise.all([getPlants(), getToolTypes()])
      .then(([plantList, typeList]) => {
        if (cancelled) return
        setPlants(plantList)
        setToolTypes(typeList)
      })
      .catch(() => {
        // Ohne Stammdaten fehlen nur die beiden Dropdowns – die Liste selbst
        // bleibt nutzbar, deshalb keine Fehlermeldung.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Suche erst nach dem letzten Tastendruck abschicken. Der Vergleich mit
  // query.q verhindert, dass der Timer eine bereits übernommene Suche erneut
  // abschickt (und dass eine Zurück-Taste die Eingabe überschreibt).
  useEffect(() => {
    if (searchText.trim() === query.q.trim()) return
    const handle = setTimeout(() => {
      historyMode.current = 'replace'
      setQuery((prev) => withPageReset({ ...prev, q: searchText }))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchText, query.q])

  // Adresszeile mitführen: die Ansicht ist damit teilbar und übersteht Reload.
  useEffect(() => {
    const params = writeToolQuery(query)
    const url = `${window.location.pathname}${params ? `?${params}` : ''}`
    const current = `${window.location.pathname}${window.location.search}`
    if (url === current) return
    if (historyMode.current === 'push') {
      window.history.pushState({}, '', url)
    } else {
      window.history.replaceState({}, '', url)
    }
  }, [query])

  // Zurück-Taste: Zustand aus der Adresszeile zurückholen.
  useEffect(() => {
    function handlePopState() {
      const next = readToolQuery(window.location.search)
      setQuery(next)
      setSearchText(next.q)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Liste laden. Die alten Zeilen bleiben während des Ladens stehen, damit
  // die Tabelle beim Blättern nicht springt.
  useEffect(() => {
    let cancelled = false
    const id = ++requestId.current

    getTools(apiQuery)
      .then((page) => {
        if (cancelled || id !== requestId.current) return
        setTools(page.items)
        setTotal(page.total)
        setListError(null)
        // Leere Seite nach einem Löschen oder einer engeren Auswahl: auf die
        // letzte tatsächlich vorhandene Seite wechseln, statt eine leere
        // Tabelle zu zeigen.
        if (page.items.length === 0 && page.total > 0 && apiQuery.skip) {
          const lastPage = pageCount(page.total, page.limit)
          setQuery((prev) => ({ ...prev, page: Math.min(prev.page, lastPage) }))
        }
      })
      .catch((e: unknown) => {
        if (cancelled || id !== requestId.current) return
        setListError(
          e instanceof Error
            ? e.message
            : 'Werkzeuge konnten nicht geladen werden. Lade die Seite neu.',
        )
        setTools([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled && id === requestId.current) setLoadedKey(requestKey)
      })

    return () => {
      cancelled = true
    }
  }, [apiQuery, requestKey])

  /** Favorit umschalten: sofort sichtbar, bei einem Fehler wieder zurück. */
  async function toggleFavorite(tool: Tool) {
    const next = !tool.is_favorite
    setBusyFavoriteId(tool.id)
    setActionError(null)
    setTools((prev) =>
      prev.map((entry) => (entry.id === tool.id ? { ...entry, is_favorite: next } : entry)),
    )

    try {
      await setToolFavorite(tool.id, next)
      // Bei „Nur Favoriten“ fällt die Zeile nach dem Entfernen aus der Ansicht.
      if (query.favoritesOnly && !next) {
        setTools((prev) => prev.filter((entry) => entry.id !== tool.id))
        setTotal((value) => Math.max(0, value - 1))
      }
    } catch (e) {
      setTools((prev) =>
        prev.map((entry) =>
          entry.id === tool.id ? { ...entry, is_favorite: !next } : entry,
        ),
      )
      setActionError(
        e instanceof Error
          ? e.message
          : 'Der Favorit konnte nicht gespeichert werden. Versuche es erneut.',
      )
    } finally {
      setBusyFavoriteId(null)
    }
  }

  async function confirmDelete() {
    if (!toolToDelete) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteTool(toolToDelete.id)
      showToast('success', `Werkzeug „${toolLabel(toolToDelete.tool_id)}“ gelöscht`)
      setToolToDelete(null)
      reload()
    } catch (e) {
      setToolToDelete(null)
      setActionError(
        e instanceof Error
          ? e.message
          : 'Das Werkzeug konnte nicht gelöscht werden. Lade die Liste neu.',
      )
    } finally {
      setDeleting(false)
    }
  }

  function openCreateForm() {
    setEditingTool(null)
    setEditingSerialArticle(null)
    setSerialMode(null)
    setEditingSparePart(null)
    setSpareMode(null)
    setEditingDataSheet(null)
    setSheetMode(null)
    setShowForm(true)
  }

  function openEditForm(tool: Tool) {
    setEditingTool(tool)
    setEditingSerialArticle(null)
    setSerialMode(null)
    setEditingSparePart(null)
    setSpareMode(null)
    setEditingDataSheet(null)
    setSheetMode(null)
    setShowForm(true)
  }

  function closeForm() {
    const wasSerial = serialMode !== null
    const wasSpare = spareMode !== null
    const wasSheet = sheetMode !== null
    setShowForm(false)
    setEditingTool(null)
    setEditingSerialArticle(null)
    setSerialMode(null)
    setEditingSparePart(null)
    setSpareMode(null)
    setEditingDataSheet(null)
    setSheetMode(null)
    // Aus dem Serienartikel-Bereich geöffnet: dorthin zurück und die Liste dort
    // aktualisieren (der Reiter „Werkzeuge“ wäre der falsche Ort).
    if (wasSerial) onSerialFormClosed?.()
    // Dasselbe für den Ersatzteil-Bereich.
    if (wasSpare) onSpareFormClosed?.()
    // Und für den Datenblatt-Bereich.
    if (wasSheet) onDataSheetFormClosed?.()
  }

  // Die jeweils aktuelle `closeForm` für den Esc-Zuhörer bereithalten (siehe
  // `closeFormRef`). Die Zuweisung läuft in einem Effekt und nicht während des
  // Renderns – ein Ref-Schreibzugriff beim Rendern ist nicht erlaubt.
  useEffect(() => {
    closeFormRef.current = closeForm
  })

  /**
   * Serienartikel gespeichert: Liste aktualisieren, beim Bearbeiten zurück in den
   * Serienartikel-Bereich. Die Meldung an den Benutzer kommt vom Formular selbst
   * (`onNotify`) – es weiß, welcher Satz stimmt, und überlebt in der App.
   */
  function handleSerialArticleSaved(article: SerialArticle) {
    const mode = serialMode ?? 'create'
    onSerialArticleSaved?.(article, mode)
    if (mode === 'edit') closeForm()
  }

  /**
   * Ersatzteil gespeichert: Liste aktualisieren, beim Bearbeiten zurück in den
   * Ersatzteil-Bereich (dasselbe Muster wie beim Serienartikel).
   */
  function handleSparePartSaved(part: SparePart) {
    const mode = spareMode ?? 'create'
    onSparePartSaved?.(part, mode)
    if (mode === 'edit') closeForm()
  }

  /**
   * Datenblatt gespeichert: Liste aktualisieren, beim Bearbeiten zurück in den
   * Datenblatt-Bereich (dasselbe Muster wie bei Serienartikel und Ersatzteil).
   */
  function handleDataSheetSaved(sheet: DataSheet) {
    const mode = sheetMode ?? 'create'
    onDataSheetSaved?.(sheet, mode)
    if (mode === 'edit') closeForm()
  }

  // Der Auftrag ist eine Einmal-Aufforderung: er kommt als eindeutiges Token,
  // wird beim Öffnen verbraucht (der Aufrufer setzt ihn auf null) und kann
  // deshalb kein zweites Mal feuern. Sonst würde jedes neue Einhängen dieser
  // Liste (Tab-Wechsel, Rückkehr aus dem Admin-Panel) das Anlegen-Formular von
  // selbst wieder aufklappen.
  useEffect(() => {
    if (createRequest == null) return
    // Der Auftrag kommt von außen (Klick auf „+ Anlegen“ im Header), das
    // Formular gehört aber hierher – der Effekt läuft genau einmal je Token.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCreateForm()
    onCreateRequestHandled?.()
  }, [createRequest, onCreateRequestHandled])

  // Derselbe Einmal-Auftrag aus dem Serienartikel-Bereich: Formular öffnen,
  // Reiter „Serienartikel“ zeigen, Artikel (falls vorhanden) laden.
  useEffect(() => {
    if (serialRequest == null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingTool(null)
    setEditingSerialArticle(serialRequest.article)
    setSerialMode(serialRequest.article ? 'edit' : 'create')
    setShowForm(true)
    onSerialRequestHandled?.()
  }, [serialRequest, onSerialRequestHandled])

  // Derselbe Einmal-Auftrag aus dem Ersatzteil-Bereich: Formular öffnen, Reiter
  // „Ersatzteil“ zeigen, Teil (falls vorhanden) laden.
  useEffect(() => {
    if (sparePartRequest == null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingTool(null)
    setEditingSerialArticle(null)
    setSerialMode(null)
    setEditingSparePart(sparePartRequest.part)
    setSpareMode(sparePartRequest.part ? 'edit' : 'create')
    setShowForm(true)
    onSparePartRequestHandled?.()
  }, [sparePartRequest, onSparePartRequestHandled])

  // Derselbe Einmal-Auftrag aus dem Datenblatt-Bereich: Formular öffnen, Reiter
  // „Datenblatt“ zeigen, Datensatz (falls vorhanden) laden.
  useEffect(() => {
    if (dataSheetRequest == null) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingTool(null)
    setEditingSerialArticle(null)
    setSerialMode(null)
    setEditingSparePart(null)
    setSpareMode(null)
    setEditingDataSheet(dataSheetRequest.sheet)
    setSheetMode(dataSheetRequest.sheet ? 'edit' : 'create')
    setShowForm(true)
    onDataSheetRequestHandled?.()
  }, [dataSheetRequest, onDataSheetRequestHandled])

  async function handleSave(data: ToolInput): Promise<void> {
    if (editingTool) {
      await updateTool(editingTool.id, data)
      showToast('success', `Werkzeug „${toolLabel(data.tool_id)}“ gespeichert`)
    } else {
      await createTool(data)
      showToast('success', `Werkzeug „${toolLabel(data.tool_id)}“ angelegt`)
    }
    reload()
    closeForm()
  }

  /**
   * `Esc` schließt das Anlege-Formular – wie „Zurück" und „Abbrechen".
   *
   * Der Zuhörer sitzt am `document`, weil der Fokus nach dem Speichern oder
   * Klicken irgendwo im Formular steht und die Karte selbst kein Fokusziel ist.
   * Er wird **nur** eingehängt, solange das Formular offen ist: sonst würde Esc
   * auch die Liste schließen, die gar nichts zu schließen hat.
   */
  useEffect(() => {
    if (!showForm) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      // Ein offener Dialog (z. B. „Löschen bestätigen") hat Vorrang: dort
      // schließt Esc die Rückfrage, nicht das ganze Formular.
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      closeFormRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showForm])

  // Anlegen-Formular als .tool-form-card – inline statt Modal, wie in test.html.
  // Der Filterzustand bleibt dabei erhalten: er liegt nicht in der Liste,
  // sondern hier – und dieser Zustand überlebt das Formular.
  if (showForm) {
    return (
      <div className="tool-form-card rounded-2xl p-4 shadow-xs">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/40">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900">
              {/* Dasselbe Icon wie der Reiter „Werkzeug" (.ui-tabs) – Karte und
                  Reiterleiste zeigen damit dasselbe Zeichen. */}
              <PencilIcon className="h-4 w-4 shrink-0 text-teal-700" />
              <span className="truncate">
                {editingTool || editingSerialArticle || editingSparePart || editingDataSheet
                  ? 'Bearbeiten'
                  : 'Anlegen'}
              </span>
            </h2>

            <div className="flex shrink-0 items-center gap-2">
              {/* Hinweis auf die Tastatur: sichtbar, aber leise. Es ist keine
                  Aktion, deshalb kein Knopf, sondern ein Abzeichen. `ui-badge-lg`
                  gibt ihm die Größe, die neben „Zurück" auffällt; die
                  Icon-Größe kommt aus der Klasse (index.css) und nicht aus einer
                  Tailwind-Klasse – sonst überschriebe `h-3.5 w-3.5` sie. */}
              <span
                className="ui-badge ui-badge-lg ui-badge-neutral hidden sm:inline-flex"
                title="Mit der Esc-Taste schließen"
              >
                <KeyboardIcon />
                Esc
              </span>
              <button
                type="button"
                onClick={closeForm}
                className="ui-btn ui-btn-secondary ui-btn-sm"
              >
                <XIcon className="h-3.5 w-3.5" />
                Zurück
              </button>
            </div>
          </div>

          <ToolForm
            initial={editingTool}
            onSave={handleSave}
            onClose={closeForm}
            initialSubTab={
              serialMode !== null
                ? 'series'
                : spareMode !== null
                  ? 'spare'
                  : sheetMode !== null
                    ? 'sheet'
                    : undefined
            }
            initialSerialArticle={editingSerialArticle}
            onSerialArticleSaved={handleSerialArticleSaved}
            initialSparePart={editingSparePart}
            onSparePartSaved={handleSparePartSaved}
            initialDataSheet={editingDataSheet}
            prefillDataSheetToolId={editingTool?.tool_id ?? null}
            onDataSheetSaved={handleDataSheetSaved}
            onNotify={onNotify}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-content-block rounded-2xl p-5 shadow-xs space-y-4">
      {/* Kopfzeile der Liste: Überschrift links, Schnellfilter rechts.
          Kategorie (Kontrollkästchen), Werk (Radio) und Favoriten sitzen hier,
          weil sie die Ansicht grob vorprägen – Suche und Detailfilter stehen
          darunter in der Filterleiste. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-base font-bold text-slate-900">Werkzeuge</h2>
        <ToolQuickFilters
          query={query}
          plants={plants}
          onQueryChange={changeQuery}
          onReset={resetFilters}
        />
      </div>

      {listError && (
        <div className="ui-alert ui-alert-error">
          <span aria-hidden="true">×</span>
          <div>{listError}</div>
        </div>
      )}

      {actionError && (
        <div className="ui-alert ui-alert-error">
          <span aria-hidden="true">×</span>
          <div>{actionError}</div>
        </div>
      )}

      <ToolList
        query={query}
        searchText={searchText}
        tools={tools}
        total={total}
        loading={loading}
        busyFavoriteId={busyFavoriteId}
        toolTypes={toolTypes}
        onSearchTextChange={setSearchText}
        onQueryChange={changeQuery}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        onResetFilters={resetFilters}
        onSort={handleSort}
        onToggleFavorite={toggleFavorite}
        onEdit={openEditForm}
        onDelete={setToolToDelete}
        onLend={setLendTool}
        onReturn={setReturningTool}
        onOpenDataSheets={(tool) => onOpenDataSheets?.(tool)}
        onCreate={openCreateForm}
      />

      {toolToDelete && (
        <ConfirmDialog
          title={`Werkzeug „${toolLabel(toolToDelete.tool_id)}“ löschen?`}
          description="Das Werkzeug wird endgültig entfernt. Das lässt sich nicht rückgängig machen."
          confirmLabel="Werkzeug löschen"
          busyLabel="Wird gelöscht …"
          busy={deleting}
          onConfirm={() => { void confirmDelete() }}
          onCancel={() => setToolToDelete(null)}
        />
      )}

      {lendTool && (
        <LendModal
          tool={lendTool}
          onClose={() => setLendTool(null)}
          onSuccess={() => {
            showToast('success', `Werkzeug „${toolLabel(lendTool.tool_id)}“ ausgeliehen`)
            setLendTool(null)
            reload()
          }}
        />
      )}

      {returningTool && (
        <ReturnModal
          tool={returningTool}
          onClose={() => setReturningTool(null)}
          onSuccess={() => {
            showToast(
              'success',
              `Werkzeug „${toolLabel(returningTool.tool_id)}“ zurückgegeben`,
            )
            setReturningTool(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
