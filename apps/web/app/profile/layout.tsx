import type { ReactNode } from 'react';
import { pageMetadata } from '../../lib/seo';
export const metadata=pageMetadata("Your profile","Manage your Senku account, learning goals and invitation-only cloud access.","/profile",true);
export default function Layout({children}:{children:ReactNode}){return children;}
