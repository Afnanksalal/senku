'use client';
import { api, ApiError } from './api';
import type { Parameters } from '@senku/experiment-schema';

export type PersonalizedMission = {
  id: string; status: 'queued' | 'running' | 'completed'; lesson_id: string; lesson_version: string;
  title: string; introduction: string; prediction: { question: string; choices: [string,string,string] };
  manipulation_instruction: string; observation_question: string;
  focus_parameter: string; suggested_parameters: Parameters;
  assessment: { question: string; choices: [string,string,string] }; reflection_question: string;
  source: 'gemini' | 'fallback'; reason?: string;
};
export type MissionPreferences = { difficulty: 'gentle' | 'curious' | 'stretch'; interest?: string };
const inFlight = new Map<string, Promise<PersonalizedMission>>();
const storage = {
  get(key:string) { try { return sessionStorage.getItem(key); } catch { return null; } },
  put(key:string,value:string) { try { sessionStorage.setItem(key,value); } catch { /* Memory deduplication still works. */ } },
  remove(key:string) { try { sessionStorage.removeItem(key); } catch { /* Storage can be unavailable. */ } },
};
export function loadPersonalizedMission(owner:string, lesson:string, version:string, options:MissionPreferences={difficulty:'gentle'}, fresh=false):Promise<PersonalizedMission> {
  const cache=`senku:mission:${owner}:${lesson}:${version}:${encodeURIComponent(JSON.stringify(options))}`;
  if(inFlight.has(cache))return inFlight.get(cache)!;
  if(fresh){storage.remove(`${cache}:id`);storage.remove(`${cache}:key`);storage.put(`${cache}:variation`,crypto.randomUUID());}
  const work=(async()=>{
    const path=`/v1/lessons/${encodeURIComponent(lesson)}/personalize`;
    let mission:PersonalizedMission|undefined;
    const id=storage.get(`${cache}:id`);
    if(id){try{mission=await api<PersonalizedMission>(`${path}/${encodeURIComponent(id)}`,{auth:true});}catch(error){if(!(error instanceof ApiError)||error.status!==404)throw error;storage.remove(`${cache}:id`);}}
    if(!mission){const key=storage.get(`${cache}:key`)??crypto.randomUUID();storage.put(`${cache}:key`,key);const variation=storage.get(`${cache}:variation`);mission=await api<PersonalizedMission>(path,{method:'POST',auth:true,idempotencyKey:key,body:{...options,...(variation?{variation}:{})}});storage.put(`${cache}:id`,mission.id);}
    const deadline=Date.now()+120_000;
    while(mission.status!=='completed'){
      if(Date.now()>deadline)throw new Error('Your mission is still being prepared. Retry to check the same mission without starting another.');
      await new Promise(resolve=>setTimeout(resolve,1500));
      mission=await api<PersonalizedMission>(`${path}/${encodeURIComponent(mission.id)}`,{auth:true});
    }
    if(mission.lesson_id!==lesson||mission.lesson_version!==version)throw new Error('This mission belongs to a different lesson version. Choose a new mission.');
    return mission;
  })().finally(()=>inFlight.delete(cache));
  inFlight.set(cache,work);return work;
}
