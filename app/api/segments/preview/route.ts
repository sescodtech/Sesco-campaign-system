import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { evaluateGroup } from "@/lib/segments/evaluator";
const rule=z.object({field:z.string().min(1),operator:z.enum(["equals","not_equals","contains","does_not_contain","greater_than","less_than","before","after","is_empty","is_not_empty","in","not_in"]),value:z.string().optional()});
const schema=z.object({operator:z.enum(["and","or"]),children:z.array(rule).max(20)});
export async function POST(request:Request){const context=await getCurrentContext();if(!context?.membership)return NextResponse.json({error:"Authentication required"},{status:401});const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Invalid segment rules"},{status:400});const supabase=await createClient();const orgId=context.membership.organization_id as string;const {data,error}=await supabase.from("contacts").select("id,full_name,email,phone,branch,customer_type,customer_status,account_type,relationship_manager,date_joined,last_transaction_date,balance_band,country,state,city,is_active").eq("organization_id",orgId).limit(5000);if(error)return NextResponse.json({error:error.message},{status:400});const matches=(data||[]).filter(c=>evaluateGroup(c as unknown as Record<string,unknown>,parsed.data));return NextResponse.json({count:matches.length,sample:matches.slice(0,10),limited:(data||[]).length===5000});}
