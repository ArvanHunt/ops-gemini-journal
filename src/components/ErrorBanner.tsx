import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry, onDismiss }) => {
  return (
    <div
      role="alert"
      className="p-3.5 bg-red-950/80 border border-red-800 text-red-200 rounded-xl flex items-center justify-between shadow-md mb-4 text-sm animate-fadeIn"
    >
      <div className="flex items-center space-x-2.5">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center space-x-1 px-3 py-1 bg-red-900/80 hover:bg-red-800 text-red-100 rounded-lg text-xs font-semibold border border-red-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-red-900/50 rounded text-red-300 hover:text-red-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
