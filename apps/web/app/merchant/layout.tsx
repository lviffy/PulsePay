import { MerchantProvider } from "@/components/merchant-provider";
export const metadata={title:"Merchant console"};
export default function Layout({children}:{children:React.ReactNode}){return <MerchantProvider>{children}</MerchantProvider>;}
