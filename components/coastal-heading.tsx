import type {ReactNode} from 'react';
import {programPhotos} from '@/lib/site-photos';

/** A decorative coastal photograph, kept separate from readable heading text. */
export default function CoastalHeading({children,photo='main'}:{children:ReactNode;photo?:'main'|'namparang'}){
 const image=programPhotos[photo];
 return <div className="coastal-heading"><div className="coastal-heading-photo" aria-hidden="true"><img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" style={{objectPosition:image.position}}/></div><div className="coastal-heading-copy">{children}</div></div>;
}
