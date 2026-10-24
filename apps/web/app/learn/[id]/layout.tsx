import type { ReactNode } from 'react';
import { pageMetadata,publicExperiments } from '../../../lib/seo';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const experiment=id.endsWith('-mission')?id.slice(0,-8):'';const item=publicExperiments[experiment];return item?pageMetadata(`${item.name} mission`,`${item.description} Predict, experiment and explain in a guided science mission.`,`/learn/${id}`):pageMetadata('Mission unavailable','Choose a science mission from the learning map.','/learn',true);}
export default function Layout({children}:{children:ReactNode}){return children;}
