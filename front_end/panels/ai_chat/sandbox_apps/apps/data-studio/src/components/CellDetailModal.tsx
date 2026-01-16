import { useModalStore } from './modals';
import { Button, Card } from '@/components/ui';
import { XIcon, CopyIcon } from './Icons';

export function CellDetailModal() {
  // FIXED: Use reactive Zustand hook instead of non-reactive getter
  const activeModal = useModalStore(state => state.activeModal);
  const cellDetailData = useModalStore(state => state.cellDetailData);
  const closeModal = useModalStore(state => state.closeModal);

  // Return null if modal is not active or no data
  if (activeModal !== 'cellDetail' || !cellDetailData) return null;

  const { result } = cellDetailData;

  let content = '';
  if (result.status === 'error') {
    content = 'Error: ' + (result.error || 'Unknown error');
  } else if (result.status === 'completed' && result.values) {
    content = Object.entries(result.values)
      .map(([k, v]) => k + ': ' + v)
      .join('\n\n');
  } else {
    content = 'Status: ' + result.status;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeModal}>
      <Card className="w-full max-w-lg mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Cell Detail</h2>
          <Button variant="ghost" size="icon" onClick={closeModal}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4">
          <pre className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap break-words max-h-80 overflow-auto font-mono">
            {content}
          </pre>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/50">
          <Button variant="outline" onClick={handleCopy}>
            <CopyIcon className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button onClick={closeModal}>Close</Button>
        </div>
      </Card>
    </div>
  );
}
