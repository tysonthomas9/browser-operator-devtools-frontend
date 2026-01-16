import { useDataStudioStore } from '../store';
import { sendAction } from '../bridge';
import { Button } from '@/components/ui';
import { TableIcon, SaveIcon, ArrowLeftIcon, XIcon } from './Icons';

export function Header() {
  const table = useDataStudioStore(state => state.currentTable);
  const view = useDataStudioStore(state => state.view);
  const requestGoBack = useDataStudioStore(state => state.requestGoBack);
  const requestSaveTable = useDataStudioStore(state => state.requestSaveTable);
  const isTableView = view === 'table';

  const handleSave = () => {
    requestSaveTable();
  };

  const handleBack = () => {
    requestGoBack();
  };

  const handleClose = () => {
    sendAction({ action: 'close' });
  };

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
          <TableIcon className="w-5 h-5" />
        </div>
        <h1 className="text-base font-semibold">Data Studio</h1>
        {table && (
          <span className="text-sm text-muted-foreground pl-3 border-l border-border">
            {table.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isTableView && (
          <>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <SaveIcon className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Back
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={handleClose} title="Close">
          <XIcon className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
