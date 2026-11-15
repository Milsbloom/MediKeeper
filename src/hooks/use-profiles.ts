import { useCallback, useEffect, useState } from 'react';

import { getSettings, listProfiles, onDataChange, updateSettings, type Profile } from '@/lib/db';

/**
 * The people in the app and whose medications the screens are showing.
 * `filter` is a profile id, or null for everyone. With one person it's always null.
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filter, setFilterState] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([listProfiles(), getSettings()]);
    setProfiles(p);
    setFilterState(p.length > 1 ? s.profileFilter : null);
  }, []);

  useEffect(() => {
    void load();
    return onDataChange(() => {
      void load();
    });
  }, [load]);

  const setFilter = useCallback(async (id: number | null) => {
    setFilterState(id);
    await updateSettings({ profileFilter: id });
  }, []);

  const byId = new Map(profiles.map((p) => [p.id, p]));
  return { profiles, filter, setFilter, byId, multiple: profiles.length > 1 };
}
