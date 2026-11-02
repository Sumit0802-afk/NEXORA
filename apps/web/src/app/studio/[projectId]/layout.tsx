import { HouseDesignProvider } from "@/lib/house-design/context";
import { PlanProvider } from "./plan-context";

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <PlanProvider projectId={projectId}>
      <HouseDesignProvider projectId={projectId}>{children}</HouseDesignProvider>
    </PlanProvider>
  );
}
