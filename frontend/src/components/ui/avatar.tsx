import { cn } from '@/lib/utils';
import Image from 'next/image';

interface AvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 32, md: 40, lg: 56 };

export function Avatar({ src, alt, size = 'md', className }: AvatarProps) {
  const px = sizes[size];
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full bg-border', className)}
      style={{ width: px, height: px }}
    >
      <Image src={src} alt={alt} width={px} height={px} className="object-cover" unoptimized />
    </div>
  );
}
