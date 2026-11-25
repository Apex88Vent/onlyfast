import { Link } from 'react-router-dom';
import type { AnchorHTMLAttributes } from 'react';
import {traceHref} from './traceNavigation';
// Keep the original screen links inside the existing OnlyFast route.
export default function TraceLink({href='',...props}:AnchorHTMLAttributes<HTMLAnchorElement>){
  const to=traceHref(href);
  return <Link to={to} {...props}/>;
}
