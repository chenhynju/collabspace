'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function CheckEmailInner() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const delivery=params.get('delivery');
  const [notice, setNotice] = useState('');
  const [resending, setResending] = useState(false);

  const resend = async () => {
    setResending(true);
    setNotice('');
    try {
      await api.post('/auth/resend-verification', { email });
      setNotice('已请求重新发送；若为演示邮件模式，不会实际发出，请联系管理员。');
    } catch (e: any) {
      setNotice(e.response?.data?.message || '发送失败，请稍后再试');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-2xl">
          ✉️
        </div>
        <h1 className="text-xl font-bold mb-2">请验证你的邮箱</h1>
        <p className="text-slate-500 text-sm leading-6 mb-1">
          {delivery==='simulated'?'演示邮件模式 · 邮件未实际发送':delivery==='failed'?'验证邮件投递失败':'请查收邮箱验证链接'}
        </p>
        {delivery==='simulated'&&<p role="status" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">请联系管理员配置邮件服务后重新发送。未完成验证前不会加入受邀组织。</p>}
        <p className="text-slate-900 font-medium text-sm mb-6">{email}</p>
        <p className="text-slate-500 text-xs leading-6 mb-6">
          请在 24 小时内点击邮件中的链接完成注册。若未收到，请检查垃圾邮件或点击下方按钮重新发送。
        </p>

        {notice && (
          <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded mb-4">{notice}</div>
        )}

        <button
          onClick={resend}
          disabled={resending || !email}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {resending ? '发送中...' : '重新发送验证邮件'}
        </button>

        <p className="text-sm text-slate-500 mt-4">
          <Link href="/login" className="text-blue-600">返回登录</Link>
        </p>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailInner />
    </Suspense>
  );
}
