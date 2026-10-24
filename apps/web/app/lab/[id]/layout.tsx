import type { ReactNode } from 'react';
import { pageMetadata,publicExperiments } from '../../../lib/seo';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=publicExperiments[id];return item?pageMetadata(item.name,item.description,`/lab/${id}`):pageMetadata('Experiment unavailable','Choose a biology experiment in the Senku lab.','/lab',true);}
export default function Layout({children}:{children:ReactNode}){return children;}
