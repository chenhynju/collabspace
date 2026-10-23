'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Sidebar from '@/components/Sidebar';
import {Menu} from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [navOpen,setNavOpen]=useState(false);
  const token = useAuthStore((s) => s.token);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [ready, setReady] = useState(false);
  // 首次渲染（含 SSR）统一输出 loading，避免客户端有 token 而服务端无导致的 hydration mismatch
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.push('/login');
      return;
    }
    let active = true;
    loadProfile()
      .then(() => active && setReady(true))
      .catch(() => router.push('/login'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token]);

  if (!hydrated || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="text-sm text-slate-400">加载中…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f6f8fc]" onKeyDown={e=>{if(e.key==='Escape')setNavOpen(false)}}>
      {navOpen && <button aria-label="关闭导航" className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden" onClick={()=>setNavOpen(false)}/>}
      <div id="app-navigation" className={`${navOpen?'fixed inset-y-0 left-0 z-50 block':'hidden'} md:sticky md:top-0 md:block md:h-dvh`} onClick={e=>{if((e.target as HTMLElement).closest('a'))setNavOpen(false)}}><Sidebar /></div>
      <main key={currentOrgId} className="min-w-0 flex-1 overflow-auto">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 md:hidden"><span className="font-semibold">CollabSpace</span><button aria-label="打开导航" aria-expanded={navOpen} aria-controls="app-navigation" onClick={()=>setNavOpen(!navOpen)} className="rounded-xl border border-slate-200 p-2"><Menu size={20}/></button></div>
        {children}
      </main>
    </div>
  );
}
