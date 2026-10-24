import type { ReactNode } from 'react';
import { pageMetadata,publicGames } from '../../../lib/seo';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=publicGames[id];return item?pageMetadata(item.name,item.description,`/challenges/${id}`):pageMetadata('Challenge unavailable','Choose a playful science challenge.','/challenges',true);}
export default function Layout({children}:{children:ReactNode}){return children;}
