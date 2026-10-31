import { useEffect, useState } from 'react';

export function Crop({ blob, alt = '' }: { blob: Blob; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url ? <img src={url} alt={alt} className="size-full object-cover" /> : null;
}
