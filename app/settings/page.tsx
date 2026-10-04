import type { Metadata } from 'next';
import Settings from './settings';

export const metadata: Metadata = { title: 'Connection settings · Ad Observatory', robots: { index: false, follow: false } };
export default function Page() { return <Settings/>; }
