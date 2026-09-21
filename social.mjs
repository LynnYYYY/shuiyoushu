import {round} from './tax.mjs';

// Beijing ordinary employee estimates for calendar year 2026; bounds change in July.
export function estimateBeijing({salary,baseMode='estimate',socialBases=[0,0],fundBases=[0,0],fundRate=12,employerFundRate=12}){
 if(!Array.isArray(salary)||salary.length!==12||salary.some(n=>!Number.isFinite(n)||n<0))throw Error('工资数据必须为 12 个月的非负金额。');
 if(![0,5,6,7,8,9,10,11,12].includes(fundRate)||!(employerFundRate===null||[0,5,6,7,8,9,10,11,12].includes(employerFundRate)))throw Error('公积金比例不在普通缴存预设范围内。');
 if(!['estimate','actual'].includes(baseMode))throw Error('未知缴费基数模式。');
 if(baseMode==='actual'&&[...socialBases,...fundBases].some(n=>!Number.isFinite(n)||n<0))throw Error('缴费基数必须为非负金额。');
 const average=round(salary.reduce((a,b)=>a+b,0)/12),clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 return salary.map((_,i)=>{
  const half=i<6?0:1,low=half===0?7162:7270,high=half===0?35811:36348;
  const rawSocial=baseMode==='estimate'?average:socialBases[half],rawFund=baseMode==='estimate'?average:fundBases[half];
  // A zero wage does not imply no insurance: this preset assumes continuous employment.
  const socialBase=clamp(rawSocial,low,high),fundBase=clamp(rawFund,2540,high);
  const pension=round(socialBase*.08),medical=round(socialBase*.02+3),unemployment=round(socialBase*.005);
  const fund=Math.round(fundBase*fundRate/100),employerFund=employerFundRate===null?null:Math.round(fundBase*employerFundRate/100);
  return {month:i+1,socialBase,fundBase,rawSocial,rawFund,low,high,pension,medical,unemployment,fund,employerFund,total:round(pension+medical+unemployment+fund)};
 });
}

// Per-insurance local limits. Guangdong pension and unemployment use the
// latest verified schedule pending a newer published schedule; see policy notes.
export function estimateCity(config){
 const {city='beijing',medicalTier=1,supplementRate=0,employment}=config;
 if(city==='beijing')return estimateBeijing(config);
 if(!['shanghai','guangzhou','shenzhen'].includes(city))throw Error('此城市暂无自动预设。');
 // Reuse input validation, not Beijing amounts or limits.
 estimateBeijing(config);
 if(![1,2].includes(medicalTier))throw Error('请选择医保档次。');
 if(!Number.isInteger(supplementRate)||supplementRate<0||supplementRate>5)throw Error('补充公积金比例为 0–5%。');
 if(city==='shanghai'&&(![0,5,6,7].includes(config.fundRate)||!(config.employerFundRate===null||[0,5,6,7].includes(config.employerFundRate))))throw Error('上海基本公积金比例为 5–7%。');
 const avg=round(config.salary.reduce((a,b)=>a+b,0)/12),clamp=(x,l,h)=>Math.min(h,Math.max(l,x));
 return config.salary.map((_,i)=>{
  const half=i<6?0:1,month=i+1,rawSocial=config.baseMode==='actual'?config.socialBases[half]:avg,rawFund=config.baseMode==='actual'?config.fundBases[half]:avg;
  let pensionLow,pensionHigh,medicalLow,medicalHigh,unemploymentLow,unemploymentHigh,fundLow,fundHigh;
  if(city==='shanghai'){
   pensionLow=medicalLow=unemploymentLow=half?7546:7460;
   pensionHigh=medicalHigh=unemploymentHigh=fundHigh=half?37731:37302;
   fundLow=half?2740:2690;
  }else{
   pensionLow=city==='guangzhou'?5510:4775;pensionHigh=27549;
   medicalLow=city==='guangzhou'?6234:6727;medicalHigh=city==='guangzhou'?31170:33633;
   unemploymentLow=city==='guangzhou'?(month<9?2500:2680):(month<9?2520:2700);
   // Unemployment caps are retained at the last verified published amounts.
   unemploymentHigh=city==='guangzhou'?41112:44265;
   fundHigh=city==='guangzhou'?(half?41697:39828):(half?48471:44265);
   fundLow=city==='guangzhou'?(month<9?2500:2680):(half?2520:2360);
   if(city==='shenzhen'&&employment?.[i])fundLow=employment[i].start>=9?2700:2520;
  }
  const pensionBase=clamp(rawSocial,pensionLow,pensionHigh),medicalBase=clamp(rawSocial,medicalLow,medicalHigh),unemploymentBase=clamp(rawSocial,unemploymentLow,unemploymentHigh),fundBase=clamp(rawFund,fundLow,fundHigh);
  const medicalRate=city==='shenzhen'&&medicalTier===2?.005:.02,unemploymentRate=city==='shanghai'?.005:.002;
  const pension=round(pensionBase*.08),medical=round(medicalBase*medicalRate),unemployment=round(unemploymentBase*unemploymentRate);
  const supplemental=city==='shanghai'?Math.round(fundBase*supplementRate/100):0;
  const fund=Math.round(fundBase*config.fundRate/100)+supplemental,employerFund=config.employerFundRate===null?null:Math.round(fundBase*config.employerFundRate/100)+supplemental;
  return {month,socialBase:pensionBase,pensionBase,medicalBase,unemploymentBase,fundBase,rawSocial,rawFund,pensionLow,pensionHigh,medicalLow,medicalHigh,unemploymentLow,unemploymentHigh,fundLow,fundHigh,pension,medical,unemployment,fund,employerFund,total:round(pension+medical+unemployment+fund)};
 });
}
