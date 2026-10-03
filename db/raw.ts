import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Database is unavailable. Please try again.');return env.DB;}
