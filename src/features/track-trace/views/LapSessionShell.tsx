import type { ReactNode } from 'react';
export function LapSessionShell({children}:{children:ReactNode;authBypassEnabled?:boolean}){
  return <div className="min-w-0 space-y-4 text-foreground">{children}</div>;
}
