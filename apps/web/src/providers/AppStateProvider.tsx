import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type {
  CoachAdviceInputSnapshot,
  FoodLogEntry,
  FoodLogEntryDraft,
  SuggestionInputSnapshot,
  SuggestionItem,
  UserProfile,
  UserProfileDraft,
} from "@nutrilog/shared";
import {
  coachAdviceSchema,
  nutrilogExportDocumentSchema,
  suggestionSnapshotSchema,
  userProfileSchema,
} from "@nutrilog/shared";
import { createFoodEntry, updateFoodEntry } from "@/lib/entryFactory.js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client.js";
import {
  deleteAllUserData,
  deleteFoodEntryRemote,
  importNutrilogExport,
  insertCoachAdviceRemote,
  insertFoodEntryRemote,
  insertSuggestionRemote,
  loadPersistedStateFromSupabase,
  updateFoodEntryRemote,
  upsertProfileRemote,
} from "@/services/supabaseData.js";
import {
  clearPersistedState,
  createEmptyState,
  loadPersistedState,
  savePersistedState,
  type PersistedState,
} from "@/services/storageService.js";

interface AppStateValue {
  ready: boolean;
  authReady: boolean;
  isSupabase: boolean;
  session: Session | null;
  profile: UserProfile | null;
  entries: FoodLogEntry[];
  suggestionHistory: PersistedState["suggestionHistory"];
  coachAdviceHistory: PersistedState["coachAdviceHistory"];
  storageError: string | null;
  loadError: string | null;
  saveProfile: (draft: UserProfileDraft) => Promise<void>;
  updateProfile: (draft: UserProfileDraft) => Promise<void>;
  addEntry: (draft: FoodLogEntryDraft) => Promise<void>;
  updateEntry: (id: string, draft: FoodLogEntryDraft) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addEntries: (drafts: FoodLogEntryDraft[]) => Promise<void>;
  recordSuggestionSnapshot: (input: {
    date: string;
    suggestions: SuggestionItem[];
    inputSnapshot: SuggestionInputSnapshot;
  }) => Promise<void>;
  recordCoachAdvice: (input: {
    date: string;
    sequence: number;
    inputSnapshot: CoachAdviceInputSnapshot;
    summary: string;
  }) => Promise<void>;
  resetAll: () => Promise<void>;
  clearErrors: () => void;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signUp: (
    email: string,
    password: string,
    draft: UserProfileDraft,
  ) => Promise<{ ok: true; hasSession: boolean } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  importNutrilogJson: (
    json: unknown,
    opts: { mergeProfile: boolean },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  reloadRemoteState: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function persist(next: PersistedState): { ok: true } | { ok: false; error: string } {
  return savePersistedState(next);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const isSupabase = isSupabaseConfigured;
  const [authReady, setAuthReady] = useState(!isSupabase);
  const [session, setSession] = useState<Session | null>(null);
  const [dataLoaded, setDataLoaded] = useState(!isSupabase);

  const [state, setState] = useState<PersistedState>(() => createEmptyState());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  /** Bumps when a newer remote load should supersede in-flight ones (e.g. sign-up finishes upsert after initial fetch started). */
  const remoteLoadGenerationRef = useRef(0);

  useEffect(() => {
    if (!isSupabase) {
      const loaded = loadPersistedState();
      if (!loaded.ok) {
        setLoadError(loaded.error);
        setState(createEmptyState());
      } else {
        setState(loaded.data);
      }
      setAuthReady(true);
      setDataLoaded(true);
      return;
    }

    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, [isSupabase]);

  useEffect(() => {
    if (!isSupabase || !authReady) return;

    if (!session?.user) {
      setState(createEmptyState());
      setLoadError(null);
      setDataLoaded(true);
      return;
    }

    setDataLoaded(false);
    const uid = session.user.id;
    const loadGen = ++remoteLoadGenerationRef.current;
    loadPersistedStateFromSupabase(uid).then((result) => {
      if (loadGen !== remoteLoadGenerationRef.current) {
        return;
      }
      if (!result.ok) {
        setLoadError(result.error);
        setState(createEmptyState());
      } else {
        setLoadError(null);
        setState({
          version: 3,
          profile: result.data.profile,
          entries: result.data.entries,
          suggestionHistory: result.data.suggestionHistory,
          coachAdviceHistory: result.data.coachAdviceHistory,
        });
      }
      setDataLoaded(true);
    });
  }, [isSupabase, authReady, session?.user?.id]);

  const ready = authReady && dataLoaded;

  const reloadRemoteState = useCallback(async () => {
    if (!isSupabase || !session?.user) return;
    const loadGen = ++remoteLoadGenerationRef.current;
    const result = await loadPersistedStateFromSupabase(session.user.id);
    if (loadGen !== remoteLoadGenerationRef.current) {
      return;
    }
    if (!result.ok) {
      setStorageError(result.error);
      return;
    }
    setState({
      version: 3,
      profile: result.data.profile,
      entries: result.data.entries,
      suggestionHistory: result.data.suggestionHistory,
      coachAdviceHistory: result.data.coachAdviceHistory,
    });
    setStorageError(null);
  }, [isSupabase, session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  }, []);

  const signUp = useCallback(async (email: string, password: string, draft: UserProfileDraft) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nickname: draft.nickname,
          goal_type: draft.goalType,
          daily_calorie_target: draft.dailyCalorieTarget ?? null,
        },
      },
    });
    if (error) return { ok: false as const, error: error.message };

