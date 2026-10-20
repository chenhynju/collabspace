"use client";
import ResourceList from "@/components/documents/ResourceList";
export default function Boards({ params }: { params: { id: string } }) {
  return <ResourceList params={params} kind="BOARD" />;
}
