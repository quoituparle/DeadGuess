import {Marked} from './vendor/marked.js';
import createDOMPurify from './vendor/dompurify.js';
import {esc} from './model.js';

const referenceBase='https://workbench.invalid/';

/** Relative files are references, never arbitrary routes into the workspace. */
export function resolveReportLink(href,{sourcePath='',reports=[]}={}){
  try{
    const url=new URL(href,new URL(sourcePath,referenceBase));
    if(!['https:','http:'].includes(url.protocol))return {kind:'blocked'};
    if(url.origin!==new URL(referenceBase).origin)return {kind:'external',href:url.href};
    const path=decodeURIComponent(url.pathname).slice(1);
    if(path===sourcePath&&url.hash)return {kind:'anchor',name:decodeURIComponent(url.hash.slice(1))};
    const report=reports.find(r=>r.path===path||r.paths?.includes(path));
    return report?(report.publication_id?{kind:'publication',id:report.publication_id}:{kind:'report',id:report.id}):{kind:'reference',path};
  }catch{return {kind:'blocked'};}
}

export function createReportRenderer(window){
  const purifier=createDOMPurify(window);
  const parser=new Marked({gfm:true,breaks:false,renderer:{
    html({text}){return esc(text);},
    image({text}){return `<span class="report-image-label">${esc(text||'Image reference')}</span>`;},
  }});
  return (source,context={})=>{
    const html=parser.parse(String(source).replace(/^[\u200B-\u200F\uFEFF]+/,''));
    const fragment=purifier.sanitize(html,{
      RETURN_DOM_FRAGMENT:true,
      ALLOWED_TAGS:['h1','h2','h3','h4','h5','h6','p','a','strong','em','del','code','pre','blockquote','table','thead','tbody','tr','th','td','ul','ol','li','hr','br','span','input'],
      ALLOWED_ATTR:['href','title','class','align','start','type','checked','disabled'],
      ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false,
    });
    const headings=new Map();
    fragment.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading,index)=>{
      const slug=heading.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,'-');
      heading.id=`report-section-${index}-${slug}`;
      if(!headings.has(slug))headings.set(slug,heading.id);
    });
    fragment.querySelectorAll('a').forEach(link=>{
      const result=resolveReportLink(link.getAttribute('href')||'',context);
      if(result.kind==='external'){
        link.href=result.href;link.target='_blank';link.rel='noopener noreferrer';
      }else if(result.kind==='publication'){
        link.href=`#publication-${result.id}`;link.dataset.publication=result.id;
      }else if(result.kind==='report'){
        link.href=`#report-${result.id}`;link.dataset.report=result.id;
      }else if(result.kind==='anchor'&&headings.has(result.name)){
        link.href=`#${headings.get(result.name)}`;link.dataset.reportAnchor=headings.get(result.name);
      }else{
        const reference=window.document.createElement('span');
        reference.className='artifact-reference';
        reference.title=result.kind==='reference'?`Source reference: ${result.path}. Not published in this reader.`:'This link is unavailable in the local reader.';
        reference.append(...link.childNodes);link.replaceWith(reference);
      }
    });
    fragment.querySelectorAll('table').forEach(table=>{
      const wrap=window.document.createElement('div');wrap.className='report-table-scroll';
      wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Report table; scroll horizontally if needed');
      table.replaceWith(wrap);wrap.append(table);
    });
    fragment.querySelectorAll('input').forEach(input=>{input.type='checkbox';input.disabled=true;});
    return fragment;
  };
}

let browserRenderer;
function onReportAnchor(event){
  const anchor=event.target.closest('[data-report-anchor]');
  if(anchor){event.preventDefault();event.currentTarget.querySelector(`#${CSS.escape(anchor.dataset.reportAnchor)}`)?.scrollIntoView({block:'start'});}
}
export function mountReport(element,source,context){
  browserRenderer ||= createReportRenderer(window);
  element.replaceChildren(browserRenderer(source,context));
  element.removeEventListener('click',onReportAnchor);
  element.addEventListener('click',onReportAnchor);
}
