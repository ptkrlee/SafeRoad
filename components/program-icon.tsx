export type ProgramIconName='guide'|'nature'|'clock'|'people'|'tape'|'stretch'|'walk'|'rest'|'recover'|'route'|'bag'|'health'|'message';
const shapes:Record<ProgramIconName,React.ReactNode>={
 bag:<><path d="M8 6V4a4 4 0 0 1 8 0v2M6 6h12l2 16H4L6 6Z"/><path d="M8 10h8v7H8v-7Z"/></>,
 health:<><path d="M20 12c-1 5-8 9-8 9S4 17 4 11a4 4 0 0 1 8-2 4 4 0 0 1 8 0"/><path d="M12 10v6m-3-3h6"/></>,
 message:<><path d="M21 4H3v13h5l4 4 4-4h5V4Z"/><path d="M7 8h10M7 12h7"/></>,
 guide:<><path d="M9 4h6l1 3h4v14H4V7h4l1-3Z"/><path d="m8 13 3 3 5-6M9 7h6"/></>,
 nature:<><path d="M20 4C8 3 3 10 7 16c6 5 14-1 13-12Z"/><path d="M4 21 17 8M10 15v-5m4 1h4"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
 people:<><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/></>,
 tape:<><path d="m4 14 10-10a3 3 0 0 1 4 0l2 2a3 3 0 0 1 0 4L10 20a3 3 0 0 1-4 0l-2-2a3 3 0 0 1 0-4Z"/><path d="m9 10 5 5m-3-7 5 5M7 15h.01M9 17h.01M16 7h.01M18 9h.01"/></>,
 stretch:<><circle cx="12" cy="4" r="2"/><path d="M12 7v7M4 7l8 3 8-3M12 14l-6 7m6-7 6 7"/></>,
 walk:<><circle cx="14" cy="4" r="2"/><path d="m10 10 3-3 3 5 4 1M5 12l4-1 2-3m1 5-3 8m3-8 4 3 1 5"/></>,
 rest:<><path d="M8 6 10 3h4l2 3h5v15H3V6h5Z"/><circle cx="12" cy="13" r="4"/><path d="M18 9h.01"/></>,
 recover:<><path d="M4 5h9l4 3v5H4V5Zm13 3h3v5h-3M8 13l-1 8h6l1-8M20 6v9M3 8H1m2 3H1"/></>,
 route:<><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/></>
};
export default function ProgramIcon({name}:{name:ProgramIconName}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;}
