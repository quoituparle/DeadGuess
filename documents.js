import {esc} from './model.js';

const groupOrder=['Start here','Research workflow','Infrastructure & tools','Data rules','Reference'];
export const documentationItems=data=>(data?.items||[]).filter(row=>row.origin==='docs');
export function documentationNavigation(items,selected,query=''){
  const text=query.trim().toLowerCase();
  const matching=items.filter(row=>`${row.title} ${row.doc_group||''}`.toLowerCase().includes(text));
  const names=[...new Set(matching.map(row=>row.doc_group||'Reference'))]
    .sort((a,b)=>groupOrder.indexOf(a)-groupOrder.indexOf(b));
  return names.map(group=>`<section class="doc-nav-group"><h2>${esc(group)}</h2>${matching.filter(row=>(row.doc_group||'Reference')===group).map(row=>`<a href="#documents/${encodeURIComponent(row.id)}" class="doc-nav-link ${selected===row.id?'is-current':''}" ${selected===row.id?'aria-current="page"':''}>${esc(row.title)}</a>`).join('')}</section>`).join('')||'<p class="small muted" role="status">No documents match this search.</p>';
}
export function documentationPage(data,error,selected,document=null,documentError='',query=''){
  const items=documentationItems(data);
  const metadata=items.find(row=>row.id===selected);
  const header='<header class="page-heading"><div><div class="eyebrow">PROJECT REFERENCE</div><h1>Documentation</h1><p>Architecture, workflows, tools and data rules.</p></div></header>';
  if(error)return header+`<section class="panel error-panel"><h2>Documentation unavailable</h2><p>${esc(error)}</p><button class="button" data-action="documents-refresh">Try again</button></section>`;
  if(!data)return header+'<section class="panel doc-loading" role="status">Loading the document library…</section>';
  const reading=documentError?`<div class="error-panel" role="alert"><h2>Document unavailable</h2><p>${esc(documentError)}</p><button class="button" data-action="documents-refresh">Try again</button></div>`:document?'<article id="documentation-body" class="markdown-body"></article>':'<div class="doc-loading" role="status">Loading document…</div>';
  return header+`<div class="documentation-layout">
    <aside class="documentation-sidebar" aria-label="Document library"><label for="documentation-search">Find a document</label><input id="documentation-search" type="search" value="${esc(query)}" placeholder="Search titles or topics…" autocomplete="off"><nav id="documentation-index" aria-label="Documentation topics">${documentationNavigation(items,selected,query)}</nav></aside>
    <section class="documentation-paper" aria-label="Document reading area"><header class="doc-title"><div class="eyebrow">${esc(metadata?.doc_group||'REFERENCE')}</div><h2>${esc(document?.title||metadata?.title||'Select a document')}</h2><p class="small muted">Project documentation · Current version</p>${document?`<div class="doc-toolbar"><div class="report-view-toggle" role="group" aria-label="Document view"><button data-action="document-read" aria-pressed="true">Read</button><button data-action="document-source" aria-pressed="false">Source</button></div><button class="button" data-action="document-pdf">Download PDF</button></div><details class="doc-provenance"><summary>Source &amp; provenance</summary><p>${esc(document.source.path)}</p><code>SHA-256 ${esc(document.source.sha256)}</code></details>`:''}</header>${reading}</section>
    <aside class="documentation-outline" aria-label="On this page"><h2>On this page</h2><nav id="documentation-toc"></nav></aside>
  </div>`;
}
export function documentOutline(headings=[]){
  return headings.map(row=>`<button class="doc-toc-link ${row.level===3?'is-subheading':''}" data-doc-anchor="${esc(row.id)}">${esc(row.title)}</button>`).join('')||'<p class="small muted">No sections in this document.</p>';
}
