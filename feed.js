import {esc} from './model.js';

const bookmark='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg>';
export const outcomeLabels={unassessed:'Published',negative:'Negative finding',insufficient_evidence:'Inconclusive',data_blocked:'Data blocked',execution_blocked:'Execution blocked',promising:'Promising',historical_support:'Historical support',mixed:'Mixed findings'};
export const outcomeLabel=value=>outcomeLabels[value]||String(value||'Published').replaceAll('_',' ');
export const defaultFeedFilters=()=>({query:'',lane:'all',category:'all',outcome:'all',savedOnly:false,sort:'latest',limit:18});

export function selectFeed(items,filters,saved=[]){
  const query=String(filters.query||'').trim().toLowerCase();
  const result=items.filter(item=>item.origin!=='docs'
    &&(!filters.category||filters.category==='all'||(item.categories||[item.category]).includes(filters.category))
    &&(!query||`${item.title} ${item.excerpt||''} ${item.lane_name||item.lane} ${item.origin_label||''} ${item.id}`.toLowerCase().includes(query))
    &&(filters.lane==='all'||item.lane===filters.lane)
    &&(filters.outcome==='all'||item.outcome===filters.outcome)
    &&(!filters.savedOnly||saved.includes(item.id)));
  return filters.sort==='oldest'?result.slice().reverse():result;
}

