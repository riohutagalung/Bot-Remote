import React, {useId} from 'react';

export default function HelpButton({help,children,...props}) {
  const description=useId();
  return <span className="relative inline-flex group" tabIndex={props.disabled ? 0 : undefined} aria-describedby={help?description:undefined}>
    <button {...props} aria-describedby={help?description:undefined}>{children}</button>
    {help && <span id={description} role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 max-w-[85vw] rounded-xl border border-slate-600 bg-slate-800 p-3 text-left text-xs font-normal leading-relaxed text-white shadow-xl opacity-0 invisible transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">{help}</span>}
  </span>;
}
