"use client";
import { useState } from "react";
export function Feedback({slug}:{slug:string}){const[answer,setAnswer]=useState("");return <div className="docs-feedback"><span>Was this page useful? </span><button className="copy-button" onClick={()=>{localStorage.setItem(`pulsepay:docs-feedback:${slug}`,"useful");setAnswer("Thanks. Your vote is saved on this device.");}}>Yes</button><a className="copy-button" href={`https://github.com/lviffy/ETHGLOBAL/issues/new?title=${encodeURIComponent(`Docs feedback: ${slug}`)}`}>Needs work ↗</a>{answer&&<p role="status">{answer}</p>}</div>;}
