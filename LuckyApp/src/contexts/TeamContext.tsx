'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useDynamicContext, getAuthToken } from '@dynamic-labs/sdk-react-core';
import { getTeamsByWallet, createTeam as createTeamInFirestore } from '@/lib/firestore';

export interface Team {
  id: string;
  name: string;
  description?: string;
}

interface TeamContextValue {
  currentTeam: Team | null;
  teams: Team[];
  loading: boolean;
  error: string | null;
  selectTeam: (teamId: string) => void;
  refreshTeams: () => Promise<void>;
  getToken: () => Promise<string | null>;
  createTeam: (name: string, description?: string) => void;
}

const TeamContext = createContext<TeamContextValue>({
  currentTeam: null,
  teams: [],
  loading: false,
  error: null,
  selectTeam: () => {},
  refreshTeams: async () => {},
  getToken: async () => null,
  createTeam: () => {},
});

export function useTeam() {
  return useContext(TeamContext);
}

const TEAM_STORAGE_KEY = 'luckyst_selected_team_id';

export function TeamProvider({ children }: { children: ReactNode }) {
  const { primaryWallet } = useDynamicContext();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = primaryWallet?.address || null;

  // Load teams from Firestore when wallet connects
  useEffect(() => {
    if (!walletAddress) {
      setTeams([]);
      setCurrentTeam(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTeamsByWallet(walletAddress)
      .then((firestoreTeams) => {
        if (cancelled) return;
        const mapped: Team[] = firestoreTeams.map((t) => ({
          id: t.id!,
          name: t.name,
          description: t.description,
        }));
        setTeams(mapped);

        const savedId = localStorage.getItem(TEAM_STORAGE_KEY);
        const selected = mapped.find((t) => t.id === savedId) || mapped[0] || null;
        setCurrentTeam(selected);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load teams from Firestore:', err);
        setError('Failed to load teams');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [walletAddress]);

  const getToken = useCallback(async (): Promise<string | null> => {
    return getAuthToken() || null;
  }, []);

  const refreshTeams = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const firestoreTeams = await getTeamsByWallet(walletAddress);
      const mapped: Team[] = firestoreTeams.map((t) => ({
        id: t.id!,
        name: t.name,
        description: t.description,
      }));
      setTeams(mapped);
      if (mapped.length > 0 && !mapped.find((t) => t.id === currentTeam?.id)) {
        setCurrentTeam(mapped[0]);
      }
    } catch (err) {
      console.error('Failed to refresh teams:', err);
    }
  }, [walletAddress, currentTeam?.id]);

  const selectTeam = useCallback((teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      setCurrentTeam(team);
      localStorage.setItem(TEAM_STORAGE_KEY, teamId);
    }
  }, [teams]);

  const createTeam = useCallback(async (name: string, description?: string) => {
    if (!walletAddress) return;
    try {
      const newId = await createTeamInFirestore({
        name,
        description,
        walletAddress,
      });
      const newTeam: Team = { id: newId, name, description };
      const updated = [...teams, newTeam];
      setTeams(updated);
      setCurrentTeam(newTeam);
      localStorage.setItem(TEAM_STORAGE_KEY, newId);
    } catch (err) {
      console.error('Failed to create team:', err);
      setError('Failed to create team');
    }
  }, [walletAddress, teams]);

  return (
    <TeamContext.Provider value={{
      currentTeam,
      teams,
      loading,
      error,
      selectTeam,
      refreshTeams,
      getToken,
      createTeam,
    }}>
      {children}
    </TeamContext.Provider>
  );
}
