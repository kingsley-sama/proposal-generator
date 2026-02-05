'use client';

interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved';
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <div
      className={`fixed bottom-5 right-5 px-5 py-3 rounded-lg text-sm flex items-center gap-2 shadow-lg transition-all z-50 ${
        status === 'saving'
          ? 'bg-blue-600/95 text-white'
          : 'bg-green-600/95 text-white'
      }`}
    >
      <span className="text-base">
        {status === 'saving' ? '⏳' : '✅'}
      </span>
      <span>{status === 'saving' ? 'Saving...' : 'Saved'}</span>
    </div>
  );
}
