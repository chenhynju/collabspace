import dynamic from 'next/dynamic';
const MotionStudio=dynamic(()=>import('@/components/personas/MotionStudio'),{ssr:false});
export default function Page(){return <MotionStudio/>;}
