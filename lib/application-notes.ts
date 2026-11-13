import {z} from 'zod';
export const applicationNoteSchema=z.object({applicationId:z.string().uuid(),body:z.string().trim().min(1).max(1000),requestId:z.string().uuid()});
export type ApplicationNote={id:number;body:string;created_at:string};
export type ApplicationNoteSummary={application_id:string;total:number;notes:ApplicationNote[]};
export type ApplicationNotesState='ready'|'setup'|'error';
