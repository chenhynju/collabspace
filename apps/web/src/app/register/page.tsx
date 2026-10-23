'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().optional(),
});

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async (d) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', {...d,organizationName:d.organizationName?.trim()||undefined});
      if (data?.requireEmailVerification === false && data?.accessToken) {
        useAuthStore.getState().setToken(data.accessToken);
        await useAuthStore.getState().loadProfile();
        router.push('/dashboard');
        return;
      }
      router.push(`/check-email?email=${encodeURIComponent(d.email)}`);
    } catch (e: any) {
      setError(e.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">注册 CollabSpace</h1>
        <p className="text-center text-slate-500 mb-6">开始你的团队与个人协作</p>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">姓名</label>
            <input {...form.register('name')} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input {...form.register('email')} type="email" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">密码（至少 8 位）</label>
            <input {...form.register('password')} type="password" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">团队／组织名称（可选）</label>
            <input aria-label="团队或组织名称" {...form.register('organizationName')} placeholder="留空即可使用个人协作空间" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <p className="text-xs leading-5 text-slate-500">不填写组织名称也可正常使用协作功能，系统会自动创建独立空间。你的内容与其他组织隔离，仅向获授权成员开放。</p>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          已有账号？<Link href="/login" className="text-blue-600">登录</Link>
        </p>
      </div>
    </div>
  );
}
