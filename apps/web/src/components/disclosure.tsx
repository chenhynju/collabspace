'use client';
import {useId,useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import {Button} from '@/components/ui';

/** An explicit keyboard-accessible action for expanding optional tools. */
export function Disclosure({title,children,className='',open:controlled,onOpenChange,unmountOnClose=false}:{title:ReactNode;children:ReactNode;className?:string;open?:boolean;onOpenChange?:(open:boolean)=>void;unmountOnClose?:boolean}){
 const [expanded,setExpanded]=useState(false),id=useId(),open=controlled??expanded;
 return <div className={className}><Button type="button" variant="secondary" size="sm" aria-expanded={open} aria-controls={id} onClick={()=>{setExpanded(!open);onOpenChange?.(!open);}}>{title}<ChevronDown aria-hidden="true" size={14} className={open?'rotate-180':''}/></Button><div id={id} hidden={!open} className={open?'mt-3':''}>{(!unmountOnClose||open)&&children}</div></div>;
}
