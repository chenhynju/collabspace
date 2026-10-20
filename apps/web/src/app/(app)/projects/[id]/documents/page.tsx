"use client";
import ResourceList from "@/components/documents/ResourceList";
export default function Documents({ params }: { params: { id: string } }) {
  return <ResourceList params={params} />;
}
