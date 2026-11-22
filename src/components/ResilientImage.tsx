import React, { useState } from 'react';
import { Glasses } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-stone-100 dark:bg-zinc-800 text-stone-400 dark:text-zinc-500 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Glasses className="w-8 h-8 mb-2 opacity-60" strokeWidth={1.5} />
        <span className="text-xs font-medium line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
