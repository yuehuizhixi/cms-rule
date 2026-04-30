import { create } from 'zustand';

interface RuleStore {
  groups: any[];
  rules: any[];
  selectedGroupId: string | null;
  selectedRule: any | null;
  setGroups: (g: any[]) => void;
  setRules: (r: any[]) => void;
  setSelectedGroupId: (id: string | null) => void;
  setSelectedRule: (rule: any | null) => void;
}

export const useRuleStore = create<RuleStore>((set) => ({
  groups: [],
  rules: [],
  selectedGroupId: null,
  selectedRule: null,
  setGroups: (groups) => set({ groups }),
  setRules: (rules) => set({ rules }),
  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),
  setSelectedRule: (selectedRule) => set({ selectedRule }),
}));
