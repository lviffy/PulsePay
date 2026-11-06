import { Landing } from "@/components/landing";
import { getSourceFiles } from "@/lib/source";
export default async function Home() { const files=await getSourceFiles(); return <Landing files={files.map(file=>({path:file.path}))} initial={files.find(file=>file.path==="packages/sdk-react/examples/checkout-page.tsx")!}/>; }
