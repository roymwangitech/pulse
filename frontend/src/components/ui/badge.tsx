import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'secondary';
}

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-twitter-blue/20 text-twitter-blue',
        variant === 'secondary' && 'bg-border text-muted-foreground',
        className
      )}
    >
      {children}
    </span>
  );
}
