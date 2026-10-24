export type EntryIntent={id:string;owner:string;message:string;destination:string;created_at:number};
export function readEntryIntent(destination:string,owner?:string):EntryIntent|undefined{
 if(typeof window==='undefined'||!owner)return;
 try{const value=JSON.parse(sessionStorage.getItem('senku:entry-intent')??'null');if(value&&value.owner===owner&&value.destination===destination&&typeof value.id==='string'&&typeof value.message==='string'&&typeof value.created_at==='number'&&Date.now()-value.created_at>=0&&Date.now()-value.created_at<600000)return {...value,message:value.message.slice(0,240)};}catch{}
}
