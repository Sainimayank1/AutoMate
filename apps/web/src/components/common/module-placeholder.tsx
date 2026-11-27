import { getModule, type ModuleId } from "@/app/modules";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

/** Phase 0 stand-in for a module page; only proves routing and layout. Delete per module as it's built. */
export function ModulePlaceholder({ moduleId }: { moduleId: ModuleId }) {
  const appModule = getModule(moduleId);

  return (
    <PageContainer>
      <PageHeader title={appModule.title} description={appModule.description} />
      <EmptyState
        className="rounded-xl border border-dashed"
        icon={appModule.icon}
        title="Not built yet"
        description={`The ${appModule.title} module is planned and will appear here.`}
      />
    </PageContainer>
  );
}
