import {FACILITIES,TASK_IDS,rewardRecords,balance,earned,spent} from '../construction/catalog.js';

// Read-only projection from the validated ledger. Earned IDs survive new rounds.
export function rewardBudget(bank,save){
 const available=balance(bank),all=rewardRecords({tasks:Object.fromEntries(TASK_IDS.map(id=>[id,3])),submitted:{1:true,2:true,3:true}});
 const remaining=Object.entries(all).filter(([id])=>!bank.awards[id]);
 const pending=Object.entries(rewardRecords(save)).filter(([id])=>!bank.awards[id]).reduce((n,[,r])=>n+r.amount,0);
 const facilities=FACILITIES.map(f=>({id:f.id,name:f.name,cost:f.cost,built:!!bank.purchases[f.id],gap:Math.max(0,f.cost-available)}));
 const toBuild=facilities.filter(f=>!f.built),cost=toBuild.reduce((n,f)=>n+f.cost,0);
 return {available,earned:earned(bank),spent:spent(bank),pending,remaining:remaining.reduce((n,[,r])=>n+r.amount,0),higherStars:remaining.filter(([id])=>/^task:.*:[23]$/.test(id)).length,shortfall:Math.max(0,cost-available),facilities};
}
