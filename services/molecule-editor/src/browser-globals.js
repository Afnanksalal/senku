// Browser compatibility for transitive formatting utilities. No Node process or filesystem is exposed.
export const process={env:{NODE_ENV:'production'},browser:true,versions:{},noDeprecation:true,nextTick:(callback,...args)=>queueMicrotask(()=>callback(...args)),emitWarning:message=>console.warn(String(message))};
