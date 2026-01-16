import { useState } from 'react';
import { useModalStore } from './modals';
import { useDataStudioStore } from '../store';
import { Button, Input, Card } from '@/components/ui';
import { XIcon } from './Icons';

export function AddEntityModal() {
  // FIXED: Use reactive Zustand hook instead of non-reactive getter
  const activeModal = useModalStore(state => state.activeModal);
  const closeModal = useModalStore(state => state.closeModal);
  const table = useDataStudioStore(state => state.currentTable);
  const requestAddEntity = useDataStudioStore(state => state.requestAddEntity);

  const [name, setName] = useState('');
  const [context, setContext] = useState('');

  // Return null if modal is not active or no table
  if (activeModal !== 'addEntity' || !table) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    requestAddEntity(name.trim(), context.trim() || undefined);

    setName('');
    setContext('');
    closeModal();
  };

  const handleClose = () => {
    setName('');
    setContext('');
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <Card className="w-full max-w-md mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add {table.entityType}</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <Input
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="Enter name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Additional Context (optional)</label>
            <textarea
              value={context}
              onInput={(e) => setContext((e.target as HTMLTextAreaElement).value)}
              placeholder="Any additional context for the AI agents..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Create {table.entityType}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
