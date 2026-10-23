export function invitationReturn(search:string):string {
 const next=new URLSearchParams(search).get('next');
 // Only application-owned invitation paths; never accept an arbitrary redirect.
 if(next?.startsWith('/invite/accept?')&&!next.includes('\\')&&!/[\r\n]/.test(next))return next;
 return '/dashboard';
}