function dateLabel(value){
  const date=new Date(value||'');
  return Number.isNaN(date.valueOf())?'Archive':date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function studyTitle(title){return String(title).replace(/^(?:US Equity Research\s+\d+|EQ\d+)\s*[—:\-]\s*/i,'');}

export function feedCard(item,saved=[],selected=[]){
  const marked=saved.includes(item.id), available=item.status==='available', outcome=Object.hasOwn(outcomeLabels,item.outcome)?item.outcome:'unassessed';
  const number=item.id.match(/eq(\d+)/i)?.[1];
  return `<article class="note-card" data-note-id="${esc(item.id)}">
    <button class="note-open" data-feed-open="${esc(item.id)}" ${available?'':'disabled'} aria-label="Read ${esc(item.title)}">
      <div class="note-index"><strong>${number?`EQ${esc(number)}`:'Note'}</strong><span>${esc(dateLabel(item.updated_at||item.created_at))}</span></div>
      <div class="note-body"><h2>${esc(studyTitle(item.title))}</h2><p>${esc(item.excerpt||item.warning||'Open the original research note.')}</p></div>
      <div class="note-tags"><span class="note-outcome outcome-${esc(outcome)}">${esc(available?outcomeLabel(item.outcome):'Source unavailable')}</span><span>${esc(item.origin_label||item.lane_name||item.lane)}</span><span>${item.reading_minutes||1} min read</span></div>
    </button><div class="note-footer"><label class="note-select" title="Select for PDF"><input type="checkbox" data-feed-select="${esc(item.id)}" aria-label="Select ${esc(item.title)} for PDF" ${selected.includes(item.id)?'checked':''} ${available?'':'disabled'}><span>Select</span></label><button class="note-save ${marked?'is-saved':''}" data-feed-save="${esc(item.id)}" aria-label="${marked?'Unsave':'Save'} ${esc(item.title)}" aria-pressed="${marked}" title="${marked?'Remove from saved':'Save for later'}">${bookmark}</button></div>
  </article>`;
}

const selectableIds=(data,filters,saved)=>selectFeed(data.items||[],filters,saved).filter(item=>item.status==='available').map(item=>item.id);
export const allSelected=(data,filters,saved,selected)=>{const ids=selectableIds(data,filters,saved);return ids.length>0&&ids.every(id=>selected.includes(id));};
/** Selecting all covers the whole filtered view, including notes not yet shown. */
export function toggleAll(data,filters,saved,selected){
  const ids=selectableIds(data,filters,saved);
  return allSelected(data,filters,saved,selected)?selected.filter(id=>!ids.includes(id)):[...new Set([...selected,...ids])];
}
export const selectAllLabel=(data,filters,saved,selected)=>allSelected(data,filters,saved,selected)?'Clear these':`Select all ${selectableIds(data,filters,saved).length}`;

export function selectionBar(count,status=''){
  if(!count&&!status)return '';
  return `<div class="feed-selection-bar"><span role="status" aria-live="polite">${status?esc(status):`${count} selected`}</span><div>${status?'':'<button class="text-button" data-action="feed-select-clear">Clear</button>'}<button class="button primary" data-action="feed-pdf" ${status?'disabled':''}>Download PDF</button></div></div>`;
}

export function feedResults(data,filters,saved=[],selected=[]){
  const matching=selectFeed(data.items||[],filters,saved), visible=matching.slice(0,filters.limit);
  return `<div class="feed-result-line ${filters.exportMode?'is-selecting':''}"><span role="status" aria-live="polite">${matching.length} ${matching.some(item=>item.origin==='docs')?(matching.length===1?'note':'notes'):(matching.length===1?'study':'studies')}${filters.savedOnly?' saved for later':''}</span><button class="text-link" id="feed-select-all" data-action="feed-select-all">${esc(selectAllLabel(data,filters,saved,selected))}</button></div>
    ${visible.length?`<div class="note-grid ${filters.exportMode?'is-selecting':''}">${visible.map(item=>feedCard(item,saved,selected)).join('')}</div>`:`<div class="feed-empty"><h2>${filters.savedOnly?'Your reading shelf is empty':'No notes match this view'}</h2><p>${filters.savedOnly?'Save a card to keep it here on this browser.':'Try another topic or a shorter search.'}</p><button class="button" data-action="feed-reset">${filters.savedOnly?'Explore all notes':'Clear filters'}</button></div>`}
    <div class="feed-end">${matching.length>visible.length?`<button class="button" data-action="feed-more">More notes <span>${visible.length} / ${matching.length}</span></button>`:visible.length?'<span>End of list</span>':''}</div>`;
}

export function feedPage(data,error='',filters=defaultFeedFilters(),saved=[],selected=[],pdfStatus='',ownerReports=''){
  if(data){const docs=data.items.filter(item=>item.origin==='docs');data={...data,items:data.items.filter(item=>item.origin!=='docs'),lanes:data.lanes.filter(lane=>lane.id!=='documentation'),report_count:data.report_count-docs.length};}
  const hero=`<header class="feed-heading"><div><h1>Fieldnotes</h1><p>Browse research reports and their findings.</p></div><div class="feed-heading-side"><span>${data?`${data.items.filter(item=>item.origin!=='docs').length} studies · ${data.report_count} documents`:'Independent research journal'}</span><button class="text-link" data-action="feed-refresh">Refresh notes</button></div></header>`;
  if(error)return hero+`<section class="panel feed-empty"><h2>We couldn’t load your notes</h2><p>${esc(error)}</p><button class="button" data-action="feed-refresh">Try again</button><p class="small">If the local service stopped, open the Workbench launcher in your project folder.</p></section>`;
  if(!data)return hero+'<div class="feed-skeleton" aria-label="Loading research notes"><div></div><div></div><div></div></div>';
  const ownerActive=filters.category==='owner';
  const outcomes=[...new Set(data.items.map(item=>item.outcome))];
  return hero+`${potentialList(data.potential||[])}${(data.warnings||[]).map(w=>`<p class="small muted" role="status">${esc(w.source)}: ${esc(w.message)}</p>`).join('')}<section class="feed-browse" aria-label="Browse research notes"><div class="feed-navigation"><div class="feed-topics" role="group" aria-label="Report category"><button data-feed-category="owner" aria-pressed="${ownerActive}">Owner Reports</button><button data-feed-category="all" aria-pressed="${!filters.category||filters.category==='all'}">All reports</button>${(data.report_categories||[]).filter(category=>category.count>0).map(category=>`<button data-feed-category="${esc(category.id)}" aria-pressed="${filters.category===category.id}">${esc(category.name)} <small>${category.count}</small></button>`).join('')}</div><button class="feed-saved-toggle" data-action="feed-saved" aria-pressed="${filters.savedOnly}">${bookmark} Saved <span>${saved.filter(id=>data.items.some(i=>i.id===id)).length}</span></button></div>
    ${ownerActive?ownerReports:`    <div class="feed-tools"><label class="feed-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="feed-search" type="search" placeholder="Find a question, a finding, a study…" aria-label="Search research notes" value="${esc(filters.query)}"></label><button class="button" data-action="feed-export-mode" aria-pressed="${Boolean(filters.exportMode)}">${filters.exportMode?'Done selecting':'Export PDF'}</button>
    <details class="feed-filters" id="feed-filters" ${filters.filtersOpen?'open':''}><summary>Filters</summary><div class="feed-filter-fields"><label class="sr-only" for="feed-lane">Asset class</label><select id="feed-lane" aria-label="Asset class"><option value="all">All asset classes</option>${data.lanes.filter(lane=>data.items.some(item=>item.lane===lane.id)).map(lane=>`<option value="${esc(lane.id)}" ${filters.lane===lane.id?'selected':''}>${esc(lane.name)}</option>`).join('')}</select><label class="sr-only" for="feed-outcome">Filter by outcome</label><select id="feed-outcome" aria-label="Filter by outcome"><option value="all">Every outcome</option>${outcomes.map(o=>`<option value="${esc(o)}" ${filters.outcome===o?'selected':''}>${esc(outcomeLabel(o))}</option>`).join('')}</select><select id="feed-sort" aria-label="Sort research notes"><option value="latest" ${filters.sort==='latest'?'selected':''}>Latest first</option><option value="oldest" ${filters.sort==='oldest'?'selected':''}>Oldest first</option></select></div></details></div>${filters.category==='problem'?'<p class="small muted feed-category-note">Data and execution blocks, plus documented operational issues. Negative economics alone is not a problem classification.</p>':''}<div id="feed-results">${feedResults(data,filters,saved,selected)}</div><div id="feed-selection">${selectionBar(selected.length,pdfStatus)}</div>`}</section>`;
}

export function relatedEvidence(brief){
  if(!brief?.related?.length)return '';
  return `<details class="brief-evidence"><summary>Supporting documents <span>${brief.related.length}</span></summary><p>Original reports, expert notes and JSON evidence from this study.</p>${brief.related.map(p=>p.status==='available'?`<button class="report-link" data-publication="${esc(p.id)}"><span>${esc(p.title)}</span><small>${p.kind==='markdown'?'NOTE':'JSON'} ↗</small></button>`:`<p>${esc(p.title)} · Source unavailable</p>`).join('')}</details>`;
}

export function potentialList(rows=[]){
  if(!rows.length)return '';
  return `<details class="brief-evidence"><summary>Potential <span>${rows.length}</span></summary>${rows.map(row=>`<p>${row.publication_id?`<button class="report-link" data-publication="${esc(row.publication_id)}">${esc(row.guess)} · ${esc(row.title)}</button>`:`<span>${esc(row.guess)} · ${esc(row.title)}</span>`}</p>`).join('')}</details>`;
}
