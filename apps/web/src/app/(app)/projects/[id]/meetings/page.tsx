'use client';
import ProjectMeetings from '@/components/meetings/ProjectMeetings';
export default function MeetingsPage({params}:{params:{id:string}}){return <ProjectMeetings projectId={params.id}/>;}
