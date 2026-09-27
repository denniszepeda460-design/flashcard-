import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold tracking-tight transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-stone-900 text-stone-50 dark:bg-zinc-100 dark:text-zinc-900',
        secondary: 'border-stone-200 dark:border-zinc-800 bg-stone-100 text-stone-800 dark:bg-zinc-800 dark:text-zinc-200',
        success: 'border-green-200/60 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/60 dark:text-green-300',
        warning: 'border-amber-200/60 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/60 dark:text-amber-300',
        danger: 'border-red-200/60 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/60 dark:text-red-300',
        blue: 'border-blue-200/60 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/60 dark:text-blue-300',
        outline: 'border-stone-200 dark:border-zinc-800 text-stone-700 dark:text-zinc-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
