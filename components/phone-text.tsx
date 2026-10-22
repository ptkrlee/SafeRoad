/** A selectable phone number, without call or message navigation. */
export default function PhoneText({value}:{value:string|null|undefined}){
 return value?<span className="phone-text" dir="ltr">{value}</span>:null;
}
