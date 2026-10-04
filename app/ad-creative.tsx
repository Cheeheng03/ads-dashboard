'use client';
import {useState} from 'react';
import {ExternalLink,ImageOff,Layers3,Play} from 'lucide-react';
import type {Ad} from './model';

export function adSource(ad:Ad){return ad.source_url||(ad.library_id?`https://www.facebook.com/ads/library/?id=${encodeURIComponent(ad.library_id)}`:'')}
export function AdSourceLinks({ad}:{ad:Ad}){
 const source=adSource(ad);
 return <div className="ad-source-actions">{source&&<a className="meta-source-link" href={source} target="_blank" rel="noreferrer"><ExternalLink size={15}/>View ad on Meta</a>}{ad.landing_url&&<a href={ad.landing_url} target="_blank" rel="noreferrer">Landing page <ExternalLink size={14}/></a>}</div>;
}
export function AdCreative({ad}:{ad:Ad}){
 return <CreativeImage key={ad.image_url} ad={ad}/>;
}
function CreativeImage({ad}:{ad:Ad}){
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
 const available=!!ad.image_url&&!failed,source=adSource(ad);
 const content=<><div className="creative-media-frame">{available?<><img loading="lazy" src={ad.image_url} alt={`Ad creative: ${ad.title}`} referrerPolicy="no-referrer" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>{!loaded&&<span className="creative-loading">Loading creative…</span>}</>:<div className="creative-fallback"><ImageOff size={28}/><strong>{failed?'Preview could not load':'No preview saved'}</strong><span>{source?'Open the original ad on Meta to see the creative.':'Add a source link and creative preview in Edit research.'}</span></div>}{available&&ad.format==='Video'&&<span className="creative-play"><Play size={24}/></span>}</div><span className="creative-media-caption">{ad.format==='Video'?<><Play size={14}/>Video thumbnail · watch on Meta</>:ad.format==='Carousel'?<><Layers3 size={14}/>Carousel cover · see all slides on Meta</>:<>Image preview{source?' · open original ad':''}</>}</span></>;
 return source?<a className="creative-media" href={source} target="_blank" rel="noreferrer" aria-label={`View creative on Meta: ${ad.title}`}>{content}</a>:<div className="creative-media">{content}</div>;
}

export function AdThumbnail({ad}:{ad:Ad}){return <ThumbnailImage key={ad.image_url} ad={ad}/>}
function ThumbnailImage({ad}:{ad:Ad}){
 const [failed,setFailed]=useState(false);
 return <span className="ad-thumbnail">{ad.image_url&&!failed?<img src={ad.image_url} alt={ad.title} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<ImageOff size={20} aria-label="No creative preview"/>}{ad.format==='Video'&&<Play size={12} className="thumbnail-video"/>}</span>;
}
