import crypto from 'node:crypto';

/** Google I/O model only. Actual Code.gs performs all authorization, queue and upsert logic. */
export function installSheetHarness(context: any) {
  type Book = { id: string; name: string; cells: any[][]; metadata: Map<string,number>; maxRows: number; sharing: string; trashed: boolean; tabName: string; frozen: number; hidden: number; filter: boolean; formats: string[] };
  const books = new Map<string,Book>(), calls: string[] = [], triggers: any[] = [];
  let fault = '', creations = 0, duringWrite: (()=>void) | undefined;
  const originalFile = context.DriveApp.getFileById;
  context.DriveApp.Access = { PRIVATE:'private' }; context.DriveApp.Permission = { NONE:'none' };
  function file(book: Book): any {
    return { getId:()=>book.id,getName:()=>book.name,isTrashed:()=>book.trashed,getSharingAccess:()=>book.sharing,
      setSharing:(access:string)=>{book.sharing=access;},setName:(name:string)=>{book.name=name;} };
  }
  context.DriveApp.getFileById=(id:string)=>books.has(id)?file(books.get(id)!):originalFile(id);
  context.DriveApp.getFilesByName=(name:string)=>{const found=[...books.values()].filter(book=>book.name===name);let index=0;return{hasNext:()=>index<found.length,next:()=>file(found[index++])};};
  context.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:(name:string)=>({timeBased(){return this;},everyMinutes(){return this;},create(){const trigger={getHandlerFunction:()=>name};triggers.push(trigger);return trigger;}})};
  function spreadsheet(book: Book): any {
    function range(row:number,column:number,rows=1,columns=1): any {
      return {
        getValues:()=>Array.from({length:rows},(_,r)=>Array.from({length:columns},(_,c)=>book.cells[row+r-1]?.[column+c-1]??'')),
        getFormulas:()=>Array.from({length:rows},(_,r)=>Array.from({length:columns},(_,c)=>typeof book.cells[row+r-1]?.[column+c-1]==='string'&&book.cells[row+r-1][column+c-1].startsWith('=')?book.cells[row+r-1][column+c-1]:'')),
        setValues:(values:any[][])=>{calls.push('write');duringWrite?.();if(fault==='write-before')throw new Error('Injected Sheets timeout');for(let r=0;r<rows;r++){book.cells[row+r-1]??=[];for(let c=0;c<columns;c++)book.cells[row+r-1][column+c-1]=values[r][c];}if(fault==='write-after')throw new Error('Injected response lost after write');return range(row,column,rows,columns);},
        setValue:(value:any)=>{book.cells[row-1]??=[];book.cells[row-1][column-1]=value;return range(row,column);},
        setFontWeight:()=>range(row,column,rows,columns),setNumberFormat:(format:string)=>{book.formats.push(format);return range(row,column,rows,columns);},
        createFilter:()=>{book.filter=true;},addDeveloperMetadata:(_:string,id:string)=>{book.metadata.set(id,row);},
        getRow:()=>row,
      };
    }
    const tab={getRange:range,getSheetId:()=>7,getLastRow:()=>book.cells.reduce((last,row,index)=>row?.some(value=>value!=='')?index+1:last,0),getMaxRows:()=>book.maxRows,getMaxColumns:()=>26,
      insertRowsAfter:(_:number,count:number)=>{book.maxRows+=count;},setFrozenRows:(rows:number)=>{book.frozen=rows;},setColumnWidths:()=>{},setColumnWidth:()=>{},
      getFilter:()=>book.filter,hideColumns:(column:number)=>{book.hidden=column;},
      createDeveloperMetadataFinder:()=>{let id='';const finder={withKey(){return finder;},withValue(value:string){id=value;return finder;},find(){return book.metadata.has(id)?[{getLocation:()=>({getRow:()=>range(book.metadata.get(id)!,1)})}]:[];}};return finder;}};
    return{getId:()=>book.id,getName:()=>book.name,getSheets:()=>[tab],getSheetById:(id:number)=>id===7?tab:null,setSpreadsheetTimeZone:()=>{}};
  }
  context.SpreadsheetApp={
    create:(name:string)=>{calls.push('create');creations++;const book:Book={id:'sheet_'+crypto.randomUUID(),name,cells:[],metadata:new Map(),maxRows:1000,sharing:'private',trashed:false,tabName:'Sheet1',frozen:0,hidden:0,filter:false,formats:[]};books.set(book.id,book);if(fault==='create-after')throw new Error('Injected lost creation response');return spreadsheet(book);},
    openById:(id:string)=>{calls.push('open');const book=books.get(id);if(fault==='permission'||!book||book.trashed)throw new Error('Injected denied/deleted sheet');return spreadsheet(book);},
    flush:()=>{calls.push('flush');if(fault==='flush')throw new Error('Injected Sheets timeout');},
  };
  return{books,calls,triggers,get creations(){return creations;},fault(value:string){fault=value;},duringWrite(callback?:()=>void){duringWrite=callback;},book(){return [...books.values()][0];},
    deleteRow(index:number){const book=this.book();book.cells.splice(index-1,1);for(const[id,row]of book.metadata){if(row===index)book.metadata.delete(id);else if(row>index)book.metadata.set(id,row-1);}},
  };
}
