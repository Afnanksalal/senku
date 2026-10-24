import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
 return {id:'/',name:'Senku',short_name:'Senku',description:'Explore science through real models, guided missions and experiments.',start_url:'/home',scope:'/',display:'standalone',background_color:'#e9efe8',theme_color:'#e9efe8',lang:'en',categories:['education','science'],icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
