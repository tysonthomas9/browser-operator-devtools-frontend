import { useState } from 'react';
import { useModalStore } from './modals';
import { useDataStudioStore } from '../store';
import { Button, Input, Card } from '@/components/ui';
import { XIcon } from './Icons';

export function CreateTableModal() {
  // FIXED: Use reactive Zustand hook instead of non-reactive getter
  const activeModal = useModalStore(state => state.activeModal);
  const closeModal = useModalStore(state => state.closeModal);
  const requestCreateTable = useDataStudioStore(state => state.requestCreateTable);

  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityLabel, setEntityLabel] = useState('');
  const [error, setError] = useState('');

  // Return null if modal is not active
  if (activeModal !== 'createTable') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields and show error
    if (!name.trim()) {
      setError('Table name is required');
      return;
    }
    if (!entityType.trim()) {
      setError('Entity type is required');
      return;
    }
    if (!entityLabel.trim()) {
      setError('Entity name column label is required');
      return;
    }

    setError('');

    // Send action to server via request function
    requestCreateTable(name.trim(), entityType.trim(), entityLabel.trim());

    setName('');
    setEntityType('');
    setEntityLabel('');
    closeModal();
  };

  const handleClose = () => {
    setName('');
    setEntityType('');
    setEntityLabel('');
    setError('');
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Create New Table</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md" data-testid="create-table-error">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Table Name</label>
            <Input
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="e.g., Q4 Competitor Analysis"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entity Type</label>
            <Input
              value={entityType}
              onInput={(e) => setEntityType((e.target as HTMLInputElement).value)}
              placeholder="e.g., Competitor, Product, Lead"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Entity Name Column Label</label>
            <Input
              value={entityLabel}
              onInput={(e) => setEntityLabel((e.target as HTMLInputElement).value)}
              placeholder="e.g., Company Name, Product Name"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Create Table</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
