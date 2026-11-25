import {ChevronDown} from 'lucide-react';
import type {ReactNode} from 'react';
import {Card} from '@/components/ui/card';
export function ReviewSection({id,title,open,onToggle,children}:{id:string;title:string;open:boolean;onToggle:()=>void;children?:ReactNode}){
 return <Card className="min-w-0 overflow-hidden rounded-2xl bg-card"><h3><button type="button" onClick={onToggle} aria-expanded={open} aria-controls={'trace-section-'+id} className="flex min-h-12 w-full items-center justify-between gap-3 p-3 text-left font-semibold sm:p-4">{title}<ChevronDown className={'h-4 w-4 shrink-0 transition-transform '+(open?'rotate-180':'')} aria-hidden="true"/></button></h3>{open&&<div id={'trace-section-'+id} className="min-w-0 space-y-3 border-t border-border p-3 sm:p-4">{children}</div>}</Card>;
}
