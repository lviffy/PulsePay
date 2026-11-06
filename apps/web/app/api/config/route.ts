import { publicConfig } from "@/lib/chain";
export function GET(){return Response.json(publicConfig(),{headers:{"Cache-Control":"no-store"}});}
