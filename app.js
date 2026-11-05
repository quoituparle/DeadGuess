import {esc, fmt, pct, signed, tone, date, dateTime, stageName, decision, pickStage, drawdowns, within, filterTrades, monthlyReturns, isNumber, csvCell} from './model.js';
import {lineChart, bindChart, bars} from './charts.js';
import {enhanceSelects, closeSelect} from './select.js';
import {mountReport} from './markdown.js';
import {researchPage, publicationList} from './research.js';
import {feedPage,feedResults,defaultFeedFilters,relatedEvidence,selectFeed,toggleAll,selectAllLabel,selectionBar,outcomeLabel} from './feed.js';
import {buildPdf} from './pdf.js';
import {documentationPage,documentationItems,documentationNavigation,documentOutline} from './documents.js';

const icons = {
  overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  experiments:'<path d="M9 3h6M10 3v6l-6 10a1.3 1.3 0 0 0 1.2 2h13.6a1.3 1.3 0 0 0 1.2-2L14 9V3M8 14h8"/>',
  data:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  journal:'<path d="M5 3h12a2 2 0 0 1 2 2v16H6a3 3 0 0 1 0-6h13M5 3v12M9 7h6M9 10h4"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron:'<path d="m8 10 4 4 4-4"/>',
  external:'<path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  refresh:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l1.5 1.5M18.5 18.5 20 20M4 20l1.5-1.5M18.5 5.5 20 4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7M12 7v.1"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  code:'<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const $ = selector => document.querySelector(selector);
const persist = {get(k,fallback){try{return localStorage.getItem(k)||fallback;}catch{return fallback;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const state = {project:persist.get('si-project','crypto'), projects:[], data:null, page:'overview', selected:'calendar', stage:'validation', range:null, filter:'', status:'all', sort:'updated', compare:[], tradeQuery:'', tradePage:0, tab:'analysis', loading:true};
document.documentElement.dataset.theme=persist.get('si-theme','light');
let fetchId=0, reportId=0, toastTimer, reportDocument;
let deskData=null, deskError='', deskFetchId=0;
let feedData=null, feedError='', feedFetchId=0, feedFilters={...defaultFeedFilters(),category:'owner'}, feedSelected=[], pdfStatus='';
let documentationData=null, documentationError='';
let ownerIds=null, ownerMessage='', ownerLoading=false;
let documentData=null, documentError='', documentFetchId=0, documentQuery='', documentSource=false;
let savedNotes;try{savedNotes=JSON.parse(persist.get('si-saved-notes','[]'));if(!Array.isArray(savedNotes))savedNotes=[];}catch{savedNotes=[];}
let archivePromise;
async function readArchive() {
  archivePromise ||= fetch(new URL('./data/archive.json', import.meta.url), {cache:'no-cache'})
    .then(response => {
      if (!response.ok) throw new Error('The published archive could not be loaded.');
      return response.json();
    })
    .catch(error => { archivePromise=null; throw error; });
  return archivePromise;
}
const api = async path => {
  if (path === '/projects') return {projects:[{id:'us-equities',name:'US equities'}]};
  const archive=await readArchive();
  if (path === '/feed') return archive.feed;
  if (path === '/owner-reports') return {items:archive.owners};
  const match=/^\/(?:owner-reports|research\/publications)\/([^/]+)(?:\/content)?$/.exec(path);
  const document=match&&archive.documents[decodeURIComponent(match[1])];
  if (!document) throw new Error('This report is not in the public archive.');
  return document;
};


function normalize(data){
  data.experiments=(data.experiments||[]).map(e=>({...e,name:e.name||e.id,english:e.english||'',category:e.category||'Research',hypothesis:e.hypothesis||'',stages:(e.stages||[]).map(s=>({...s,initial_equity:s.initial_equity??data.initial_capital??10000,metrics:s.metrics||{},series:s.series||[],benchmark:s.benchmark||[],trades:s.trades||[],gates:s.gates||{}}))}));
  data.reports ||= [];data.quality ||= [];data.sources ||= [];data.warnings ||= [];
  return data;
}
const currentExperiment=()=>state.data?.experiments.find(e=>e.id===state.selected)||state.data?.experiments[0];
const currentStage=()=>pickStage(currentExperiment(),state.stage);
const currency=()=>esc(state.data?.currency||'USDT');
const badge = d => {const [label,cls]=decision(d);return `<span class="badge ${esc(cls)}"><i></i>${esc(label)}</span>`;};
const navUrl=(page,extra='')=>`#${page}${extra}?project=${encodeURIComponent(state.project)}`;
const linkExperiment=e=>navUrl('experiment',`/${encodeURIComponent(e.id)}`);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function navigate(page,extra=''){location.hash=navUrl(page,extra);}

async function loadProject(){
  const id=++fetchId;
  state.loading=true;state.error=null;render();
  try {
    const data=normalize(await api(`/projects/${encodeURIComponent(state.project)}`));
    if(id!==fetchId)return;
    state.data=data;state.loading=false;
    if(!data.experiments.some(e=>e.id===state.selected))state.selected=data.experiments[0]?.id;
    render();
  }catch(error){if(id!==fetchId)return;state.error=error.message;state.loading=false;state.data=null;render();}
}
async function route(){
  const [path,query='']=(location.hash.slice(1)||'feed').split('?');
  const params=new URLSearchParams(query), project=params.get('project')||state.project;
  const [page,selected]=path.split('/');
  if (page==='feed' && ['all','eq','da','problem','owner'].includes(params.get('category'))) feedFilters.category=params.get('category');
  if(page==='owner-reports')feedFilters.category='owner';
  state.page='feed';
  if(page==='documents'){try{state.documentId=selected?decodeURIComponent(selected):'docs--project-guide';}catch{state.documentId='docs--project-guide';}}
  else if(selected){try{state.selected=decodeURIComponent(selected);}catch{state.selected='';}}
  state.range=null;state.tradePage=0;state.tradeQuery='';state.tab='analysis';
  const changed=state.project!==project;
  state.project=state.projects.some(p=>p.id===project)?project:state.projects[0]?.id;
  persist.set('si-project',state.project);
  if(state.page==='feed'){
    state.loading=false;state.error=null;render();await loadFeed();
    const requested=params.get('report');
    if(requested) {
      const archive=await readArchive();
      const id=Object.keys(archive.documents).find(id=>id.toLowerCase()===requested.toLowerCase() || id.split('-').includes(requested.toLowerCase()));
      if(id) await report(id,archive.owners.includes(id)?'owner':true);
    }
  }
  else if(state.page==='documents'){state.loading=false;state.error=null;await loadDocumentation();}
  else if(state.page==='research'){state.loading=false;state.error=null;render();await loadResearch();}
  else if(changed||!state.data||state.data.id!==state.project)await loadProject();else render();
}

async function loadResearch(){
  const request=++deskFetchId;
  try{const value=await api('/research');if(request!==deskFetchId)return;deskData=value;deskError='';}
  catch(error){if(request!==deskFetchId)return;deskError=error.message;}
  if(state.page==='research')render();
}

async function loadFeed(){
  const request=++feedFetchId;
  try{const value=await api('/feed');if(request!==feedFetchId)return;feedData=value;feedError='';}
  catch(error){if(request!==feedFetchId)return;feedError=error.message;}
  if(state.page==='feed')render();
}
function updateFeedResults(){if($('#feed-results')&&feedData){$('#feed-results').innerHTML=feedResults(feedData,feedFilters,savedNotes,feedSelected);}}

function updateSelection(){
  if($('#feed-selection'))$('#feed-selection').innerHTML=selectionBar(feedSelected.length,pdfStatus);
  if($('#feed-select-all')&&feedData)$('#feed-select-all').textContent=selectAllLabel(feedData,feedFilters,savedNotes,feedSelected);
}
function setPdfStatus(status){pdfStatus=status;updateSelection();}
async function downloadPdf(){
  if(pdfStatus||!feedData)return;
  const chosen=selectFeed(feedData.items,{...defaultFeedFilters(),sort:feedFilters.sort}).filter(item=>feedSelected.includes(item.id));
  if(!chosen.length)return;
  setPdfStatus('Preparing…');
  try{
    const result=await buildPdf(chosen,{load:item=>api(`/research/publications/${encodeURIComponent(item.id)}/content`),label:outcomeLabel,
      onProgress:p=>setPdfStatus(p.stage==='reading'?`Reading ${p.done} of ${p.total}…`:`Laying out ${p.total} ${p.total===1?'study':'studies'}…`)});
    download(result.name,result.blob,'application/pdf');
    toast(result.failed.length?`${result.name} downloaded. ${result.failed.length} unavailable, listed inside.`:`${result.name} downloaded`);
  }catch(error){toast(`PDF failed: ${error.message}`);}
  setPdfStatus('');
}

function shell(content){
  const active=state.page==='experiment'?'experiments':state.page;
  const inResearch=!['feed','documents'].includes(active);
  const researchNavigation=inResearch?`<nav class="research-navigation" aria-label="Research navigation">
    ${[['research','Desk'],['experiments','Experiments'],['overview','Summary'],['data','Evidence']].map(([id,label])=>
      `<a href="${navUrl(id)}" ${active===id?'aria-current="page"':''}>${label}</a>`).join('')}
    <label class="project-switch"><select id="project-select" aria-label="Select project">${state.projects.map(p=>`<option value="${esc(p.id)}" ${p.id===state.project?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>
  </nav>`:'';
  const link=([id,label])=>`<a href="${navUrl(id)}" class="nav-item ${(id==='research'?inResearch:active===id)?'active':''}" ${active===id?'aria-current="page"':''}>${label}${id==='experiments'&&state.data?`<small>${state.data.experiments.length}</small>`:''}</a>`;
  return `<header class="masthead"><div class="masthead-inner"><button class="icon-button mobile-menu" data-action="menu" aria-label="Toggle navigation">${icon('menu')}</button><a class="brand" href="${navUrl('feed')}" title="DeadGuess: Where trading hypotheses go to die." aria-label="DeadGuess Research Workbench"><span>Research Workbench</span></a>
    <nav class="site-nav" aria-label="Main navigation"><div class="nav-group">${[['feed','Fieldnotes']].map(link).join('')}<a class="nav-item" href="https://github.com/quoituparle/DeadGuess" target="_blank" rel="noopener noreferrer">Architecture &amp; Contact ↗</a></div></nav>
    <div class="top-actions"><button class="search-trigger" data-action="search" aria-label="Search research">${icon('search')}<span>Search</span><kbd>Ctrl K</kbd></button><button class="icon-button" data-action="theme" aria-label="Toggle color theme" title="Toggle color theme">${icon('sun')}</button></div></div></header>
    <main id="main" tabindex="-1">${researchNavigation}${content}</main><footer class="page-footer"><span>${icon('lock')} Public · read-only · published results only · simulated capital</span><button class="text-button" data-action="about">About this workbench</button></footer>`;
}
function heading(eyebrow,title,subtitle,actions=''){
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
const btn=(label,action,ico='arrow',cls='')=>`<button class="button ${cls}" data-action="${action}">${icon(ico)}${label}</button>`;
function stat(label,value,note,cls=''){
  return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${value}</div><div class="stat-note">${note}</div></div>`;
}
function render(){
  let content;
  if(state.page==='feed')content=state.error?feedPage(null,state.error,feedFilters,savedNotes,[],'',ownerReportsSection()):feedPage(feedData,feedError,feedFilters,savedNotes,feedSelected,pdfStatus,ownerReportsSection());
  else if(state.page==='documents')content=documentationPage(documentationData,documentationError,state.documentId,documentData,documentError,documentQuery);
  else if(state.page==='research')content=researchPage(deskData,deskError);
  else if(state.loading)content=`${heading('CONNECTING YOUR WORKSPACE','Research workbench','Reading published research results.')}<div class="skeleton-grid"><div></div><div></div><div></div></div><div class="skeleton-panel"></div>`;
  else if(state.error)content=`${heading('CONNECTION NEEDS ATTENTION','Workspace unavailable','No sample data has been substituted for your results.')}<div class="panel error-panel">${icon('info')}<h2>Check the published sources and try again</h2><p>${esc(state.error)}</p>${btn('Reconnect','refresh','refresh','primary')}</div>`;
  else if(state.page==='overview')content=state.data.mode==='infrastructure_only'?infrastructure():overview();
  else if(state.page==='experiments')content=library();
  else if(state.page==='experiment')content=experimentPage();
  else if(state.page==='data')content=dataPage();
  else content=journal();
  closeSelect();
  $('#app').innerHTML=shell(content);
  bindInteractions();
  if(state.page==='documents')mountDocumentation();
  if(state.page==='feed'&&$('#owner-reports'))bindOwnerReports();
}

function overview(){
  const data=state.data, all=data.experiments, selected=currentExperiment(), s=currentStage();
  const economic=all.filter(e=>pickStage(e)?.decision?.startsWith('evidence_against')).length;
  const blocked=all.filter(e=>['data_acquisition_failure','data_gate_failed','execution_infeasible'].includes(pickStage(e)?.decision)).length;
  const latest=[...all].sort((a,b)=>String(b.updated).localeCompare(String(a.updated)))[0];
  return heading('Overview','Research overview','From hypothesis to evidence.',`<span class="sync-time">${icon('check')} Local results loaded</span>${btn('Refresh workspace','refresh','refresh')}`)+
    `<div class="overview-intro"><span>${esc(data.name)} · ${all.length} independent experiments</span><span>${fmt(data.initial_capital,0)} ${currency()} default simulated capital</span></div>
    <section class="stats-grid" aria-label="Research summary">${stat('Experiments',String(all.length).padStart(2,'0'),'Every outcome, preserved')}${stat('Economic gate failed',String(economic).padStart(2,'0'),'Below the registered economic gates')}${stat('Data / execution blocked',String(blocked).padStart(2,'0'),'Data and execution limitations')}${stat('Access mode','READ ONLY','Sealed samples remain protected','text-stat')}</section>
    <div class="analysis-layout"><section class="panel chart-panel">${chartHeader(selected,s)}<div id="chart-body">${chartBody(s)}</div><div class="chart-foot"><span>${icon('info')} ${s?.series?.length?'Drag to select a range and explore linked records':'Published observations only'}</span><a href="${selected?linkExperiment(selected):navUrl('experiments')}">Explore experiment ${icon('arrow')}</a></div></section>
    <aside class="insight-column"><section class="panel latest-panel"><div class="section-kicker"><span class="eyebrow">LATEST FINDING</span><span class="mono">${esc(latest?.updated||'—')}</span></div><h2>${esc(latest?.name||'No experiments')}</h2>${badge(pickStage(latest)?.decision)}<p>${esc(pickStage(latest)?.note||'No published findings yet.')}</p>${latest?`<a class="text-link" href="${linkExperiment(latest)}">View the evidence ${icon('arrow')}</a>`:''}</section>
    <section class="panel principle-panel"><span class="eyebrow">Research boundary</span><p>${esc(data.boundary)}</p></section></aside></div>
    <section class="section-block"><div class="section-heading"><h2>Experiment index</h2><a href="${navUrl('experiments')}">View all ${icon('arrow')}</a></div>${experimentTable(all.slice(0,6))}</section>${warnings()}`;
}

function chartHeader(e,s){
  const m=s?.metrics||{};
  return `<div class="panel-head"><div><span class="eyebrow">${s?.series_kind==='realized_batches'?'REALIZED BATCH P&L':'EQUITY / ACCOUNT VALUE'}</span><h2>${esc(e?.name||'No results')}<span class="subtle"> / ${esc(stageName(s?.id))}</span></h2></div><div class="chart-controls"><select id="chart-experiment" aria-label="Select experiment">${state.data.experiments.map(x=>`<option value="${esc(x.id)}" ${x.id===e?.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div>
    <div class="chart-summary"><div><span class="chart-big ${tone(m.total_return)}">${pct(m.total_return)}</span><span class="small muted">${isNumber(m.total_return)?'Full-sample net return':'Full account return unavailable'}</span></div><div class="stage-toggle" role="group" aria-label="Stage">${e?.stages.map(stage=>`<button data-stage="${esc(stage.id)}" class="${stage.id===s?.id?'selected':''}">${esc(stageName(stage.id))}</button>`).join('')||''}</div></div>
    ${s?.series.length?`<div class="chart-legend"><span><i class="strategy"></i>Strategy equity</span>${s.benchmark.length?'<span><i class="reference"></i>Original benchmark</span>':''}<span class="range-label mono">${date((state.range?within(s.series,state.range):s.series)[0]?.t)} — ${date((state.range?within(s.series,state.range):s.series).at(-1)?.t)}</span>${state.range?'<button class="text-button" data-action="reset-range">Reset range</button>':''}</div>`:''}`;
}
function chartBody(s){
  if(!s)return '<div class="empty-chart">No published experiment results</div>';
  if(s.series.length)return lineChart(within(s.series,state.range),within(s.benchmark,state.range),{id:'equity',initial:s.initial_equity});
  if(s.batches?.length)return `<div class="batch-label">Realized batch P&L · ${currency()}</div>${bars(s.batches)}<div class="chart-caveat">Discrete realized batches; continuous NAV and drawdown are unavailable.</div>`;
  return `<div class="empty-chart"><h3>No continuous account series</h3><p>${esc(s.note)}</p>${badge(s.decision)}${s.descriptive?`<div class="descriptive-note">Available subset: ${s.descriptive.count} resolved events / ${signed(s.descriptive.pnl)} USDT<br>Without best event: ${signed(s.descriptive.without_best)} USDT<br><span>Not a full-cohort portfolio return.</span></div>`:''}</div>`;
}

function experimentTable(experiments,compare=false){
  return `<div class="table-wrap"><table class="experiment-table"><thead><tr>${compare?'<th class="check-cell">Compare </th>':''}<th>Experiment / mechanism</th><th>Stage</th><th>Outcome</th><th class="numeric">Net return</th><th class="numeric">Max drawdown</th><th>Updated</th><th><span class="sr-only">Open </span></th></tr></thead><tbody>${experiments.map(e=>{const s=pickStage(e),m=s?.metrics||{};return `<tr>${compare?`<td class="check-cell"><input type="checkbox" data-compare="${esc(e.id)}" aria-label="Compare ${esc(e.name)}" ${state.compare.includes(e.id)?'checked':''}></td>`:''}<td><a class="experiment-name" href="${linkExperiment(e)}"><div><strong>${esc(e.name)}</strong><small>${esc(e.english)} <span>· ${esc(e.category)}</span></small></div></a></td><td><span class="stage-label">${esc(stageName(s?.id))}</span></td><td>${badge(s?.decision)}</td><td class="numeric mono ${tone(m.total_return)}">${pct(m.total_return)}</td><td class="numeric mono">${pct(m.max_drawdown)}</td><td class="mono date-cell">${esc(e.updated||'—')}</td><td><a class="row-arrow" href="${linkExperiment(e)}" aria-label="Open ${esc(e.name)}">${icon('arrow')}</a></td></tr>`;}).join('')||`<tr><td colspan="${compare?8:7}" class="table-empty">No experiments match these filters</td></tr>`}</tbody></table></div>`;
}
function filteredExperiments(){
  return [...state.data.experiments].filter(e=>`${e.name} ${e.english} ${e.category}`.toLowerCase().includes(state.filter.toLowerCase())&&(state.status==='all'||decision(pickStage(e)?.decision)[1]===state.status)).sort((a,b)=>state.sort==='name'?a.name.localeCompare(b.name,'en'):String(b.updated).localeCompare(String(a.updated)));
}
function library(){
  if(state.data.mode==='infrastructure_only')return infrastructure('experiments');
  return heading('Library','Experiments','Original stages, costs and conclusions. Independent accounts, never pooled.',`<button class="button primary" data-action="compare">${icon('experiments')} Compare experiments <span id="compare-count">${state.compare.length}</span></button>`)+
    `<div class="filterbar"><label class="input-search">${icon('search')}<input id="experiment-search" placeholder="Search by name, mechanism or keyword" value="${esc(state.filter)}" aria-label="Filter experiments"></label><select id="status-filter" aria-label="Filter conclusions"><option value="all">All outcomes</option><option value="negative" ${state.status==='negative'?'selected':''}>Economic gate failed</option><option value="warning" ${state.status==='warning'?'selected':''}>Data / execution blocked</option><option value="neutral" ${state.status==='neutral'?'selected':''}>Insufficient evidence</option></select><select id="sort-filter" aria-label="Sort"><option value="updated">Recently updated</option><option value="name" ${state.sort==='name'?'selected':''}>Name</option></select></div>
    <section class="panel" id="experiment-results">${experimentTable(filteredExperiments(),true)}</section><div class="below-table"><span>${state.data.experiments.length} published experiments</span><span>An em dash means unavailable or not estimable, never zero.</span></div>${warnings()}`;
}

function experimentPage(){
  const e=currentExperiment(),s=currentStage();
  if(!e||!s)return heading('EXPERIMENT / UNAVAILABLE','No experiment results','This project has no published research experiments.')+`<a class="button" href="${navUrl('overview')}">Back to overview</a>`;
  const m=s.metrics;
  return `<a class="back-link" href="${navUrl('experiments')}">← Back to experiments</a>`+heading(`EXPERIMENT / ${esc(e.id.toUpperCase())}`,esc(e.name),`${esc(e.english)} <span class="subtitle-divider">/</span> ${esc(e.category)}`,`${btn('Export result','export','download')}${e.report?`<button class="button primary" data-report="${esc(e.report)}">${icon('journal')} Read report</button>`:''}`)+
    `<div class="experiment-meta">${badge(s.decision)}<span>${esc(stageName(s.id))}</span><span class="mono">${esc(e.updated||'—')}</span><span>${icon('lock')} Published result</span></div>
    <div class="hypothesis-strip"><span class="eyebrow">HYPOTHESIS</span><p>${esc(e.hypothesis)}</p></div>
    <section class="stats-grid detail-stats">${stat('Full-sample net return',pct(m.total_return),'Complete, execution-valid account',tone(m.total_return))}${stat('Max drawdown',pct(m.max_drawdown),'Peak-to-trough account loss')}${stat('Daily Sharpe',fmt(m.sharpe),'Original research definition')}${stat('Trade records',fmt(m.trades,0),'Count reported by the source')}</section>
    <div class="tabbar" role="tablist" aria-label="Experiment details">${[['analysis','Analysis'],['trades','Trades'],['evidence','Evidence & gates']].map(([id,label])=>`<button role="tab" aria-selected="${state.tab===id}" data-tab="${id}" class="${state.tab===id?'active':''}">${label}</button>`).join('')}<span>${esc(stageName(s.id))} · Observed history</span></div>
    ${state.tab==='analysis'?`<div class="panel chart-panel detail-chart">${chartHeader(e,s)}<div id="chart-body">${chartBody(s)}</div><div class="chart-foot"><span>${icon('info')} Range selection filters records. Headline metrics cover the full sample.</span>${state.range?'<button class="text-button" data-action="reset-range">Show all</button>':''}</div></div>
    ${s.series.length?`<div class="detail-lower"><section class="panel"><div class="panel-head"><div><h2>Drawdown</h2></div><span class="mono muted">Peaks use the full history</span></div>${lineChart(within(drawdowns(s.series,s.initial_equity),state.range),[],{id:'drawdown',percent:true})}</section><section class="panel monthly-panel"><div class="panel-head"><div><h2>Monthly returns</h2></div></div>${monthlyHeatmap(s.series,s.initial_equity)}</section></div>`:''}
    <div class="detail-lower"><section class="panel">${costs(s)}</section><section class="panel research-note"><h2>Reading this result</h2><p>${esc(s.note||'Read alongside the scope and limitations in the original report.')}</p>${e.report?`<button class="text-link" data-report="${esc(e.report)}">Read the report ${icon('arrow')}</button>`:''}</section></div>
    <section class="section-block"><div class="section-heading"><h2>Linked trade records</h2><button class="text-button" data-action="trade-export">${icon('download')} Export CSV</button></div>${tradeSection(s)}</section>`:state.tab==='trades'?`<section class="panel">${tradeSection(s)}</section>`:evidence(s)}${warnings()}`;
}
function monthlyHeatmap(points,initial){
  const values=monthlyReturns(points,initial),years=[...new Set(values.map(v=>v.month.slice(0,4)))];
  return `<div class="monthly-table"><div class="month-row month-head"><span>YEAR</span>${Array.from({length:12},(_,i)=>`<span>${i+1}</span>`).join('')}</div>${years.map(year=>`<div class="month-row"><strong>${year}</strong>${Array.from({length:12},(_,i)=>{const item=values.find(v=>v.month===`${year}-${String(i+1).padStart(2,'0')}`);return `<span class="month-cell ${item?tone(item.value):'missing'}" title="${year}-${String(i+1).padStart(2,'0')} / ${item?pct(item.value):'No data'}" style="--intensity:${item?Math.min(.55,.1+Math.abs(item.value)*2):0}">${item?fmt(item.value*100,1):'—'}</span>`;}).join('')}</div>`).join('')}<p class="small muted">Percent · Derived from daily account values · Gaps remain unavailable</p></div>`;
}
function costs(s){
  const a=s.attribution,m=s.metrics;
  const rows=a?[['Raw price P&L',a.raw_price_pnl],['Execution shortfall',a.slippage==null?null:-a.slippage],['Fees',a.fees==null?null:-a.fees],['Net P&L',a.net_pnl]]:[['Fees',m.fees],['Slippage cost',m.slippage],['Turnover / initial capital',m.turnover]];
  return `<div class="panel-head"><div><h2>${a?'P&L attribution':'Execution costs'}</h2></div><span class="mono muted">${a?currency():'Source definitions'}</span></div><div class="cost-rows">${rows.map(([label,value])=>`<div><span>${label}</span><strong class="mono ${a?tone(value):''}">${fmt(value)}</strong></div>`).join('')}</div><p class="cost-note">${a?'Accounting at the same quantities and clocks, not a zero-cost backtest.':'Missing cost components remain unavailable. Gross returns are not inferred.'}</p>`;
}
function tradeSection(s){
  return `<div class="trade-toolbar"><label class="input-search">${icon('search')}<input id="trade-search" placeholder="Filter by symbol" aria-label="Filter by symbol" value="${esc(state.tradeQuery)}"></label><span class="small muted">${state.range?`${date(state.range.start)} — ${date(state.range.end)} · Overlapping records`:'All published trades'} · UTC</span><button class="icon-button" data-action="trade-export" aria-label="Export trades as CSV">${icon('download')}</button></div><div id="trade-results">${tradeTable(s)}</div>`;
}
function tradeTable(s){
  const all=filterTrades(s.trades,state.range,state.tradeQuery),size=12,maxPage=Math.max(0,Math.ceil(all.length/size)-1);state.tradePage=Math.min(state.tradePage,maxPage);
  const rows=all.slice(state.tradePage*size,(state.tradePage+1)*size);
  return `<div class="table-wrap"><table><thead><tr><th>Symbol</th><th>Entry / UTC</th><th>Exit / UTC</th><th>Status</th><th class="numeric">Net P&L / ${currency()}</th></tr></thead><tbody>${rows.map(t=>`<tr><td class="mono symbol-cell">${esc(t.symbol)}</td><td class="mono date-cell">${dateTime(t.entry)}</td><td class="mono date-cell">${dateTime(t.exit)}</td><td><span class="trade-status ${['unresolved','data_failure'].includes(t.status)?'warning':''}">${({resolved:'Closed',no_fill:'No fill',unresolved:'Unresolved',data_failure:'Data unavailable'})[t.status]||esc(t.status)}</span></td><td class="numeric mono ${tone(t.pnl)}">${signed(t.pnl)}</td></tr>`).join('')||'<tr><td colspan="5" class="table-empty">No published records match this selection.</td></tr>'}</tbody></table></div><div class="pagination"><span>${all.length} rows · ${state.tradePage+1} / ${maxPage+1} pages</span><div><button class="button compact" data-action="prev-trades" ${state.tradePage===0?'disabled':''}>Previous</button><button class="button compact" data-action="next-trades" ${state.tradePage>=maxPage?'disabled':''}>Next</button></div></div>`;
}
const gateLabels={execution:'Execution validity',complete_weeks:'Complete weekly samples',scheduled_endpoint_coverage:'Scheduled endpoint coverage',event_clusters:'Event cluster count',event_groups:'Event group count',executed_trade_clusters:'Executed trade clusters',executed_trades:'Executed trades',contrast:'Control contrast',net:'Net return',source:'Source evidence',stress:'Cost stress',three_batches:'Three batches',complete_acquisition:'Complete acquisition',hourly_mark_coverage:'Hourly mark coverage',inception_unambiguous:'Unambiguous inception',minimum_trades:'Minimum trade count',net_profit:'Net profitability',two_listing_years:'Multiple listing years'};
function gates(s){return Object.entries(s.gates).map(([key,value])=>`<div class="gate-row"><span class="gate-icon ${value===true?'passed':'failed'}">${value===true?icon('check'):icon('close')}</span><span>${esc(gateLabels[key]||key)}</span><span class="gate-result">${value===true?'Passed':value===false?'Failed':'Unknown'}</span></div>`).join('')||'<p class="muted">No separate gates were published.</p>';}
function evidence(s){return `<div class="detail-lower"><section class="panel evidence-panel"><h2>Predeclared gates</h2>${gates(s)}</section><section class="panel evidence-panel"><h2>Result source</h2><dl class="source-details"><dt>File</dt><dd>${esc(s.source||'Normalized research bundle')}</dd><dt>Recorded / UTC</dt><dd>${dateTime(s.created_at)}</dd><dt>Execution commit</dt><dd class="mono">${esc(s.commit||'Not published in the source')}</dd><dt>Interpretation</dt><dd>${esc(s.note||'See the original report')}</dd></dl>${btn('View source fingerprints','sources','code')}</section></div>`;}

function infrastructure(context='overview'){
  const d=state.data,a=d.acceptance||{}, publications=d.publications||[];
  return heading('Infrastructure',context==='experiments'?(d.research_authorized?'Equity research is enabled':'Equity research is not enabled'):'US equity & options','Reliable data comes before every research decision.',`${btn('Refresh evidence','refresh','refresh')}<button class="button primary" data-report="infrastructure">${icon('journal')} Delivery report</button>`)+
    `<div class="data-banner"><p>${esc(d.boundary)}</p><span>Read-only</span></div>
    <section class="stats-grid">${stat('Acceptance tests',fmt(a.tests_run,0),a.unit_tests==='passed'?'At infrastructure acceptance: passed':'Acceptance status unavailable')}${stat('Data providers',fmt(d.quality.length,0),'Sampled endpoints only')}${stat('Published reports',fmt(publications.filter(p=>p.kind==='markdown'&&p.status==='available').length,0),'Reviewed research publications')}${stat('Equity research',d.research_authorized?'Enabled':'Locked',d.research_authorized?'Options disabled; no live orders':'Research remains disabled','text-stat')}</section>
    <section class="panel desk-panel"><div class="eyebrow">PUBLISHED RESEARCH</div><h2>Reports &amp; evidence</h2><p>Read reviewed findings in their original form. Experiment charts appear when an explicit normalized dataset is connected.</p>${publicationList(publications)}</section>
    <div class="section-heading"><h2>Provider evidence</h2><span class="small muted">Connectivity is not historical completeness</span></div><div class="provider-grid">${d.quality.map(q=>`<section class="panel provider-card"><h2>${esc(q.name)}</h2><span class="badge ${q.status==='passed'?'success':'neutral'}">${esc(q.status==='passed'?'Sample checks passed':q.status)}</span><p>${esc(q.detail)}</p><span class="small mono muted">${dateTime(q.checked_at)} UTC</span></section>`).join('')}</div>
    <div class="detail-lower"><section class="panel research-note"><span class="eyebrow">ACCEPTANCE SCOPE</span><h2>Documented verification</h2><p>Acceptance uses ${esc(a.fixtures||'Not provided')}. Live connectivity is recorded separately. Neither establishes backtest-ready historical coverage.</p><span class="small mono muted">Accepted ${dateTime(a.checked_at_utc)} UTC</span></section><section class="panel research-note"><span class="eyebrow">SOURCE INTEGRITY</span><h2>Data and research stay separate</h2><p>Only sanitized verification records are exposed. Raw vendor data, credentials and research databases remain outside the file service.</p><button class="text-link" data-action="sources">Inspect source fingerprints ${icon('arrow')}</button></section></div>${warnings()}`;
}
function dataPage(){
  const d=state.data;
  return heading('Provenance','Data & evidence','Where the data comes from, and what it can tell you.',btn('Source fingerprints','sources','code')+`<a class="button" href="${navUrl('journal')}">Original reports</a>`)+
    `<div class="data-banner"><p>${esc(d.boundary)}</p><span>${d.sources.length} sources</span></div>
    <section class="panel"><div class="panel-head"><div><span class="eyebrow">PUBLISHED QUALITY CHECKS</span><h2>Quality records</h2></div><span class="small muted">Original check scope</span></div><div class="table-wrap"><table><thead><tr><th>Asset / source</th><th>Scope</th><th>Status</th><th>Published check summary</th></tr></thead><tbody>${d.quality.map(q=>`<tr><td class="mono symbol-cell">${esc(q.name)}</td><td>${esc(stageName(q.scope))}</td><td><span class="badge ${q.status==='passed'?'success':'warning'}">${q.status==='passed'?'Checks passed':esc(q.status)}</span></td><td class="muted">${esc(q.detail)}</td></tr>`).join('')||'<tr><td class="table-empty" colspan="4">No published quality checks</td></tr>'}</tbody></table></div></section>
    <section class="section-block"><div class="section-heading"><h2>Published source files</h2><span class="small muted">SHA-256 · Original bytes</span></div><div class="panel source-list">${d.sources.map(s=>`<div class="source-row">${icon('code')}<div><strong>${esc(s.path)}</strong><small class="mono">${esc(s.sha256)}</small></div><span class="mono muted">${fmt(s.bytes/1024,1)} KB</span></div>`).join('')}</div></section>${warnings()}`;
}
function journal(){
  return heading('Archive','Original reports','Reports registered for the selected project.')+
    `<section class="panel reports-panel">${state.data.reports.map(r=>`<button class="report-link" data-report="${esc(r.id)}"><span>${esc(r.name)}</span>${icon('arrow')}</button>`).join('')||'<p>No original reports registered.</p>'}</section>`;
}
function warnings(){return state.data.warnings.length?`<div class="source-warning">${icon('info')}<div><strong>${state.data.warnings.length} published sources unavailable</strong>${state.data.warnings.map(w=>`<p>${esc(w.source)}：${esc(w.message)}</p>`).join('')}</div></div>`:'';}

function bindInteractions(){
  enhanceSelects($('#app'));
  $('#feed-filters')?.addEventListener('toggle',event=>{feedFilters.filtersOpen=event.target.open;});
  $('#feed-search')?.addEventListener('input',event=>{feedFilters.query=event.target.value;feedFilters.limit=18;updateFeedResults();});
  $('#feed-outcome')?.addEventListener('change',event=>{feedFilters.outcome=event.target.value;feedFilters.limit=18;updateFeedResults();});
  $('#documentation-search')?.addEventListener('input',event=>{documentQuery=event.target.value;$('#documentation-index').innerHTML=documentationNavigation(documentationItems(documentationData),state.documentId,documentQuery);});
  $('#feed-lane')?.addEventListener('change',event=>{feedFilters.lane=event.target.value;feedFilters.limit=18;updateFeedResults();});
  $('#feed-sort')?.addEventListener('change',event=>{feedFilters.sort=event.target.value;feedFilters.limit=18;updateFeedResults();});
  $('#project-select')?.addEventListener('change',e=>{state.compare=[];state.filter='';state.status='all';location.hash=`#${state.page==='feed'?'feed':'overview'}?project=${encodeURIComponent(e.target.value)}`;});
  $('#chart-experiment')?.addEventListener('change',e=>{state.selected=e.target.value;state.stage=pickStage(currentExperiment())?.id;state.range=null;if(state.page==='experiment')navigate('experiment',`/${encodeURIComponent(state.selected)}`);else render();});
  const s=state.loading||state.error?null:currentStage();
  if(s){bindChart($('[data-chart="equity"]'),within(s.series,state.range),{benchmark:within(s.benchmark,state.range),currency:state.data.currency});bindChart($('[data-chart="drawdown"]'),within(drawdowns(s.series,s.initial_equity),state.range),{percent:true});}
  $('#experiment-search')?.addEventListener('input',e=>{state.filter=e.target.value;updateLibrary();});
  $('#status-filter')?.addEventListener('change',e=>{state.status=e.target.value;updateLibrary();});
  $('#sort-filter')?.addEventListener('change',e=>{state.sort=e.target.value;updateLibrary();});
  $('#trade-search')?.addEventListener('input',e=>{state.tradeQuery=e.target.value;state.tradePage=0;updateTrades();});
}
function updateLibrary(){$('#experiment-results').innerHTML=experimentTable(filteredExperiments(),true);}
function updateTrades(){const target=$('#trade-results');if(target&&currentStage())target.innerHTML=tradeTable(currentStage());}
function modal(content){$('#dialog-content').innerHTML=`<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Close">${icon('close')}</button>${content}`;if(!$('#detail-dialog').open)$('#detail-dialog').showModal();}
async function report(id,publication=false,brief=null){
  const owner=publication==='owner';
  const request=++reportId, project=state.project;
  modal('<div class="eyebrow">RESEARCH DOCUMENT</div><h2>Reading the original report…</h2>');
  try{
    const r=await api(owner?`/owner-reports/${encodeURIComponent(id)}`:publication?`/research/publications/${encodeURIComponent(id)}`:`/projects/${encodeURIComponent(project)}/reports/${encodeURIComponent(id)}`);
    if(request!==reportId||!$('#detail-dialog').open)return;
    reportDocument={...r,reports:r.reports||state.data?.reports||[],brief};
    modal(`<div class="eyebrow${owner?' owner-reader':''}">${owner?'OWNER REPORT':r.origin==='docs'?'PROJECT DOCUMENTATION':r.kind==='json'?'PUBLISHED JSON EVIDENCE':'ORIGINAL RESEARCH REPORT'}</div><h2>${esc(r.title)}</h2>
      ${brief?`<button class="text-link brief-back" data-feed-open="${esc(brief.id)}">${r.origin==='docs'?'Document overview':'Study overview'} ↗</button>${relatedEvidence(brief)}`:''}
      <details class="report-provenance"><summary>Source &amp; provenance <span>${esc(r.source.path)}</span></summary><div class="mono">SHA-256 ${esc(r.source.sha256)}</div></details>
      <div class="report-toolbar"><span>${owner?'Owner report · Public edition':r.origin==='docs'?'Project documentation · Current version':'Published research · Public edition'}</span><div class="report-view-toggle" role="group" aria-label="Report view"><button data-action="report-rendered" aria-pressed="true">Read</button><button data-action="report-source" aria-pressed="false">Source</button></div></div><article id="report-body" class="report-content markdown-body"></article>`);
    showReportView('rendered');
  }catch(error){if(request===reportId)modal(`<h2>Report unavailable</h2><p>${esc(error.message)}</p>`);}
}
function showReportView(view){
  const body=$('#report-body');if(!body||!reportDocument)return;
  body.className=view==='source'?'report-content raw-markdown':'report-content markdown-body';
  if(reportDocument.kind==='json'){body.className='report-content raw-markdown';body.textContent=view==='source'?reportDocument.content:JSON.stringify(JSON.parse(reportDocument.content),null,2);}
  else if(view==='source')body.textContent=reportDocument.content;
  else{mountReport(body,reportDocument.content,{sourcePath:reportDocument.source_path||reportDocument.source.path,reports:reportDocument.reports});const first=body.firstElementChild;if(first?.matches('h1')&&first.textContent.trim()===reportDocument.title.trim())first.classList.add('repeats-title');}
  document.querySelectorAll('.report-view-toggle button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.action===(view==='source'?'report-source':'report-rendered'))));

}
function sources(){modal(`<div class="eyebrow">SOURCE MANIFEST</div><h2>Source fingerprints</h2><p class="muted">Published files read in this snapshot. No raw prices or sealed samples are accessed.</p><div class="source-list">${state.data.sources.map(s=>`<div class="source-row"><div><strong>${esc(s.path)}</strong><small class="mono">${esc(s.sha256)}</small></div><span class="mono muted">${fmt(s.bytes/1024,1)} KB</span></div>`).join('')}</div>`);}
function compare(){
  const selected=state.data.experiments.filter(e=>state.compare.includes(e.id));
  if(selected.length<2)return toast('Select at least two experiments in the library.');
  const rows=[['Stage',s=>stageName(s.id)],['Outcome',s=>decision(s.decision)[0]],['Net return',s=>pct(s.metrics.total_return)],['Max drawdown',s=>pct(s.metrics.max_drawdown)],['Daily Sharpe',s=>fmt(s.metrics.sharpe)],['Trade records',s=>fmt(s.metrics.trades,0)],['Fees',s=>fmt(s.metrics.fees)]];
  modal(`<div class="eyebrow">COMPARE / ${selected.length} EXPERIMENTS</div><h2>Evidence, side by side</h2><p class="muted">Each experiment uses its preferred stage. Different periods and mechanisms; this is a comparison, not a ranking or pooled portfolio.</p><div class="table-wrap"><table class="compare-table"><thead><tr><th>Metric</th>${selected.map(e=>`<th>${esc(e.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn])=>`<tr><td>${label}</td>${selected.map(e=>`<td>${esc(pickStage(e)?fn(pickStage(e)):'—')}</td>`).join('')}</tr>`).join('')}<tr><td>Observation period</td>${selected.map(e=>{const s=pickStage(e);return `<td>${s?.series.length?`${date(s.series[0].t)}<br>${date(s.series.at(-1).t)}`:'No continuous NAV'}</td>`;}).join('')}</tr></tbody></table></div>`);
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportTrades(){const s=currentStage();if(!s)return;const rows=filterTrades(s.trades,state.range,state.tradeQuery);const columns=['symbol','entry','exit','status','pnl','fees'];download(`si-${state.project}-${state.selected}-${s.id}-trades.csv`,'\ufeff'+[columns.map(csvCell).join(','),...rows.map(t=>columns.map(k=>csvCell(k==='entry'||k==='exit'?dateTime(t[k]):t[k])).join(','))].join('\r\n'),'text/csv;charset=utf-8');toast(`Exported ${rows.length} trade records`);}
function openSearch(){
  $('#search-content').innerHTML=`<div class="search-input-wrap">${icon('search')}<input id="global-search" placeholder="Search experiments or original reports…" aria-label="Search experiments or original reports"><button class="key-button" data-action="close-search">Esc</button></div><div id="search-results"></div><div class="search-footer">Search the active project <span>↑ ↓ Navigate · Enter Open</span></div>`;
  $('#search-dialog').showModal();
  const input=$('#global-search');input.focus();input.addEventListener('input',()=>searchResults(input.value));searchResults('');
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();$('#search-results a, #search-results button')?.focus();}if(e.key==='Enter')$('#search-results a, #search-results button')?.click();});
}
function searchResults(query){
  const q=query.toLowerCase(),experiments=(state.data?.experiments||[]).filter(e=>`${e.name} ${e.english} ${e.hypothesis}`.toLowerCase().includes(q)),reports=(state.data?.reports||[]).filter(r=>r.name.toLowerCase().includes(q));
  $('#search-results').innerHTML=`<div class="search-group-label">Experiments</div>${experiments.map(e=>`<a href="${linkExperiment(e)}" class="search-result" data-action="close-search">${icon('experiments')}<div>${esc(e.name)}<small>${esc(e.english)}</small></div>${icon('arrow')}</a>`).join('')||'<p class="search-empty">No matching experiments</p>'}<div class="search-group-label">Reports</div>${reports.map(r=>`<button class="search-result" data-report="${esc(r.id)}">${icon('journal')}<span>${esc(r.name)}</span>${icon('arrow')}</button>`).join('')}`;
}

document.addEventListener('click',async event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();$('#main').focus();return;}
  const feedOpen=event.target.closest('[data-feed-open]');if(feedOpen){const item=feedData?.items.find(i=>i.id===feedOpen.dataset.feedOpen);if(item)report(item.id,true,item);return;}
  const save=event.target.closest('[data-feed-save]');if(save){const id=save.dataset.feedSave;savedNotes=savedNotes.includes(id)?savedNotes.filter(x=>x!==id):[...savedNotes,id];persist.set('si-saved-notes',JSON.stringify(savedNotes));const hadFocus=document.activeElement===save;render();if(hadFocus)[...document.querySelectorAll('[data-feed-save]')].find(b=>b.dataset.feedSave===id)?.focus();return;}
  const category=event.target.closest('[data-feed-category]');if(category){feedFilters.category=category.dataset.feedCategory;if(feedFilters.category==='owner')feedFilters.savedOnly=false;feedFilters.limit=18;render();return;}
  const anchor=event.target.closest('[data-doc-anchor]');if(anchor){document.getElementById(anchor.dataset.docAnchor)?.scrollIntoView({block:'start'});return;}
  const lane=event.target.closest('[data-feed-lane]');if(lane){feedFilters.lane=lane.dataset.feedLane;feedFilters.limit=18;render();return;}
  const stage=event.target.closest('[data-stage]');if(stage){state.stage=stage.dataset.stage;state.range=null;state.tradePage=0;render();return;}
  const tab=event.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;render();return;}
  const pub=event.target.closest('[data-publication]');if(pub){event.preventDefault();$('#search-dialog').close();if(pub.dataset.publication.startsWith('docs--')){$('#detail-dialog').close();navigate('documents','/'+encodeURIComponent(pub.dataset.publication));return;}report(pub.dataset.publication,true,$('#detail-dialog').open?reportDocument?.brief:null);return;}
  const rep=event.target.closest('[data-report]');if(rep){event.preventDefault();$('#search-dialog').close();report(rep.dataset.report);return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(!action)return;
  if(action==='documents-refresh'){documentationData=null;documentationError='';await loadDocumentation();return;}
  if(action==='document-read'||action==='document-source'){documentSource=action==='document-source';mountDocumentation();return;}
  if(action==='document-pdf'){await downloadDocumentPdf();return;}
  if(action==='feed-refresh'){archivePromise=null;if(!state.projects.length){try{state.projects=(await api('/projects')).projects;state.error=null;}catch(error){state.error=error.message;render();return;}}await loadFeed();return;}
  if(action==='feed-saved'){if(feedFilters.category==='owner')feedFilters.category='all';feedFilters.savedOnly=!feedFilters.savedOnly;feedFilters.limit=18;render();return;}
  if(action==='feed-export-mode'){feedFilters.exportMode=!feedFilters.exportMode;render();return;}
  if(action==='feed-select-all'){feedSelected=toggleAll(feedData,feedFilters,savedNotes,feedSelected);document.querySelectorAll('[data-feed-select]').forEach(box=>{box.checked=feedSelected.includes(box.dataset.feedSelect);});updateSelection();return;}
  if(action==='feed-select-clear'){feedSelected=[];document.querySelectorAll('[data-feed-select]').forEach(box=>{box.checked=false;});updateSelection();return;}
  if(action==='feed-pdf'){await downloadPdf();return;}
  if(action==='feed-reset'){feedFilters=defaultFeedFilters();render();return;}
  if(action==='feed-more'){feedFilters.limit+=18;updateFeedResults();return;}
  if(action==='research-refresh'){await loadResearch();return;}
  if(action==='refresh'){state.range=null;if(!state.projects.length){try{state.projects=(await api('/projects')).projects;}catch(error){state.error=error.message;render();return;}}await loadProject();if(!state.error)toast('Local research results refreshed');}
  if(action==='theme'){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;persist.set('si-theme',next);}
  if(action==='menu')$('.site-nav').classList.toggle('mobile-open');
  if(action==='search'){if(state.page==='feed'){($('#feed-search')||$('[data-feed-category="all"]'))?.focus();return;}if(state.page==='documents'){$('#documentation-search')?.focus();return;}openSearch();}
  if(action==='close-search')$('#search-dialog').close();
  if(action==='close-dialog'){$('#detail-dialog').close();reportId++;}
  if(action==='report-rendered')showReportView('rendered');
  if(action==='report-source')showReportView('source');
  if(action==='sources')sources();
  if(action==='compare')compare();
  if(action==='reset-range'){state.range=null;state.tradePage=0;render();}
  if(action==='prev-trades'){state.tradePage=Math.max(0,state.tradePage-1);updateTrades();}
  if(action==='next-trades'){state.tradePage++;updateTrades();}
  if(action==='trade-export')exportTrades();
  if(action==='export'){const e=currentExperiment();download(`si-${state.project}-${e.id}.json`,JSON.stringify({schema_version:'1.0',project:state.project,experiment:e,sources:state.data.sources},null,2),'application/json');toast('Experiment and source fingerprints exported');}
  if(action==='about')modal('<div class="eyebrow">DEADGUESS / RESEARCH WORKBENCH</div><h2>Where trading hypotheses go to die.</h2><p class="about-copy">Fieldnotes: published research reports and owner reviews.<br><br>Browse findings, save reports and export a reading selection.<br>Internal file references use descriptive names in this public edition.</p>');
});
document.addEventListener('change',event=>{if(event.target.matches('[data-feed-select]')){const id=event.target.dataset.feedSelect;feedSelected=event.target.checked?[...feedSelected,id]:feedSelected.filter(x=>x!==id);updateSelection();return;}if(event.target.matches('[data-compare]')){const id=event.target.dataset.compare;if(event.target.checked){if(state.compare.length>=4){event.target.checked=false;return toast('Compare up to four experiments at a time.');}state.compare.push(id);}else state.compare=state.compare.filter(x=>x!==id);if($('#compare-count'))$('#compare-count').textContent=state.compare.length;}});
document.addEventListener('chart-range',event=>{state.range=event.detail;state.tradePage=0;render();toast('Range selected. Trades and drawdown are linked.');});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(state.page==='feed')($('#feed-search')||$('[data-feed-category="all"]'))?.focus();else if(state.page==='documents')$('#documentation-search')?.focus();else if(!$('#search-dialog').open)openSearch();}if((event.key==='ArrowDown'||event.key==='ArrowUp')&&event.target.closest('#search-results')){event.preventDefault();const items=[...document.querySelectorAll('#search-results a,#search-results button')],index=items.indexOf(event.target.closest('a,button'));items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
window.addEventListener('hashchange',()=>{
  const withinDocs=state.page==='documents'&&/^#documents(?:[/?]|$)/.test(location.hash);
  route();
  if(!withinDocs)window.scrollTo(0,0);
});
if(!location.hash)state.page='feed';
try{const data=await api('/projects');state.projects=data.projects;await route();}catch(error){state.loading=false;state.error=error.message;render();}

async function loadDocumentation(){
  const request=++documentFetchId;
  documentError='';
  if(!documentData)render();
  const show=(value,error='')=>{
    if(request!==documentFetchId||state.page!=='documents')return;
    const y=window.scrollY, side=$('.documentation-sidebar');
    const scroll=side?.scrollTop||0;
    const focused=side?.contains(document.activeElement);
    documentData=value;documentError=error;documentSource=false;render();
    const next=$('.documentation-sidebar');
    if(next)next.scrollTop=scroll;
    if(focused)next?.querySelector('[aria-current="page"]')?.focus({preventScroll:true});
    window.scrollTo(0,y);
  };
  try{
    if(!documentationData)documentationData=await api('/documentation');
    if(request!==documentFetchId||state.page!=='documents')return;
    const entry=documentationItems(documentationData).find(row=>row.id===state.documentId);
    if(!entry){show(null,'This document is not in the project documentation library.');return;}
    const value=await api(`/research/publications/${encodeURIComponent(entry.id)}`);
    if(request!==documentFetchId||state.page!=='documents')return;
    show(value);
  }catch(error){
    if(request===documentFetchId&&state.page==='documents'){
      if(!documentationData)documentationError=error.message;
      show(null,error.message);
    }
  }
}
function mountDocumentation(){
  const body=$('#documentation-body');
  if(!body||!documentData)return;
  body.className=documentSource?'raw-markdown':'markdown-body';
  if(documentSource)body.textContent=documentData.content;
  else{
    mountReport(body,documentData.content,{sourcePath:documentData.source_path,reports:documentData.reports});
    if(body.firstElementChild?.matches('h1')&&body.firstElementChild.textContent.trim()===documentData.title.trim())body.firstElementChild.classList.add('repeats-title');
  }
  if($('#documentation-toc'))$('#documentation-toc').innerHTML=documentSource?'':documentOutline([...body.querySelectorAll('h2,h3')].map(node=>({id:node.id,title:node.textContent,level:Number(node.tagName.slice(1))})));
  document.querySelectorAll('[data-action="document-read"],[data-action="document-source"]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.action==='document-source')===documentSource)));
}
async function downloadDocumentPdf(){
  const item=documentationItems(documentationData).find(row=>row.id===state.documentId);
  const button=$('[data-action="document-pdf"]');
  if(!item||!documentData||button?.disabled)return;
  if(button){button.disabled=true;button.textContent='Preparing…';}
  try{
    const result=await buildPdf([item],{load:row=>api(`/research/publications/${encodeURIComponent(row.id)}/content`),label:()=> 'Project documentation'});
    download(result.name,result.blob,'application/pdf');
    toast(`${result.name} downloaded`);
  }catch(error){toast(`PDF failed: ${error.message}`);}
  if(button){button.disabled=false;button.textContent='Download PDF';}
}

function ownerReportsSection(){
  const groups=[['EQG','EQ Guesses'],['DAG','DA Guesses']];
  const lists=groups.map(([prefix,label])=>{
    const ids=(ownerIds||[]).filter(id=>id.startsWith(prefix));
    return `<section class="owner-group"><h3>${label} <small>${ids.length}</small></h3>
      ${ids.length?`<ul>${ids.map(id=>`<li><button type="button" data-owner-file="${esc(id)}">
        <strong>${esc(id)}</strong><span>Read report <span aria-hidden="true">↗</span></span>
      </button></li>`).join('')}</ul>`:'<p class="muted">No reports available.</p>'}
    </section>`;
  }).join('');
  return `<section id="owner-reports" class="panel owner-library" aria-labelledby="owner-heading">
    <header><div><h2 id="owner-heading">Owner Reports</h2><p class="muted" role="status">${esc(ownerMessage)}</p></div>
      <button class="button" id="owner-refresh">Refresh reports</button></header>
    ${ownerIds?.length?`<div class="owner-groups">${lists}</div>`:''}
  </section>`;
}
function bindOwnerReports(){
  const section=$('#owner-reports');
  $('#owner-refresh').addEventListener('click',()=>{archivePromise=null;loadOwnerReports();});
  if(ownerIds===null)loadOwnerReports();
  section.querySelectorAll('[data-owner-file]').forEach(button=>{
    button.addEventListener('click',()=>report(button.dataset.ownerFile,'owner'));
  });
}

async function loadOwnerReports(){
  if(ownerLoading)return;
  ownerLoading=true;
  ownerMessage='Loading owner reports…';
  const status=$('#owner-reports [role="status"]');
  if(status)status.textContent=ownerMessage;
  try{
    const {items}=await api('/owner-reports');
    ownerIds=items.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    ownerMessage=ownerIds.length?ownerIds.length+' owner reports available.':'No owner reports found.';
  }catch{
    ownerIds=[];
    ownerMessage='Unable to list owner reports.';
  }finally{
    ownerLoading=false;
    if(state.page==='feed')render();
  }
}
