import type { ReactNode } from 'react';
export function LapSessionShell({children}:{children:ReactNode;authBypassEnabled?:boolean}){
  return <div className="rounded-[24px] bg-[#071018] p-4 text-white sm:p-6">{children}</div>;
}
