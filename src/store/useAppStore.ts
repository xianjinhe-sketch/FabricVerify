import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { InspectionJob, Role, ClientProfile } from '../types';

interface AppState {
    currentRole: Role;
    activeJob: InspectionJob | null;
    loading: boolean;
    clientProfile: ClientProfile;
    setRole: (role: Role) => void;
    setActiveJob: (job: InspectionJob | null) => void;
    setLoading: (loading: boolean) => void;
    updateJob: (updates: Partial<InspectionJob>) => void;
    setClientProfile: (profile: ClientProfile) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            currentRole: Role.INSPECTOR,
            activeJob: null,
            loading: true,
            clientProfile: {
                name: "Fashion Brand Inc.",
                contactPerson: "Alice Smith",
                phone: "+1 555-0123",
                bankInfo: "Chase Bank **** 1234"
            },
            setRole: (role) => set({ currentRole: role }),
            setActiveJob: (job) => set({ activeJob: job }),
            setLoading: (loading) => set({ loading }),
            updateJob: (updates) =>
                set((state) => ({
                    activeJob: state.activeJob ? { ...state.activeJob, ...updates } : null
                })),
            setClientProfile: (profile) => set({ clientProfile: profile }),
        }),
        {
            name: 'fabricverify-app-storage',
            partialize: (state) => ({ activeJob: state.activeJob, clientProfile: state.clientProfile }),
        }
    )
);
