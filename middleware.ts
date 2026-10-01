import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";

export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});const path=request.nextUrl.pathname;
 // Machine-to-machine endpoints authenticate themselves with bearer secrets or webhook signatures.
 const machinePath=path.startsWith("/api/webhooks/")||path==="/api/campaigns/process"||path==="/api/campaigns/schedule"||path==="/api/automation/process";
 if(machinePath)return response;
 const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(cookies)=>{cookies.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const{data:{user}}=await supabase.auth.getUser();const isAuth=path.startsWith("/login")||path.startsWith("/auth");const publicPath=path.startsWith("/unsubscribe");
 if(!user&&!isAuth&&!publicPath)return NextResponse.redirect(new URL("/login",request.url));if(user&&path==="/login")return NextResponse.redirect(new URL("/dashboard",request.url));return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
