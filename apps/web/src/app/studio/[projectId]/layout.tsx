import { HouseDesignProvider } from "@/lib/house-design/context";
import { PlanProvider } from "./plan-context";

export default function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  return (
    <PlanProvider projectId={params.projectId}>
      <HouseDesignProvider projectId={params.projectId}>{children}</HouseDesignProvider>
    </PlanProvider>
  );
}
