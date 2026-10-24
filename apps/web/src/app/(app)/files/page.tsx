'use client';
import { Fragment, useEffect, useState, useCallback } from 'react';
import {displayDate} from '@/lib/display-date';
import PageHeader from '@/components/PageHeader';
import {
  Card, Button, Modal, Input, Field, Empty, InlineError,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import {useRouter} from 'next/navigation';

function fmtSize(big: string) {
  const n = Number(big);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function FilesGlobalPage() {
  const router=useRouter();
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const [list, setList] = useState<any[]>([]);
  const org=useAuthStore(s=>s.currentOrgId);
  const [shareFor, setShareFor] = useState<any | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await api.get('/files',{headers:{'x-organization-id':org}});
    if(useAuthStore.getState().currentOrgId===org)setList(data);
  }, [org]);

  useEffect(() => {
    let active=true;setList([]);setShareFor(null);
    void refresh().catch(()=>{if(active)setError('文件加载失败，请检查权限或网络。');});
    return ()=>{active=false;};
  }, [refresh,org]);

  const download = async (f: any) => {
    const res = await api.get(`/files/${f.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createShare = async () => {
    setError(null);
    try {
      const { data } = await api.post(`/files/${shareFor.id}/share`, { ttlDays: 7 });
      setShareUrl(data.url);
    } catch (e: any) {
      setError(e.response?.data?.message ?? '共享失败');
    }
  };

  return (
    <div className="p-6">
      <PageHeader title="附件管理" description="附件下载与共享。文档、图表和 Office 已统一在协作空间中创建和编辑。" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900"><span>新建 Word、Excel、PowerPoint，或继续编辑 Markdown、白板，请进入统一协作空间。已有文件链接和下载仍可使用。</span><Link className="rounded-lg bg-indigo-600 px-4 py-2 text-white" href="/collaboration">打开协作空间 →</Link></div>

      {list.length === 0 ? (
        <Empty text="暂无文件" />
      ) : (
        <Card>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 font-medium">文件名</th>
                <th className="px-4 py-3 font-medium">所属项目</th>
                <th className="px-4 py-3 font-medium">版本</th>
                <th className="px-4 py-3 font-medium">大小</th>
                <th className="px-4 py-3 font-medium">上传人</th><th className="px-4 py-3 font-medium">最近编辑人</th><th className="px-4 py-3 font-medium">编辑时间</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <Fragment key={f.id}>
                  <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{f.name}</td>
                    <td className="px-4 py-3 text-slate-500">{f.project?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-500">v{f.officeRevision ?? f.version}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtSize(f.size)}</td>
                    <td className="px-4 py-3 text-slate-500">{f.uploadedBy?.name ?? '-'}</td><td className="px-4 py-3 text-slate-500">{f.officeId ? (f.lastEditor?.name || (f.officeRevision > 1 ? '历史作者未记录' : f.uploadedBy?.name || '—')) : (f.uploadedBy?.name || '—')}</td><td className="px-4 py-3 whitespace-nowrap text-slate-500" title="北京时间；Office 显示已确认保存时间，其余文件显示上传时间">{displayDate(f.lastEditedAt || f.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {/\.(docx|xlsx|pptx)$/i.test(f.name)&&<Button size="sm" onClick={async()=>{try{const r=await api.post(`/office/files/${f.id}/open`);router.push('/office/'+r.data.id)}catch(e:any){setError(e.response?.data?.code==='OFFICE_NOT_CONFIGURED'?'Office 服务尚未配置。':'无法打开；首次初始化需要上传者操作，之后由文件所有者授权。')}}}>在线编辑</Button>}
                        <Button size="sm" variant="secondary" onClick={() => download(f)}>
                          下载
                        </Button>
                        {hasPerm('file:share')&&!f.officeId ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setShareFor(f);
                              setShareUrl('');
                              setError(null);
                            }}
                          >
                            共享
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}

      <Modal open={!!shareFor} onClose={() => setShareFor(null)} title={`共享「${shareFor?.name ?? ''}」`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">生成 7 天有效的访客链接，无需登录即可下载。</p>
          <InlineError message={error} />
          {shareUrl ? (
            <Field label="共享链接">
              <Input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            </Field>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={createShare}>生成共享链接</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
