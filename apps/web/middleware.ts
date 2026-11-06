import { NextResponse, type NextRequest } from "next/server";
export function middleware(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path.startsWith("/docs") && (request.headers.get("accept")?.includes("text/markdown")||path.endsWith(".md"))){const url=request.nextUrl.clone();url.pathname=path.replace(/^\/docs/,"/markdown").replace(/\.md$/,"");const response=NextResponse.rewrite(url);response.headers.set("Vary","Accept");return response;}
  const response=NextResponse.next();response.headers.set("Vary","Accept");return response;
}
export const config={matcher:["/docs/:path*"]};
