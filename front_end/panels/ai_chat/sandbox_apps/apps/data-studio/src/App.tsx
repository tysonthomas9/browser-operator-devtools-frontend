import { useEffect } from 'react';
import { useDataStudioStore, selectIsTableView } from './store';
import { initBridge } from './bridge';
import { Header } from './components/Header';
import { SelectorView } from './components/SelectorView';
import { TableView } from './components/TableView';
import { CreateTableModal } from './components/CreateTableModal';
import { AddEntityModal } from './components/AddEntityModal';
import { AddAgentModal } from './components/AddAgentModal';
import { CellDetailModal } from './components/CellDetailModal';
import { Notification } from './components/Notification';

export function App() {
  const showTable = useDataStudioStore(selectIsTableView);

  useEffect(() => {
    initBridge();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <main className="flex-1 overflow-hidden">
        {showTable ? <TableView /> : <SelectorView />}
      </main>

      {/* Modals */}
      <CreateTableModal />
      <AddEntityModal />
      <AddAgentModal />
      <CellDetailModal />

      {/* Notifications */}
      <Notification />
    </div>
  );
}
