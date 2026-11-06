"use client";
import { useRef, type ReactNode } from "react";
import { Table } from "@mantine/core";
import { useVirtualizer } from "@tanstack/react-virtual";
export function DataTable<T>({headers,rows,rowKey,renderRow,error,loading,retry,empty="No records in the loaded block range."}:{headers:string[];rows:T[];rowKey:(row:T)=>string;renderRow:(row:T)=>ReactNode;error?:string|null;loading?:boolean;retry?:()=>void;empty?:string}){
  const viewport=useRef<HTMLDivElement>(null);
  const virtual=useVirtualizer({count:rows.length,getScrollElement:()=>viewport.current,estimateSize:()=>62,overscan:10,enabled:rows.length>200});
  const items=virtual.getVirtualItems();const virtualized=rows.length>200;
  return <div className="merchant-table-scroll" ref={viewport} data-lenis-prevent tabIndex={0} aria-label="Scrollable data table"><Table className="merchant-table" withTableBorder={false} verticalSpacing={0} horizontalSpacing={0}><thead><tr>{headers.map(header=><th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>
    {loading?<tr className="empty-row"><td colSpan={headers.length} role="status">Reading live records…</td></tr>:error?<tr className="error-row"><td colSpan={headers.length} role="alert">Chain read unavailable<button onClick={retry}>Retry ↗</button><span className="error-detail">{error}</span></td></tr>:rows.length===0?<tr className="empty-row"><td colSpan={headers.length}>{empty}</td></tr>:virtualized?<>{items[0]?.start>0&&<tr aria-hidden="true"><td colSpan={headers.length} style={{height:items[0].start,padding:0,border:0}}/></tr>}{items.map(item=><tr key={rowKey(rows[item.index])} data-index={item.index} ref={virtual.measureElement}>{renderRow(rows[item.index])}</tr>)}{items.length>0&&<tr aria-hidden="true"><td colSpan={headers.length} style={{height:Math.max(0,virtual.getTotalSize()-items[items.length-1].end),padding:0,border:0}}/></tr>}</>:rows.map(row=><tr key={rowKey(row)}>{renderRow(row)}</tr>)}
  </tbody></Table></div>;
}
