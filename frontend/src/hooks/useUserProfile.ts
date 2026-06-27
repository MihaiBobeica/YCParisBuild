import { useCallback, useEffect, useState } from 'react';

export type ConnectorPreference = 'IEC_62196_T2' | 'IEC_62196_T2_COMBO' | 'CHADEMO' | 'TESLA' | '';

export interface UserProfile {
  email: string;
  carName: string;
  connectorType: ConnectorPreference;
}

const STORAGE_KEY = 'nl-ev-user-profile';

const DEFAULT: UserProfile = {
  email: '',
  carName: '',
  connectorType: 'IEC_62196_T2_COMBO',
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

  return { profile, setProfile };
}

export const CONNECTOR_OPTIONS: Array<{ id: ConnectorPreference; label: string; sub: string }> = [
  { id: 'IEC_62196_T2', label: 'Type 2', sub: 'AC · most EU cars' },
  { id: 'IEC_62196_T2_COMBO', label: 'CCS', sub: 'DC fast · common' },
  { id: 'CHADEMO', label: 'CHAdeMO', sub: 'DC · older Nissan' },
  { id: 'TESLA', label: 'NACS', sub: 'Tesla / NACS' },
];
