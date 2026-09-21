import {round} from './tax.mjs';
export function sideWithholding(amount,type='labor'){
 if(!Number.isFinite(amount)||amount<0||!['labor','writing','royalty'].includes(type))throw Error('副业收入或类别无效。');
 const base=Math.max(0,amount<=4000?amount-800:amount*.8);
 if(type==='writing')return round(base*.7*.2);
 if(type==='royalty')return round(base*.2);
 return round(base<=20000?base*.2:base<=50000?base*.3-2000:base*.4-7000);
}
export function estimateSide({labor=0,writing=0,royalty=0,schedule='spread'}){
 if(![labor,writing,royalty].every(n=>Number.isFinite(n)&&n>=0))throw Error('副业收入须为非负金额。');
 if(schedule!=='spread'&&(!Number.isInteger(Number(schedule))||Number(schedule)<0||Number(schedule)>11))throw Error('收款月份无效。');
 const allocate=n=>{if(schedule!=='spread'){const a=Array(12).fill(0);a[Number(schedule)]=n;return a;}const a=Array(12).fill(Math.floor(n*100/12)/100);a[11]=round(n-a[0]*11);return a;};
 const entries=[['labor',allocate(labor)],['writing',allocate(writing)],['royalty',allocate(royalty)]];
 return {sideGross:Array.from({length:12},(_,i)=>round(entries.reduce((a,[,v])=>a+v[i],0))),sidePaid:Array.from({length:12},(_,i)=>round(entries.reduce((a,[type,v])=>a+sideWithholding(v[i],type),0))),sideTaxable:round(labor*.8+writing*.56+royalty*.8)};
}
