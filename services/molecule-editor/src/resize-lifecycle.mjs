/** Own the SDK resize listener and defer rendering until the real editor exists. */
export function installEditorResize({throttle,dispatch,getState,target=window}){
 let disposed=false,pending=false;
 const update=()=>{if(disposed)return;const state=getState();if(!state.editor?.render){pending=true;return}pending=false;state.editor.render.update();dispatch({type:'CLEAR_VISIBLE',data:state.actionState.activeTool})};
 const onResize=throttle(250,update);
 const onReady=()=>{if(pending)update()};
 const dispose=()=>{if(disposed)return;disposed=true;pending=false;if(typeof onResize.cancel==='function')onResize.cancel();target.removeEventListener('resize',onResize);target.removeEventListener('senku-editor-ready',onReady);target.removeEventListener('senku-editor-dispose',dispose);target.removeEventListener('pagehide',dispose)};
 target.addEventListener('resize',onResize);target.addEventListener('senku-editor-ready',onReady);target.addEventListener('senku-editor-dispose',dispose);target.addEventListener('pagehide',dispose,{once:true});
 return dispose;
}
