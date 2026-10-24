import type { Metadata } from 'next';

const configured = process.env.SENKU_SITE_URL?.trim();
function resolveOrigin() {
  try { const url = new URL(configured || 'http://localhost:3000'); if (!['http:','https:'].includes(url.protocol)) throw new Error(); return url.origin; }
  catch { return 'http://localhost:3000'; }
}
export const siteOrigin = resolveOrigin();
const host = new URL(siteOrigin).hostname;
export const publicIndexingEnabled = !!configured && siteOrigin.startsWith('https:') && !/^(localhost|127\.|0\.0\.0\.0$|\[?::1\]?$)/i.test(host) && !host.endsWith('.localhost') && !host.endsWith('.local');
export const siteDescription = 'Explore biology with Senku. Follow your questions into personal science missions, playful experiments, 3D discoveries and research you can check.';
export const socialImages = [
  { url: '/social/senku-og.png', width: 1200, height: 630, alt: 'Senku, a playful biology learning laboratory', type: 'image/png' },
  { url: '/social/senku-og-square.png', width: 1200, height: 1200, alt: 'Senku science learning companion', type: 'image/png' },
];
export function pageMetadata(title:string,description:string,path:string,privatePage=false):Metadata {
  const index=publicIndexingEnabled&&!privatePage;
  return {
    title,description,alternates:{canonical:path},
    robots:{index,follow:index,googleBot:{index,follow:index,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},
    openGraph:{type:'website',locale:'en_US',siteName:'Senku',title:`${title} | Senku`,description,url:path,images:socialImages},
    twitter:{card:'summary_large_image',title:`${title} | Senku`,description,images:[{url:socialImages[0].url,alt:socialImages[0].alt}]},
  };
}
export const rootMetadata:Metadata={
  ...pageMetadata('Science you can explore',siteDescription,'/'),
  metadataBase:new URL(siteOrigin),
  title:{default:'Senku | Science you can explore',template:'%s | Senku'},
  applicationName:'Senku',category:'education',
  keywords:['Senku','science learning','biology experiments','science companion','interactive science','virtual biology lab','science games','3D molecular structures','personalized science missions','learn biology'],
  referrer:'strict-origin-when-cross-origin',
};
// Public catalog labels only. Never fetch personalizations, account data or private run IDs for metadata.
export const publicExperiments:Record<string,{name:string;description:string}>={
  'molecule-sketchbook':{name:'Molecule Sketchbook',description:'Get closer to small molecules and turn their three-dimensional structures around.'},
  'cell-energy':{name:'Save the Cell',description:'Help a hungry cell and explore how oxygen, glucose and demand affect its energy.'},
  'enzyme-explorer':{name:'Enzyme Explorer',description:'Change the conditions and discover what makes an enzyme reaction speed up or slow down.'},
  'population-dynamics':{name:'Population Dynamics',description:'Experiment with logistic growth, population size and carrying capacity.'},
  'genetics-lab':{name:'Genetics Lab',description:'Explore inherited traits and compare expected outcomes with a virtual sample.'},
  'diffusion-playground':{name:'Diffusion Playground',description:'Explore diffusion across a closed two-dimensional grid.'},
  'ecosystem-rescue':{name:'Ecosystem Rescue',description:'Explore relationships between nutrients, algae and oxygen in a simplified ecosystem.'},
  'pathway-playground':{name:'Pathway Playground',description:'Connect reactions, try a change and discover how a pathway responds over time.'},
  'metabolism-explorer':{name:'Metabolism Explorer',description:'Explore how a tiny metabolic network balances its resources and energy needs.'},
  'cell-colony':{name:'Cell Colony',description:'Explore a small colony of cells and observe changes over time.'},
};
export const publicGames:Record<string,{name:string;description:string}>={
  'restore-cell':{name:'Restore the Cell',description:'Help a hungry cell in a fresh science puzzle. Try a change and discover what makes a difference.'},
  'enzyme-saturation':{name:'Enzyme Sprint',description:'Race toward an enzyme discovery with playful challenges and hands-on experiments.'},
  'population-recovery':{name:'Population Recovery',description:'Help a tiny population recover and explore how its growing conditions make a difference.'},
  'genetics-dominance':{name:'Inheritance Garden',description:'Explore inherited traits through playful genetics challenges and virtual experiments.'},
};
export const publicRoutes=[
  '/', '/welcome','/learn','/lab','/challenges','/discover','/docking',
  ...Object.keys(publicExperiments).flatMap(id=>[`/lab/${id}`,`/learn/${id}-mission`]),
  ...Object.keys(publicGames).map(id=>`/challenges/${id}`),
];
export function structuredData(){return {
  '@context':'https://schema.org','@graph':[
    {'@type':'WebSite','@id':`${siteOrigin}/#website`,url:siteOrigin,name:'Senku',description:siteDescription,inLanguage:'en'},
    {'@type':'WebApplication','@id':`${siteOrigin}/#application`,name:'Senku',url:siteOrigin,description:siteDescription,applicationCategory:'EducationalApplication',operatingSystem:'Web browser',inLanguage:'en'},
  ],
};}