    if (data.session?.user) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      const user = data.session.user;
      const emailFinal = user.email ?? email.trim();
      const t = nowIso();
      const profile = userProfileSchema.parse({
        nickname: draft.nickname,
        email: emailFinal,
        goalType: draft.goalType,
        dailyCalorieTarget: draft.dailyCalorieTarget,
        createdAt: t,
        updatedAt: t,
      });
      const r = await upsertProfileRemote(supabase, user.id, profile);
      if (!r.ok) return { ok: false as const, error: r.error };

      const loadGen = ++remoteLoadGenerationRef.current;
      const loaded = await loadPersistedStateFromSupabase(user.id);
      if (loadGen !== remoteLoadGenerationRef.current) {
        return { ok: true as const, hasSession: true };
      }
      if (!loaded.ok) {
        return { ok: false as const, error: loaded.error };
      }
      setLoadError(null);
      setState({
        version: 3,
        profile: loaded.data.profile,
        entries: loaded.data.entries,
        suggestionHistory: loaded.data.suggestionHistory,
        coachAdviceHistory: loaded.data.coachAdviceHistory,
      });
      setDataLoaded(true);
      return { ok: true as const, hasSession: true };
    }

    if (data.user?.id) {
      return { ok: true as const, hasSession: false };
    }

    return {
      ok: false as const,
      error: "Could not create an account. Try again in a moment.",
    };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabase) {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    }
    setState(createEmptyState());
    setLoadError(null);
    setStorageError(null);
  }, [isSupabase]);

  const saveProfile = useCallback(
    async (draft: UserProfileDraft) => {
      const t = nowIso();
      const profile = userProfileSchema.parse({
        ...draft,
        createdAt: t,
        updatedAt: t,
      });

      if (!isSupabase) {
        setState((prev) => {
          const next: PersistedState = { ...prev, profile };
          const result = persist(next);
          if (!result.ok) setStorageError(result.error);
          else setStorageError(null);
          return next;
        });
        return;
      }

      if (!session?.user?.id || !session.user.email) {
        setStorageError("Not signed in.");
        return;
      }
      const merged = userProfileSchema.parse({
        ...profile,
        email: session.user.email,
        createdAt: profile.createdAt,
        updatedAt: t,
      });
      const supabase = getSupabase();
      const r = await upsertProfileRemote(supabase, session.user.id, merged);
      if (!r.ok) {
        setStorageError(r.error);
        return;
      }
      setStorageError(null);
      setState((prev) => ({ ...prev, profile: merged }));
    },
    [isSupabase, session?.user?.id, session?.user?.email],
  );

  const updateProfile = useCallback(
    async (draft: UserProfileDraft) => {
      if (!isSupabase) {
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
        return;
      }

      if (!session?.user?.id || !session.user.email) {
        setStorageError("Not signed in.");
        return;
      }
      setState((prev) => {
        if (!prev.profile) return prev;
        const profile = userProfileSchema.parse({
          ...prev.profile,
          ...draft,
          email: session.user.email,
          updatedAt: nowIso(),
        });
        void (async () => {
          const supabase = getSupabase();
          const r = await upsertProfileRemote(supabase, session.user.id, profile);
          if (!r.ok) setStorageError(r.error);
          else setStorageError(null);
        })();
        return { ...prev, profile };
      });
    },
    [isSupabase, session?.user?.id, session?.user?.email],
  );

  const addEntry = useCallback(
    async (draft: FoodLogEntryDraft) => {
      const entry = createFoodEntry(draft);
      if (!isSupabase) {
        setState((prev) => {
          const next: PersistedState = { ...prev, entries: [entry, ...prev.entries] };
          const result = persist(next);
          if (!result.ok) setStorageError(result.error);
          else setStorageError(null);
          return next;
        });
        return;
      }
      if (!session?.user?.id) {
        setStorageError("Not signed in.");
        throw new Error("Not signed in.");
      }
      const supabase = getSupabase();
      const r = await insertFoodEntryRemote(supabase, session.user.id, entry);
      if (!r.ok) {
        setStorageError(r.error);
        throw new Error(r.error);
      }
      setStorageError(null);
      setState((prev) => ({ ...prev, entries: [entry, ...prev.entries] }));
    },
    [isSupabase, session?.user?.id],
  );

  const addEntries = useCallback(
    async (drafts: FoodLogEntryDraft[]) => {
      const created = drafts.map((d) => createFoodEntry(d));
      if (!isSupabase) {
        setState((prev) => {
          const next: PersistedState = { ...prev, entries: [...created, ...prev.entries] };
          const result = persist(next);
          if (!result.ok) setStorageError(result.error);
          else setStorageError(null);
          return next;
        });
        return;
      }
      if (!session?.user?.id) {
        setStorageError("Not signed in.");
        return;
      }
      const supabase = getSupabase();
      for (const entry of created) {
        const r = await insertFoodEntryRemote(supabase, session.user.id, entry);
        if (!r.ok) {
          setStorageError(r.error);
          return;
        }
      }
      setStorageError(null);
      setState((prev) => ({ ...prev, entries: [...created, ...prev.entries] }));
    },
    [isSupabase, session?.user?.id],
  );

  const updateEntry = useCallback(
    async (id: string, draft: FoodLogEntryDraft) => {
      if (!isSupabase) {
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
        return;
      }
      if (!session?.user?.id) {
        setStorageError("Not signed in.");
        throw new Error("Not signed in.");
      }
      const existing = state.entries.find((e) => e.id === id);
      if (!existing) {
        throw new Error("Entry not found.");
      }
      const entry = updateFoodEntry(existing, draft);
      const supabase = getSupabase();
      const r = await updateFoodEntryRemote(supabase, session.user.id, entry);
      if (!r.ok) {
        setStorageError(r.error);
        throw new Error(r.error);
      }
      setStorageError(null);
      setState((prev) => ({ ...prev, entries: prev.entries.map((e) => (e.id === id ? entry : e)) }));
    },
    [isSupabase, session?.user?.id, state.entries],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!isSupabase) {
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
        return;
      }
      if (!session?.user?.id) {
        setStorageError("Not signed in.");
        return;
      }
      const supabase = getSupabase();
      const r = await deleteFoodEntryRemote(supabase, session.user.id, id);
      if (!r.ok) {
        setStorageError(r.error);
        return;
      }
      setStorageError(null);
      setState((prev) => ({
        ...prev,
        entries: prev.entries.filter((e) => e.id !== id),
      }));
    },
    [isSupabase, session?.user?.id],
  );

  const recordCoachAdvice = useCallback(
    async (input: {
      date: string;
      sequence: number;
      inputSnapshot: CoachAdviceInputSnapshot;
      summary: string;
    }) => {
      const advice = coachAdviceSchema.parse({
        id: crypto.randomUUID(),
        date: input.date,
        sequence: input.sequence,
        generatedAt: new Date().toISOString(),
        inputSnapshot: input.inputSnapshot,
        summary: input.summary,
      });

      if (!isSupabase) {
        setState((prev) => {
          const coachAdviceHistory = [advice, ...prev.coachAdviceHistory].slice(0, 2000);
          const next: PersistedState = { ...prev, coachAdviceHistory };
          const result = persist(next);
          if (!result.ok) setStorageError(result.error);
          else setStorageError(null);
          return next;
        });
        return;
      }
      if (!session?.user?.id) {
        setStorageError("Not signed in.");
        return;
      }
      const supabase = getSupabase();
      const r = await insertCoachAdviceRemote(supabase, session.user.id, advice);
      if (!r.ok) {
        setStorageError(r.error);
        return;
      }
      setStorageError(null);
      setState((prev) => ({
        ...prev,
        coachAdviceHistory: [advice, ...prev.coachAdviceHistory].slice(0, 2000),
      }));
    },
    [isSupabase, session?.user?.id],
  );

  const recordSuggestionSnapshot = useCallback(
    async (input: {
      date: string;
      suggestions: SuggestionItem[];
      inputSnapshot: SuggestionInputSnapshot;
    }) => {
      if (!isSupabase) {
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
        return;
      }
      if (!session?.user?.id) {
        setStorageError("Not signed in.");
        return;
      }

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

        void (async () => {
          const supabase = getSupabase();
          const r = await insertSuggestionRemote(supabase, session.user.id, snapshot);
          if (!r.ok) setStorageError(r.error);
          else setStorageError(null);
        })();

        const suggestionHistory = [snapshot, ...prev.suggestionHistory].slice(0, 2000);
        return { ...prev, suggestionHistory };
      });
    },
    [isSupabase, session?.user?.id],
  );

  const importNutrilogJson = useCallback(
    async (json: unknown, opts: { mergeProfile: boolean }) => {
      if (!isSupabase || !session?.user?.id || !session.user.email) {
        return { ok: false as const, error: "Sign in with Supabase to import." };
      }
      const parsed = nutrilogExportDocumentSchema.safeParse(json);
      if (!parsed.success) {
        return { ok: false as const, error: "This file is not a valid NutriLog export." };
      }
      const supabase = getSupabase();
      const r = await importNutrilogExport(supabase, session.user.id, session.user.email, parsed.data, opts);
      if (!r.ok) return r;
      await reloadRemoteState();
      return { ok: true as const };
    },
    [isSupabase, session?.user?.id, session?.user?.email, reloadRemoteState],
  );

  const resetAll = useCallback(async () => {
    if (!isSupabase) {
      const cleared = clearPersistedState();
      if (!cleared.ok) {
        setStorageError(cleared.error);
        return;
      }
      setState(createEmptyState());
      setLoadError(null);
      setStorageError(null);
      return;
    }
    if (session?.user?.id) {
      const supabase = getSupabase();
      const r = await deleteAllUserData(supabase, session.user.id);
      if (!r.ok) {
        setStorageError(r.error);
        return;
      }
      await supabase.auth.signOut();
    }
    setState(createEmptyState());
    setLoadError(null);
    setStorageError(null);
  }, [isSupabase, session?.user?.id]);

  const clearErrors = useCallback(() => {
    setStorageError(null);
    setLoadError(null);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      authReady,
      isSupabase,
      session,
      profile: state.profile,
      entries: state.entries,
      suggestionHistory: state.suggestionHistory,
      coachAdviceHistory: state.coachAdviceHistory,
      storageError,
      loadError,
      saveProfile,
      updateProfile,
      addEntry,
      updateEntry,
      deleteEntry,
      addEntries,
      recordSuggestionSnapshot,
      recordCoachAdvice,
      resetAll,
      clearErrors,
      signIn,
      signUp,
      signOut,
      importNutrilogJson,
      reloadRemoteState,
    }),
    [
      ready,
      authReady,
      isSupabase,
      session,
      state.profile,
      state.entries,
      state.suggestionHistory,
      state.coachAdviceHistory,
      storageError,
      loadError,
      saveProfile,
      updateProfile,
      addEntry,
      updateEntry,
      deleteEntry,
      addEntries,
      recordSuggestionSnapshot,
      recordCoachAdvice,
      resetAll,
      clearErrors,
      signIn,
      signUp,
      signOut,
      importNutrilogJson,
      reloadRemoteState,
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
