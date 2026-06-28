import { useCallback, useEffect, useState } from 'react';

export type ConnectorPreference = 'IEC_62196_T2' | 'IEC_62196_T2_COMBO' | 'CHADEMO' | 'TESLA' | '';

export interface UserProfile {
  email: string;
  name: string;
  carName: string;
  connectorType: ConnectorPreference;
  authed: boolean;
}

const STORAGE_KEY = 'paxor-user-profile';

const DEFAULT: UserProfile = {
  email: '',
  name: '',
  carName: '',
  connectorType: 'IEC_62196_T2_COMBO',
  authed: false,
};

function load(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const setProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfileState((prev) => ({ ...prev, ...patch }));
  }, []);

  const signOut = useCallback(() => {
    setProfileState((prev) => ({ ...prev, email: '', name: '', authed: false }));
  }, []);

  return { profile, setProfile, signOut };
}

export const CONNECTOR_OPTIONS: Array<{ id: ConnectorPreference; label: string; sub: string }> = [
  { id: 'IEC_62196_T2', label: 'Type 2', sub: 'AC · most EU cars' },
  { id: 'IEC_62196_T2_COMBO', label: 'CCS', sub: 'DC fast · common' },
  { id: 'CHADEMO', label: 'CHAdeMO', sub: '' },
  { id: 'TESLA', label: 'NACS', sub: 'Tesla / NACS' },
];
