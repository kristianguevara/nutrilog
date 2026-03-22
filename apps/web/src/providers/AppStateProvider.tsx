import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  FoodLogEntry,
  FoodLogEntryDraft,
  SuggestionInputSnapshot,
  SuggestionItem,
  UserProfile,
  UserProfileDraft,
} from "@nutrilog/shared";
import { suggestionSnapshotSchema, userProfileSchema } from "@nutrilog/shared";
import { createFoodEntry, updateFoodEntry } from "@/lib/entryFactory.js";
import {
  clearPersistedState,
  createEmptyState,
  loadPersistedState,
  savePersistedState,
  type PersistedState,
} from "@/services/storageService.js";

interface AppStateValue {
  ready: boolean;
  profile: UserProfile | null;
  entries: FoodLogEntry[];
  suggestionHistory: PersistedState["suggestionHistory"];
  storageError: string | null;
  loadError: string | null;
  saveProfile: (draft: UserProfileDraft) => void;
  updateProfile: (draft: UserProfileDraft) => void;
  addEntry: (draft: FoodLogEntryDraft) => void;
  updateEntry: (id: string, draft: FoodLogEntryDraft) => void;
  deleteEntry: (id: string) => void;
  addEntries: (drafts: FoodLogEntryDraft[]) => void;
  recordSuggestionSnapshot: (input: {
    date: string;
    suggestions: SuggestionItem[];
    inputSnapshot: SuggestionInputSnapshot;
  }) => void;
  resetAll: () => void;
  clearErrors: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function persist(next: PersistedState): { ok: true } | { ok: false; error: string } {
  return savePersistedState(next);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PersistedState>(() => createEmptyState());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPersistedState();
    if (!loaded.ok) {
      setLoadError(loaded.error);
      setState(createEmptyState());
    } else {
      setState(loaded.data);
    }
    setReady(true);
  }, []);

  const saveProfile = useCallback((draft: UserProfileDraft) => {
    setState((prev) => {
      const t = nowIso();
      const profile = userProfileSchema.parse({
        ...draft,
        createdAt: t,
        updatedAt: t,
      });
      const next: PersistedState = { ...prev, profile };
      const result = persist(next);
      if (!result.ok) setStorageError(result.error);
      else setStorageError(null);
      return next;
    });
  }, []);

  const updateProfile = useCallback((draft: UserProfileDraft) => {
    setState((prev) => {
      if (!prev.profile) return prev;
      const profile = userProfileSchema.parse({
        ...prev.profile,
        ...draft,
        updatedAt: nowIso(),
      });
      const next: PersistedState = { ...prev, profile };
      const result = persist(next);
      if (!result.ok) setStorageError(result.error);
      else setStorageError(null);
      return next;
    });
  }, []);

  const addEntry = useCallback((draft: FoodLogEntryDraft) => {
    setState((prev) => {
      const entry = createFoodEntry(draft);
      const next: PersistedState = { ...prev, entries: [entry, ...prev.entries] };
      const result = persist(next);
      if (!result.ok) setStorageError(result.error);
      else setStorageError(null);
      return next;
    });
  }, []);

  const addEntries = useCallback((drafts: FoodLogEntryDraft[]) => {
    setState((prev) => {
      const created = drafts.map((d) => createFoodEntry(d));
      const next: PersistedState = { ...prev, entries: [...created, ...prev.entries] };
      const result = persist(next);
      if (!result.ok) setStorageError(result.error);
      else setStorageError(null);
      return next;
    });
  }, []);

  const updateEntry = useCallback((id: string, draft: FoodLogEntryDraft) => {
    setState((prev) => {
      const existing = prev.entries.find((e) => e.id === id);
      if (!existing) return prev;
      const entry = updateFoodEntry(existing, draft);
      const next: PersistedState = {
        ...prev,
        entries: prev.entries.map((e) => (e.id === id ? entry : e)),
      };
      const result = persist(next);
      if (!result.ok) setStorageError(result.error);
      else setStorageError(null);
      return next;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setState((prev) => {
      const next: PersistedState = {
        ...prev,
        entries: prev.entries.filter((e) => e.id !== id),
      };
      const result = persist(next);
      if (!result.ok) setStorageError(result.error);
      else setStorageError(null);
      return next;
    });
  }, []);

  const recordSuggestionSnapshot = useCallback(
    (input: {
      date: string;
      suggestions: SuggestionItem[];
      inputSnapshot: SuggestionInputSnapshot;
    }) => {
      setState((prev) => {
        const duplicate = prev.suggestionHistory.some(
          (h) =>
            h.date === input.date &&
            JSON.stringify(h.suggestions) === JSON.stringify(input.suggestions) &&
            JSON.stringify(h.inputSnapshot) === JSON.stringify(input.inputSnapshot),
        );
        if (duplicate) return prev;

        const snapshot = suggestionSnapshotSchema.parse({
          id: crypto.randomUUID(),
          date: input.date,
          generatedAt: new Date().toISOString(),
          inputSnapshot: input.inputSnapshot,
          suggestions: input.suggestions,
        });

        const suggestionHistory = [snapshot, ...prev.suggestionHistory].slice(0, 2000);
        const next: PersistedState = { ...prev, suggestionHistory };
        const result = persist(next);
        if (!result.ok) setStorageError(result.error);
        else setStorageError(null);
        return next;
      });
    },
    [],
  );

  const resetAll = useCallback(() => {
    const cleared = clearPersistedState();
    if (!cleared.ok) {
      setStorageError(cleared.error);
      return;
    }
    setState(createEmptyState());
    setLoadError(null);
    setStorageError(null);
  }, []);

  const clearErrors = useCallback(() => {
    setStorageError(null);
    setLoadError(null);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      profile: state.profile,
      entries: state.entries,
      suggestionHistory: state.suggestionHistory,
      storageError,
      loadError,
      saveProfile,
      updateProfile,
      addEntry,
      updateEntry,
      deleteEntry,
      addEntries,
      recordSuggestionSnapshot,
      resetAll,
      clearErrors,
    }),
    [
      ready,
      state.profile,
      state.entries,
      state.suggestionHistory,
      storageError,
      loadError,
      saveProfile,
      updateProfile,
      addEntry,
      updateEntry,
      deleteEntry,
      addEntries,
      recordSuggestionSnapshot,
      resetAll,
      clearErrors,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
