import React from 'react';

interface LoaderProps {
  label?: string;
}

const Loader: React.FC<LoaderProps> = ({ label = 'Analyzing' }) => {
  return (
    <div className="flex items-center gap-3 text-slate-200">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
      <span className="text-sm font-medium tracking-wide">{label}…</span>
    </div>
  );
};

export default Loader;
