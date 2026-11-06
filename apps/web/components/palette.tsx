"use client";
import { useEffect, useRef, useState, useId } from "react";
export function Palette({ open, onClose, items, onSelect, title = "Find a file" }: { open: boolean; onClose: () => void; items: { label: string; value: string }[]; onSelect: (value: string) => void; title?: string }) {
  const uid=useId();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const filtered = items.filter(item => `${item.label} ${item.value}`.toLowerCase().includes(query.toLowerCase())).slice(0,40);
  useEffect(() => { if (open) { dialog.current?.showModal(); input.current?.focus(); } else dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} className="palette" aria-labelledby={`${uid}-title`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
    if (e.key === "Enter" && filtered[index]) { e.preventDefault(); onSelect(filtered[index].value); onClose(); }
  }}><div className="palette-heading"><label id={`${uid}-title`} htmlFor={`${uid}-input`}>{title}</label><button onClick={onClose} aria-label="Close search">ESC</button></div><input id={`${uid}-input`} ref={input} value={query} onChange={e => { setQuery(e.target.value); setIndex(0); }} placeholder="Type to search…" autoComplete="off" role="combobox" aria-expanded="true" aria-controls={`${uid}-results`} aria-activedescendant={filtered[index] ? `${uid}-result-${index}` : undefined}/><div id={`${uid}-results`} role="listbox" data-lenis-prevent>{(open?filtered.slice(0,40):[]).map((item, i) => <button role="option" aria-selected={i === index} id={`${uid}-result-${i}`} key={item.value} onClick={() => { onSelect(item.value); onClose(); }}>{item.label}<span>↵</span></button>)}{!filtered.length && <p>No matching files.</p>}</div><div className="palette-footer mono">↑ ↓ TO NAVIGATE · ENTER TO OPEN</div></dialog>;
}
