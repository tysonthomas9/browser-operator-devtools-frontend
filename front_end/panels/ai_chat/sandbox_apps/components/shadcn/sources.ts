// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * shadcn/ui Component Sources
 *
 * These are the source files for shadcn-style components that get injected
 * into each sandbox app's VFS. They use:
 * - Preact (not React)
 * - Tailwind CSS (via CDN in previewHtml)
 * - clsx/tailwind-merge (via esm.sh)
 */

import type {VirtualFileMap} from '../../types/SandboxTypes.js';

/**
 * utils.ts - cn() helper for merging class names
 */
export const UTILS_SOURCE = `// Utility for merging Tailwind classes
// Note: No external= parameter needed since clsx/twMerge don't use Preact
import { clsx, type ClassValue } from 'https://esm.sh/clsx@2.0.0?target=es2022';
import { twMerge } from 'https://esm.sh/tailwind-merge@2.2.0?target=es2022';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

/**
 * Button.tsx - Button component with variants
 */
export const BUTTON_SOURCE = `import { h } from 'preact';
import { cn } from './utils';

export interface ButtonProps extends h.JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const buttonVariants = {
  base: 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  variant: {
    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  },
  size: {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8',
    icon: 'h-9 w-9',
  },
};

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants.base,
        buttonVariants.variant[variant],
        buttonVariants.size[size],
        className
      )}
      {...props}
    />
  );
}
`;

/**
 * Input.tsx - Input component
 */
export const INPUT_SOURCE = `import { h } from 'preact';
import { cn } from './utils';

export interface InputProps extends h.JSX.HTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
`;

/**
 * Card.tsx - Card components
 */
export const CARD_SOURCE = `import { h, ComponentChildren } from 'preact';
import { cn } from './utils';

interface CardProps extends h.JSX.HTMLAttributes<HTMLDivElement> {
  children?: ComponentChildren;
}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: CardProps) {
  return (
    <h3
      className={cn('font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: CardProps) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  );
}
`;

/**
 * Badge.tsx - Badge component with variants
 */
export const BADGE_SOURCE = `import { h, ComponentChildren } from 'preact';
import { cn } from './utils';

export interface BadgeProps extends h.JSX.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children?: ComponentChildren;
}

const badgeVariants = {
  base: 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  variant: {
    default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
    outline: 'text-foreground',
  },
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants.base, badgeVariants.variant[variant], className)}
      {...props}
    />
  );
}
`;

/**
 * Tabs.tsx - Tabs components
 */
export const TABS_SOURCE = `import { h, ComponentChildren, createContext } from 'preact';
import { useState, useContext } from 'preact/hooks';
import { cn } from './utils';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: ComponentChildren;
}

export function Tabs({ defaultValue = '', value, onValueChange, className, children }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;
  const handleChange = onValueChange ?? setInternalValue;

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps extends h.JSX.HTMLAttributes<HTMLDivElement> {
  children?: ComponentChildren;
}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className
      )}
      role="tablist"
      {...props}
    />
  );
}

interface TabsTriggerProps extends h.JSX.HTMLAttributes<HTMLButtonElement> {
  value: string;
  children?: ComponentChildren;
}

export function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive && 'bg-background text-foreground shadow',
        className
      )}
      onClick={() => context.onValueChange(value)}
      {...props}
    />
  );
}

interface TabsContentProps extends h.JSX.HTMLAttributes<HTMLDivElement> {
  value: string;
  children?: ComponentChildren;
}

export function TabsContent({ className, value, ...props }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    />
  );
}
`;

/**
 * Select.tsx - Select component
 */
export const SELECT_SOURCE = `import { h, ComponentChildren } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { cn } from './utils';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  children?: ComponentChildren;
  className?: string;
}

interface SelectItemProps {
  value: string;
  children?: ComponentChildren;
  className?: string;
}

export function Select({ value, onValueChange, placeholder, children, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-muted-foreground'
        )}
      >
        <span>{selectedLabel || value || placeholder}</span>
        <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {Array.isArray(children) ? children.map((child: any) => {
            if (child?.props?.value) {
              return (
                <button
                  key={child.props.value}
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    value === child.props.value && 'bg-accent'
                  )}
                  onClick={() => {
                    onValueChange?.(child.props.value);
                    setSelectedLabel(child.props.children);
                    setOpen(false);
                  }}
                >
                  {child.props.children}
                </button>
              );
            }
            return child;
          }) : children}
        </div>
      )}
    </div>
  );
}

export function SelectItem({ value, children, className }: SelectItemProps) {
  // This is a placeholder - actual rendering handled by Select
  return null;
}
`;

/**
 * Table.tsx - Table components
 */
export const TABLE_SOURCE = `import { h, ComponentChildren } from 'preact';
import { cn } from './utils';

interface TableProps extends h.JSX.HTMLAttributes<HTMLTableElement> {
  children?: ComponentChildren;
}

export function Table({ className, ...props }: TableProps) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

interface TableHeaderProps extends h.JSX.HTMLAttributes<HTMLTableSectionElement> {
  children?: ComponentChildren;
}

export function TableHeader({ className, ...props }: TableHeaderProps) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

interface TableBodyProps extends h.JSX.HTMLAttributes<HTMLTableSectionElement> {
  children?: ComponentChildren;
}

export function TableBody({ className, ...props }: TableBodyProps) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

interface TableRowProps extends h.JSX.HTMLAttributes<HTMLTableRowElement> {
  children?: ComponentChildren;
}

export function TableRow({ className, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className
      )}
      {...props}
    />
  );
}

interface TableHeadProps extends h.JSX.HTMLAttributes<HTMLTableCellElement> {
  children?: ComponentChildren;
}

export function TableHead({ className, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

interface TableCellProps extends h.JSX.HTMLAttributes<HTMLTableCellElement> {
  children?: ComponentChildren;
}

export function TableCell({ className, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}
`;

/**
 * index.ts - Barrel export
 */
export const INDEX_SOURCE = `// shadcn/ui components for sandbox apps
export { cn } from './utils';
export { Button, type ButtonProps } from './Button';
export { Input, type InputProps } from './Input';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
export { Badge, type BadgeProps } from './Badge';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export { Select, SelectItem } from './Select';
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table';
`;

/**
 * CSS variables for shadcn theming
 */
export const THEME_CSS = `:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
}

* {
  border-color: hsl(var(--border));
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
`;

/**
 * Get all shadcn component files as a VFS map
 */
export function getShadcnFiles(): VirtualFileMap {
  return {
    '/src/components/ui/utils.ts': UTILS_SOURCE,
    '/src/components/ui/Button.tsx': BUTTON_SOURCE,
    '/src/components/ui/Input.tsx': INPUT_SOURCE,
    '/src/components/ui/Card.tsx': CARD_SOURCE,
    '/src/components/ui/Badge.tsx': BADGE_SOURCE,
    '/src/components/ui/Tabs.tsx': TABS_SOURCE,
    '/src/components/ui/Select.tsx': SELECT_SOURCE,
    '/src/components/ui/Table.tsx': TABLE_SOURCE,
    '/src/components/ui/index.ts': INDEX_SOURCE,
  };
}

/**
 * Get CSS file with theme variables
 */
export function getShadcnThemeCSS(): string {
  return THEME_CSS;
}
