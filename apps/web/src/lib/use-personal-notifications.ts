'use client';
import {useEffect,useState,useCallback} from 'react';
import {io} from 'socket.io-client';
import {api} from './api';
import {useAuthStore} from '@/store/auth';
export function usePersonalNotifications(onChange?:()=>void){
 const token=useAuthStore(s=>s.token),[count,setCount]=useState(0);
 const refresh=useCallback(()=>{if(!token)return;const captured=token;api.get('/notifications/unread-count').then(({data})=>{if(useAuthStore.getState().token===captured)setCount(data.count);}).catch(()=>{});},[token]);
 useEffect(()=>{setCount(0);if(!token)return;let active=true;const changed=()=>{if(active){refresh();onChange?.();}};
 const socket=io(process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1','')||'http://localhost:3001',{auth:{token},transports:['websocket']});
 socket.on('notifications:changed',changed);socket.on('connect',changed);changed();
 const timer=setInterval(changed,15000);window.addEventListener('focus',changed);window.addEventListener('personal-notifications:refresh',changed);
 return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',changed);window.removeEventListener('personal-notifications:refresh',changed);socket.disconnect();};
 },[token,refresh,onChange]);return {count,refresh};
}
