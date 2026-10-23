import { create } from 'zustand';
import { api } from '@/lib/api';
import { useImStore } from './im';
import { clearDocumentCaches } from '@/lib/document-provider';

export interface MembershipOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  membershipId: string;
  membershipStatus: string;
  deptId: string | null;
  roleKeys: string[];
  roleNames: string[];
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  organizations: MembershipOrg[];
  currentOrgId: string | null;
  perms: string[];
  roleKeys: string[];
  setToken: (t: string) => void;
  setCurrentOrg: (id: string) => Promise<void>;
  logout: () => void;
  loadProfile: () => Promise<void>;
  loadOrgContext: () => Promise<void>;
  hasPerm: (p: string) => boolean;
}

function matchPerm(granted: string[], required: string): boolean {
  if (granted.includes('*')) return true;
  if (granted.includes(required)) return true;
  // 模块级通配：如 project:* 命中 project:edit
  const [module] = required.split(':');
  return granted.includes(`${module}:*`);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
  user: null,
  organizations: [],
  currentOrgId:
    typeof window !== 'undefined' ? localStorage.getItem('current_org_id') : null,
  perms: [],
  roleKeys: [],

  setToken: (t) => {
    window.dispatchEvent(new Event('collabspace:logout'));
    if(get().user?.id)void clearDocumentCaches(get().user?.id);
    useImStore.setState({conversations:[],currentConversationId:null,messages:[]});
    localStorage.removeItem('current_org_id');
    localStorage.setItem('access_token', t);
    set({ token:t,user:null,organizations:[],currentOrgId:null,perms:[],roleKeys:[] });
  },

  setCurrentOrg: async (id) => {
    if (get().currentOrgId !== id) {
      useImStore.setState({ conversations: [], currentConversationId: null, messages: [] });
      set({ perms: [], roleKeys: [] });
    }
    localStorage.setItem('current_org_id', id);
    set({ currentOrgId: id });
    await get().loadOrgContext();
  },

  logout: () => {
    window.dispatchEvent(new Event("collabspace:logout"));
    void clearDocumentCaches(get().user?.id);
    useImStore.setState({ conversations: [], currentConversationId: null, messages: [] });
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_org_id');
    set({
      token: null,
      user: null,
      organizations: [],
      currentOrgId: null,
      perms: [],
      roleKeys: [],
    });
  },

  loadProfile: async () => {
    const token=get().token;
    if(!token)return;
    const { data } = await api.get('/users/me');
    if(get().token!==token)return;
    const organizations: MembershipOrg[] = (data.organizations ?? []).filter((o:MembershipOrg)=>o.membershipStatus==='ACTIVE'&&o.status==='ACTIVE');
    set({
      user: {
        id: data.id,
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
      },
      organizations,
    });

    const selected=organizations.find(o=>o.id===get().currentOrgId)?.id||organizations[0]?.id;
    if(selected){await get().setCurrentOrg(selected);}
    else{localStorage.removeItem('current_org_id');set({currentOrgId:null,perms:[],roleKeys:[]});}

  },

  loadOrgContext: async () => {
    const token=get().token;
    const orgId = get().currentOrgId;
    if (!orgId) return;
    const { data } = await api.get('/organizations/current',{headers:{'x-organization-id':orgId}});
    if (get().currentOrgId !== orgId || get().token!==token) return;
    set({ perms: data.perms ?? [], roleKeys: data.roleKeys ?? [] });
  },

  hasPerm: (p) => {
    const { perms, roleKeys } = get();
    if (roleKeys.includes('OWNER')) return true;
    return matchPerm(perms, p);
  },
}));
