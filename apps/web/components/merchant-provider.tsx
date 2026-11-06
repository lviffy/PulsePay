"use client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const theme=createTheme({fontFamily:"var(--font-space), sans-serif",fontFamilyMonospace:"var(--font-mono), monospace",primaryColor:"gray",defaultRadius:3,colors:{dark:["#f1efe7","#dbd9cf","#c3c1b5","#aaa89b","#818174","#626257","#41413a","#292925","#20201e","#191917"]},components:{Modal:{styles:{content:{background:"#20201e",border:"1px solid #77776b",boxShadow:"none"},header:{background:"#20201e"},title:{fontFamily:"var(--font-mono)",fontSize:12,textTransform:"uppercase"}}},Input:{styles:{input:{background:"transparent",borderColor:"#77776b",fontFamily:"var(--font-mono)",fontSize:12,color:"#f1efe7"}}},InputWrapper:{styles:{label:{fontFamily:"var(--font-mono)",fontSize:10,textTransform:"uppercase",marginBottom:8}}},Notification:{styles:{root:{background:"#292925",border:"1px solid #77776b",boxShadow:"none"},title:{color:"#f1efe7",fontFamily:"var(--font-mono)",fontSize:11},description:{color:"#d1cfc1",fontFamily:"var(--font-mono)",fontSize:11}}}}});
export function MerchantProvider({children}:{children:ReactNode}){return <MantineProvider theme={theme} forceColorScheme="dark"><Notifications position="bottom-right" zIndex={200}/>{children}</MantineProvider>;}
