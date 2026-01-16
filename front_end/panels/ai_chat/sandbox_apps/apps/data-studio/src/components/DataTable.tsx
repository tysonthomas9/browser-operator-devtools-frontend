import { useDataStudioStore } from '../store';
import { useModalStore } from './modals';
import type { DataTable as DataTableType, CellResult } from '../types';
import { PlayIcon, XIcon, TrashIcon } from './Icons';

interface DataTableProps {
  table: DataTableType;
}

export function DataTable({ table }: DataTableProps) {
  const openCellDetail = useModalStore(state => state.openCellDetail);
  const requestRunAgentGroup = useDataStudioStore(state => state.requestRunAgentGroup);
  const requestRemoveAgentGroup = useDataStudioStore(state => state.requestRemoveAgentGroup);
  const requestRunRow = useDataStudioStore(state => state.requestRunRow);
  const requestRemoveEntity = useDataStudioStore(state => state.requestRemoveEntity);

  const handleRunAgentAll = (agentGroupId: string) => {
    for (const entity of table.entities) {
      requestRunAgentGroup(entity.id, agentGroupId);
    }
  };

  const handleRemoveAgent = (agentGroupId: string) => {
    // TODO: Replace with proper confirmation modal
    requestRemoveAgentGroup(agentGroupId);
  };

  const handleRunRow = (entityId: string) => {
    requestRunRow(entityId);
  };

  const handleRemoveEntity = (entityId: string) => {
    // TODO: Replace with proper confirmation modal
    requestRemoveEntity(entityId);
  };

  const handleCellClick = (entityId: string, agentGroupId: string, result: CellResult) => {
    if (result.status === 'pending') {
      requestRunAgentGroup(entityId, agentGroupId);
    } else {
      openCellDetail(entityId, agentGroupId, result);
    }
  };

  return (
    <div className="overflow-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <thead>
          {/* Agent group headers */}
          <tr>
            <th rowSpan={2} className="sticky left-0 top-0 z-20 bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-r border-border">
              {table.entityNameLabel}
            </th>
            {table.agentGroups.map(ag => (
              <th
                key={ag.id}
                colSpan={ag.outputColumns.length || 1}
                className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-2 text-center text-sm font-medium border-b border-r border-primary-foreground/20"
              >
                <span>{ag.inlineAgent?.displayName || ag.agentName || 'Agent'}</span>
                <span className="inline-flex gap-1 ml-2">
                  <button
                    onClick={() => handleRunAgentAll(ag.id)}
                    className="p-1 hover:bg-primary-foreground/20 rounded"
                    title="Run all for this agent"
                  >
                    <PlayIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRemoveAgent(ag.id)}
                    className="p-1 hover:bg-primary-foreground/20 rounded"
                    title="Remove agent"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </span>
              </th>
            ))}
          </tr>

          {/* Column headers */}
          <tr>
            {table.agentGroups.map(ag => (
              ag.outputColumns.length === 0 ? (
                <th key={ag.id} className="sticky top-10 z-10 bg-primary/10 px-4 py-2 text-xs font-medium text-primary border-b border-r border-border">
                  Result
                </th>
              ) : (
                ag.outputColumns.map(col => (
                  <th key={col.id} className="sticky top-10 z-10 bg-primary/10 px-4 py-2 text-xs font-medium text-primary border-b border-r border-border">
                    {col.label}
                  </th>
                ))
              )
            ))}
          </tr>
        </thead>

        <tbody>
          {table.entities.map(entity => (
            <tr key={entity.id} className="hover:bg-muted/50">
              {/* Entity cell */}
              <td className="sticky left-0 z-10 bg-muted/70 px-4 py-3 border-b border-r border-border min-w-[160px]">
                <div className="font-medium text-sm">{entity.name}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleRunRow(entity.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    <PlayIcon className="w-3 h-3" /> Run
                  </button>
                  <button
                    onClick={() => handleRemoveEntity(entity.id)}
                    className="inline-flex items-center p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>

              {/* Result cells */}
              {table.agentGroups.map(ag => {
                const result = (table.results[entity.id] || {})[ag.id] || { status: 'pending' as const };

                if (ag.outputColumns.length === 0) {
                  return (
                    <ResultCell
                      key={ag.id}
                      result={result}
                      onClick={() => handleCellClick(entity.id, ag.id, result)}
                    />
                  );
                }

                return ag.outputColumns.map(col => (
                  <ResultCell
                    key={col.id}
                    result={result}
                    columnKey={col.key}
                    onClick={() => handleCellClick(entity.id, ag.id, result)}
                  />
                ));
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ResultCellProps {
  result: CellResult;
  columnKey?: string;
  onClick: () => void;
}

function ResultCell({ result, columnKey, onClick }: ResultCellProps) {
  let content: React.ReactNode;
  let className = 'px-4 py-3 border-b border-r border-border text-sm cursor-pointer transition-colors min-w-[140px] max-w-[220px]';

  switch (result.status) {
    case 'pending':
      className += ' bg-muted/30 text-muted-foreground italic';
      content = 'Click to run';
      break;
    case 'running':
      className += ' bg-primary/10';
      content = (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Running...
        </span>
      );
      break;
    case 'error':
      className += ' bg-destructive/10 text-destructive';
      content = result.error || 'Error';
      break;
    case 'completed':
      className += ' hover:bg-primary/5';
      if (result.values) {
        const value = columnKey ? result.values[columnKey] : Object.values(result.values)[0];
        content = (
          <div className="line-clamp-3">{value || ''}</div>
        );
      } else {
        content = '';
      }
      break;
  }

  return (
    <td className={className} onClick={onClick} data-status={result.status}>
      {content}
    </td>
  );
}
