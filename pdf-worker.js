/* Lays out the PDF off the main thread. Functions cannot cross postMessage, so
   footers and table rules live here rather than in the definition from pdf.js. */
importScripts('./vendor/pdfmake.js','./vendor/vfs_fonts.js','./vendor/pdfmake-courier.js');

pdfMake.addTableLayouts({
  report:{
    hLineWidth:(i,node)=>i===0||i===1||i===node.table.body.length?.75:.4,
    vLineWidth:()=>0,
    hLineColor:(i,node)=>i===0||i===1||i===node.table.body.length?'#14161a':'#dcdde0',
    paddingLeft:i=>i===0?0:5,paddingRight:(i,node)=>i===node.table.widths.length-1?0:5,
    paddingTop:()=>3,paddingBottom:()=>3,
  },
  quote:{
    hLineWidth:()=>0,vLineWidth:i=>i===0?1.5:0,vLineColor:()=>'#1f3fc4',
    paddingLeft:()=>10,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0,
  },
  code:{
    hLineWidth:()=>0,vLineWidth:()=>0,
    paddingLeft:()=>8,paddingRight:()=>8,paddingTop:()=>6,paddingBottom:()=>6,
  },
});

self.onmessage=async({data:definition})=>{
  try{
    definition.footer=(page,count)=>({columns:[{text:'SI Research Workbench'},{text:`${page} / ${count}`,alignment:'right'}],fontSize:8,color:'#565b66',margin:[56,20,56,0]});
    // Keep a heading on the same page as the text it introduces.
    definition.pageBreakBefore=(node,container)=>Boolean(node.headlineLevel)&&container.getFollowingNodesOnPage().length===0;
    const buffer=await pdfMake.createPdf(definition).getBuffer();
    const bytes=Uint8Array.from(buffer);
    self.postMessage({buffer:bytes.buffer},[bytes.buffer]);
  }catch(error){self.postMessage({error:String(error?.message||error)});}
};
