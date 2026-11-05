import {Marked} from './vendor/marked.js';

// Report Markdown becomes a pdfmake definition here; the layout runs in
// pdf-worker.js so a long export never freezes the page.
const markdown=new Marked({gfm:true,breaks:false});
const muted='#565b66', line='#dcdde0', accent='#1f3fc4', sunken='#f1f2f0';
const outcomeColors={negative:'#c02f27',data_blocked:'#94600a',execution_blocked:'#94600a',promising:'#0a7a52',historical_support:'#0a7a52',mixed:accent};
const contentWidth=483;

/** Roboto has no arrow and long hashes or paths need somewhere to wrap. */
export function cleanText(value){
  return String(value).replaceAll('→','->').replace(/\S{33,}/g,word=>word.replace(/([/_.\-:])/g,'$1​'));
}
/** Courier is a WinAnsi standard font, so anything outside it must be spelled out. */
export function cleanCode(value){
  return String(value).replaceAll('→','->').replaceAll('−','-').replaceAll('≥','>=').replaceAll('≤','<=').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”•…]/g,'?');
}

function inline(tokens=[],style={}){
  return tokens.flatMap(token=>{
    switch(token.type){
      case 'strong':return inline(token.tokens,{...style,bold:true});
      case 'em':return inline(token.tokens,{...style,italics:true});
      case 'del':return inline(token.tokens,{...style,decoration:'lineThrough'});
      case 'codespan':return [{...style,text:cleanCode(token.text),font:'Courier',fontSize:9}];
      case 'br':return [{text:'\n'}];
      case 'image':return [{...style,text:cleanText(token.text||'Image reference'),italics:true,color:muted}];
      case 'link':{
        const external=/^https?:\/\//i.test(token.href||'');
        return inline(token.tokens,external?{...style,link:token.href,color:accent,decoration:'underline'}:style);
      }
      default:return token.tokens?inline(token.tokens,style):[{...style,text:cleanText(token.text??token.raw??'')}];
    }
  });
}

function columnWidths(token){
  const length=cell=>Math.min(60,Math.max(6,cell.text.length));
  const weights=token.header.map((cell,i)=>Math.max(length(cell),...token.rows.map(row=>length(row[i]))));
  const total=weights.reduce((a,b)=>a+b,0);
  return weights.map(weight=>`${Math.round(weight/total*1000)/10}%`);
}

function block(token){
  switch(token.type){
    case 'heading':return {text:inline(token.tokens),style:`h${Math.min(token.depth,4)}`,headlineLevel:1};
    case 'paragraph':return {text:inline(token.tokens),margin:[0,0,0,7]};
    case 'text':return {text:token.tokens?inline(token.tokens):cleanText(token.text)};
    case 'list':{
      const items=token.items.map(item=>{
        const content=blocks(item.tokens);
        return item.task?{stack:[{text:item.checked?'[x]':'[ ]',fontSize:8,color:muted},...content]}:{stack:content};
      });
      return {[token.ordered?'ol':'ul']:items,...(token.ordered&&token.start>1?{start:token.start}:{}),margin:[0,0,0,7]};
    }
    case 'blockquote':return {table:{widths:['*'],body:[[{stack:blocks(token.tokens),color:muted}]]},layout:'quote',margin:[0,3,0,9]};
    case 'code':return {table:{widths:['*'],body:[[{text:cleanCode(token.text),font:'Courier',fontSize:8,lineHeight:1.2,preserveLeadingSpaces:true,fillColor:sunken}]]},layout:'code',margin:[0,3,0,9]};
    case 'table':return {table:{headerRows:1,dontBreakRows:true,widths:columnWidths(token),
      body:[token.header.map((cell,i)=>({text:inline(cell.tokens),bold:true,alignment:token.align[i]||'left'})),
        ...token.rows.map(row=>row.map((cell,i)=>({text:inline(cell.tokens),alignment:token.align[i]||'left'})))]},layout:'report',fontSize:8.5,lineHeight:1.2,margin:[0,4,0,11]};
    case 'hr':return {canvas:[{type:'line',x1:0,y1:0,x2:contentWidth,y2:0,lineWidth:.5,lineColor:line}],margin:[0,8,0,12]};
    case 'space':case 'def':return null;
    default:return {text:cleanText(token.text??token.raw??''),margin:[0,0,0,7]};
  }
}
function blocks(tokens){return tokens.map(block).filter(Boolean);}

/** Original wording, reflowed; a leading H1 that repeats the title is dropped. */
export function reportNodes(source,title=''){
  const tokens=markdown.lexer(String(source).replace(/^[​-‏﻿]+/,''));
  const first=tokens.findIndex(token=>token.type!=='space');
  if(tokens[first]?.type==='heading'&&tokens[first].depth===1&&tokens[first].text.trim()===String(title).trim())tokens.splice(first,1);
  return blocks(tokens);
}

const longDate=value=>{
  const date=new Date(value||'');
  return Number.isNaN(date.valueOf())?'Undated':date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
};

