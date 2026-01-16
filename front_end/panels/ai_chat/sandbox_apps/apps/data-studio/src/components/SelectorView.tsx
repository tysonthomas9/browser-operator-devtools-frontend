import { useDataStudioStore } from '../store';
import { useModalStore } from './modals';
import { Button } from '@/components/ui';
import { FolderIcon, FileTextIcon, PlusIcon, TrashIcon } from './Icons';

export function SelectorView() {
  const tables = useDataStudioStore(state => state.tables);
  const templates = useDataStudioStore(state => state.templates);
  const requestUseTemplate = useDataStudioStore(state => state.requestUseTemplate);
  const requestLoadTable = useDataStudioStore(state => state.requestLoadTable);
  const requestDeleteTable = useDataStudioStore(state => state.requestDeleteTable);
  const openModal = useModalStore(state => state.openModal);

  const handleLoadTable = (tableId: string) => {
    requestLoadTable(tableId);
  };

  const handleDeleteTable = (tableId: string) => {
    // TODO: Replace with proper confirmation modal
    requestDeleteTable(tableId);
  };

  const handleUseTemplate = (templateId: string, templateName: string) => {
    // Auto-generate name (no prompt to avoid blocking browser automation)
    const name = templateName + ' - ' + new Date().toLocaleDateString();
    requestUseTemplate(templateId, name);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Saved Tables */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FolderIcon className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Your Tables</h2>
          </div>

          {tables.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-lg border border-dashed border-border text-muted-foreground">
              No saved tables yet. Create one to get started!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tables.map(table => (
                <div
                  key={table.id}
                  className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="font-medium mb-1">{table.name}</div>
                  <div className="text-xs text-muted-foreground mb-3">Entity: {table.entityType}</div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleLoadTable(table.id)}>Open</Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <hr className="border-border" />

        {/* Templates */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileTextIcon className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Start from Template</h2>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-8 bg-muted/50 rounded-lg border border-dashed border-border text-muted-foreground">
              No templates available
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  className="p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleUseTemplate(template.id, template.name)}
                >
                  <div className="font-medium mb-1">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Create Custom */}
        <section>
          <h2 className="text-sm font-semibold mb-4">Or Create Custom</h2>
          <Button size="lg" onClick={() => openModal('createTable')}>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Custom Table
          </Button>
        </section>
      </div>
    </div>
  );
}
