export const Spinner = ({ label = 'Loading…' }) => (
  <div className="flex items-center gap-2 p-6 text-gray-500">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
    {label}
  </div>
);

export const ErrorBox = ({ message, onRetry }) => (
  <div className="m-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">
    <p>{message}</p>
    {onRetry && (
      <button onClick={() => onRetry()} className="mt-2 rounded bg-red-600 px-3 py-1 text-white">
        Retry
      </button>
    )}
  </div>
);