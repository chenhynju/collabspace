import CollaborationHub from '@/components/documents/CollaborationHub';
export default function ProjectContent({params}:{params:{id:string}}){return <CollaborationHub projectId={params.id} initialKind="DOCUMENTS"/>;}
