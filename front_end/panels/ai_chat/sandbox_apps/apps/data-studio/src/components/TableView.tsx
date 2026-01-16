import { useDataStudioStore } from '../store';
import { useModalStore } from './modals';
import { Button } from '@/components/ui';
import { DataTable } from './DataTable';
import { UserPlusIcon, BotIcon, PlayIcon, PauseIcon, DownloadIcon, TableIcon } from './Icons';

export function TableView() {
  const table = useDataStudioStore(state => state.currentTable);
  const isRunning = useDataStudioStore(state => state.isRunning);
  const requestRunAll = useDataStudioStore(state => state.requestRunAll);
  const requestPauseExecution = useDataStudioStore(state => state.requestPauseExecution);
  const openModal = useModalStore(state => state.openModal);

  if (!table) return null;
  const hasData = table.entities.length > 0 || table.agentGroups.length > 0;

  const handleRunAll = () => {
    requestRunAll();
  };

  const handlePause = () => {
    requestPauseExecution();
  };

  const handleExport = () => {
    const data = JSON.stringify(table, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (table.name || 'export') + '.json';
    a.click();
    // Delay revoke to ensure download initiates properly
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Entity Type: <strong className="text-foreground">{table.entityType}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={() => openModal('addEntity')}>
            <UserPlusIcon className="w-4 h-4 mr-1" />
            Add {table.entityType}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openModal('addAgent')}>
            <BotIcon className="w-4 h-4 mr-1" />
            Add Agent
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="secondary" onClick={handlePause}>
              <PauseIcon className="w-4 h-4 mr-1" />
              Pause
            </Button>
          ) : (
            <Button onClick={handleRunAll}>
              <PlayIcon className="w-4 h-4 mr-1" />
              Run All
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-5 bg-muted/30">
        {hasData ? (
          <DataTable table={table} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-muted rounded-2xl mb-4 text-muted-foreground">
              <TableIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No data yet</h3>
            <p className="text-muted-foreground">Add entities and agents to start analyzing</p>
          </div>
        )}
      </div>
    </div>
  );
}
