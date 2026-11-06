"use client";
import { useCallback, useEffect, useState } from "react";
export function useRemote<T>(url:string|null){
  const [state,setState]=useState<{url:string|null;data:T|null;error:string|null;loading:boolean}>({url:null,data:null,error:null,loading:false});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!url){setState({url:null,data:null,error:null,loading:false});return;}
    const controller=new AbortController();setState({url,data:null,error:null,loading:true});
    fetch(url,{signal:controller.signal,cache:"no-store"}).then(async response=>{
      const result=await response.json();if(!response.ok)throw new Error(result.error||`Request failed (${response.status})`);
      if(!controller.signal.aborted)setState({url,data:result,error:null,loading:false});
    }).catch(error=>{if(!controller.signal.aborted)setState({url,data:null,error:error.message,loading:false});});
    return()=>controller.abort();
  },[url,attempt]);
  const retry=useCallback(()=>setAttempt(a=>a+1),[]);
  return{data:state.url===url?state.data:null,error:state.url===url?state.error:null,loading:!!url&&(state.url!==url||state.loading),retry};
}
