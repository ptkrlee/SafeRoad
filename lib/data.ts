import { configured, database } from './supabase';
import { initialSessions, initialSettings, type Session, type Settings } from './domain';
export async function publicData(): Promise<{sessions:Session[];settings:Settings;connected:boolean;error:boolean}> {
  if (!configured()) return {sessions:initialSessions,settings:initialSettings,connected:false,error:false};
  try {
    const db=await database();
    const [s,c]=await Promise.all([db.rpc('session_list'),db.from('settings').select('*').eq('id',1).single()]);
    if(s.error || c.error) throw new Error('Configuration unavailable');
    return { sessions:s.data,settings:c.data,connected:true,error:false };
  } catch { return {sessions:initialSessions,settings:initialSettings,connected:false,error:true}; }
}