function articleNodes({item,content,source,outcomeLabel},index,toc){
  const number=item.id.match(/eq(\d+)/i)?.[1];
  const label=[number?`EQ${number}`:null,longDate(item.updated_at||item.created_at),item.lane_name||item.lane,`${item.reading_minutes||1} min read`].filter(Boolean).join('  ·  ');
  return [
    {text:cleanText(item.title),style:'title',...(index?{pageBreak:'before'}:{}),...(toc?{tocItem:true,tocMargin:[0,0,0,3]}:{outline:true})},
    {text:[{text:label,color:muted},{text:`  ·  ${outcomeLabel}`,color:outcomeColors[item.outcome]||muted,bold:true}],fontSize:9,margin:[0,0,0,3]},
    {text:cleanText(`${source?.source_path||item.original_path||item.path}  ·  SHA-256 ${source?.source?.sha256||item.sha256}`),fontSize:7,color:muted,margin:[0,0,0,5]},
    {canvas:[{type:'line',x1:0,y1:0,x2:contentWidth,y2:0,lineWidth:1,lineColor:'#14161a'}],margin:[0,0,0,12]},
    ...reportNodes(content,item.title),
  ];
}

export function documentDefinition(entries,{failed=[],now=new Date()}={}){
  const many=entries.length>1||failed.length>0;
  const title=many?`DeadGuess Fieldnotes — ${entries.length} ${entries.length===1?'study':'studies'}`:entries[0].item.title;
  const front=many?[
    {text:'DEADGUESS / RESEARCH WORKBENCH',fontSize:9,bold:true,color:accent,margin:[0,0,0,10]},
    {text:'Fieldnotes',fontSize:34,bold:true,margin:[0,0,0,6]},
    {text:`${entries.length} ${entries.length===1?'study':'studies'}  ·  Exported ${now.toISOString().slice(0,10)}  ·  Published research, public edition`,color:muted,margin:[0,0,0,26]},
    ...(failed.length?[{text:`${failed.length} selected ${failed.length===1?'study was':'studies were'} unavailable and left out`,bold:true,color:outcomeColors.negative,margin:[0,0,0,4]},{ul:failed.map(item=>cleanText(item.title)),color:muted,margin:[0,0,0,20]}]:[]),
    {toc:{title:{text:'Contents',style:'h2'},numberStyle:{color:muted},outlines:true}},
    {text:'',pageBreak:'after'},
  ]:[];
  return {
    pageSize:'A4',pageMargins:[56,54,56,54],
    info:{title,creator:'DeadGuess Research Workbench',producer:'DeadGuess Research Workbench'},
    defaultStyle:{font:'Roboto',fontSize:10,lineHeight:1.35,color:'#14161a'},
    styles:{
      title:{fontSize:19,bold:true,lineHeight:1.2,margin:[0,0,0,7]},
      h1:{fontSize:16,bold:true,lineHeight:1.2,margin:[0,14,0,6]},
      h2:{fontSize:13.5,bold:true,lineHeight:1.2,margin:[0,13,0,5]},
      h3:{fontSize:11,bold:true,lineHeight:1.2,margin:[0,10,0,4]},
      h4:{fontSize:10,bold:true,color:muted,margin:[0,8,0,3]},
    },
    content:[...front,...entries.flatMap((entry,index)=>articleNodes(entry,index,many))],
  };
}

export function pdfFileName(entries,now=new Date()){
  const stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  if(entries.length>1)return `DeadGuess-Fieldnotes-${entries.length}-studies-${stamp}.pdf`;
  const slug=String(entries[0]?.item.title||'report').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,80);
  return `${slug||'report'}-${stamp}.pdf`;
}

async function loadAll(items,load,onProgress,concurrency){
  const entries=new Array(items.length), failed=[];
  let next=0, done=0;
  const run=async()=>{
    while(next<items.length){
      const index=next++, item=items[index];
      try{entries[index]={item,...await load(item)};}catch{failed.push(item);}
      onProgress?.({stage:'reading',done:++done,total:items.length});
    }
  };
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},run));
  return {entries:entries.filter(Boolean),failed};
}

function renderInWorker(definition){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./pdf-worker.js', import.meta.url));
    const finish=result=>{worker.terminate();result();};
    worker.onmessage=({data})=>finish(()=>data.error?reject(new Error(data.error)):resolve(new Blob([data.buffer],{type:'application/pdf'})));
    worker.onerror=event=>finish(()=>reject(new Error(event.message||'The PDF worker could not start')));
    worker.postMessage(definition);
  });
}

/** `load` returns {content,source_path,source} and `label` names an outcome. */
export async function buildPdf(items,{load,label,onProgress,concurrency=4}){
  const {entries,failed}=await loadAll(items,load,onProgress,concurrency);
  if(!entries.length)throw new Error('None of the selected studies could be read');
  onProgress?.({stage:'composing',total:entries.length});
  const prepared=entries.map(entry=>({...entry,outcomeLabel:label(entry.item.outcome)}));
  return {blob:await renderInWorker(documentDefinition(prepared,{failed})),name:pdfFileName(prepared),failed,count:prepared.length};
}
