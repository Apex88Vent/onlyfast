import {useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {traceHref} from './traceNavigation';
export function useTraceRouter(){const navigate=useNavigate();return useMemo(()=>({push:(url:string)=>navigate(traceHref(url))}),[navigate]);}
