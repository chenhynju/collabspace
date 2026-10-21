"use client";
import {useState} from 'react';
export default function OfflineStorage(){
  const [message,setMessage]=useState('正文与已读取配图保存在此设备，退出登录会清除。首次上传图片仍需联网。');
  return <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{message}</span><button className="rounded border px-2 py-1" onClick={async()=>{
    try{const granted=await navigator.storage?.persist?.();setMessage(granted?'已获持久存储许可；浏览器不自动回收。手动清理或退出登录仍会删除。':'浏览器未授予持久存储许可，已有缓存仍可使用，但可能被回收。');}catch{setMessage('无法申请持久存储，请检查浏览器设置。');}
  }}>保留离线资料</button></div>;
}
