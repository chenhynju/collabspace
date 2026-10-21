'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {api} from '@/lib/api';
import {useRef,useState} from 'react';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const started=useRef(false),[error,setError]=useState('');

  useEffect(() => {
    if(started.current)return;started.current=true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get('code');
    history.replaceState(null,'',window.location.pathname);
    if (code) {
      api.post('/auth/oauth/exchange',{code}).then(async({data})=>{setToken(data.accessToken);await loadProfile();router.replace('/dashboard');}).catch(()=>setError('登录回调已过期或浏览器不匹配，请返回登录页重试。'));
    } else {
      router.push('/login');
    }
  }, [setToken, loadProfile, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-slate-500">{error||'登录中...'}{error&&<a className="ml-3 underline" href="/login">返回登录</a>}</p>
    </div>
  );
}
