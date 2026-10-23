'use client';
import { useEffect, useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import {
  Card, Button, Badge, Modal, Input, Select, Field, Empty, InlineError,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const STATUS_TONE: Record<string, any> = {
  DECLINED: 'slate',
  PENDING: 'blue',
  ACCEPTED: 'green',
  REVOKED: 'red',
  EXPIRED: 'amber',
};
const STATUS_LABEL: Record<string, string> = {
  DECLINED: '已拒绝',
  PENDING: '待接受',
  ACCEPTED: '已接受',
  REVOKED: '已撤销',
  EXPIRED: '已过期',
};

export default function InvitationsPage() {
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const [list, setList] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [deliveryNotice,setDeliveryNotice]=useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await api.get('/invitations');
    setList(data);
  }, []);

  useEffect(() => {
    refresh().catch(()=>setError('邀请列表加载失败'));
    const timer=setInterval(()=>refresh().catch(()=>{}),15000);
    api
      .get('/roles')
      .then((r) => setRoles(r.data.filter((x: any) => x.key !== 'OWNER')))
      .catch(() => setRoles([]));
    return()=>clearInterval(timer);
  }, [refresh]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/invitations', { email, roleId });
      setInviteUrl(data.inviteUrl||'');setDeliveryNotice(data.delivery==='IN_APP'?'邀请已送达对方的个人通知中心。':'邮件已进入投递队列，请查看投递状态；演示模式不会实际发信。');
      await refresh();
    } catch (e: any) {
      setError(e.response?.data?.message ?? '发送失败');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (inv: any) => {
    try {
      await api.post(`/invitations/${inv.id}/revoke`);
      await refresh();
    } catch (e: any) {
      alert(e.response?.data?.message ?? '撤销失败');
    }
  };

  return (
    <div className="p-6">
      <PageHeader title="邀请" description="通过邮箱邀请成员，邀请 7 天内有效">
        {hasPerm('invite:send') ? (
          <Button
            onClick={() => {
              setOpen(true);
              setEmail('');
              setRoleId(roles[0]?.id ?? '');
              setInviteUrl('');setDeliveryNotice('');
              setError(null);
            }}
          >
            发起邀请
          </Button>
        ) : null}
      </PageHeader>

      {list.length === 0 ? (
        <Empty text="暂无邀请记录" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 font-medium">邮箱</th>
                <th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">有效期至</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">送达方式 / 状态</th><th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{inv.email}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.role.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(inv.expiresAt).toISOString().slice(0,10)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{({IN_APP:'站内通知',PENDING:'邮件排队',SENDING:'投递中',RETRY:'等待重试',SENT:'已发信',SIMULATED:'演示 · 未实际发信',FAILED:'投递失败',CANCELLED:'投递取消'} as Record<string,string>)[inv.delivery?.status]||'待处理'}</td><td className="px-4 py-3 text-right">
                    {inv.status === 'PENDING' && hasPerm('invite:revoke') ? (
                      <Button size="sm" variant="danger" onClick={() => revoke(inv)}>
                        撤销
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="发起邀请">
        <div className="space-y-4">
          <Field label="被邀请人邮箱" hint="被邀请人须使用相同邮箱注册并接受">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </Field>
          <Field label="授予角色">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>

          {deliveryNotice&&<p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">{deliveryNotice}</p>}{inviteUrl ? (
            <Field label="邀请链接（模拟邮件投递，请复制发送）">
              <Input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
            </Field>
          ) : null}

          <InlineError message={error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              关闭
            </Button>
            <Button onClick={send} disabled={busy || !email.trim() || !roleId}>
              {busy ? '发送中…' : '发送邀请'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
