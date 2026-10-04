"""Reproducible evidence audit. No network access and no edits to workspace records."""
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import statistics
from urllib.parse import urlsplit, parse_qs, unquote

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/research/pilot-data-audit'
CAPTURE = ROOT / 'docs/research/Malaysia-2026-10-04/collected-evidence.json'

def clean(s):
    return re.sub(r'\s+', ' ', str(s).replace('\u200b', '')).strip()

def calendar_age(start, as_of):
    delta = (dt.date.fromisoformat(as_of[:10])-dt.date.fromisoformat(start)).days
    if delta < 0:
        raise ValueError('Source start is after observation')
    return delta

def discount(price, compare):
    return round((compare-price)/compare*100, 2) if compare is not None and compare > price and compare > 0 else None

def field_paths(value, prefix=''):
    """Schema paths only: no user/session values or opaque tokens in endpoint catalog."""
    result=set()
    if isinstance(value,dict):
        for key,child in value.items():
            path=prefix+'.'+key if prefix else key
            result.add(path);result.update(field_paths(child,path))
    elif isinstance(value,list):
        for child in value: result.update(field_paths(child,prefix+'[]'))
    return sorted(result)

class MetaParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta = {}; self.canonical = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            key = a.get('property') or a.get('itemprop') or a.get('name')
            if key and 'content' in a:
                self.meta.setdefault(key, []).append(a['content'])
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')

def only(meta, key):
    values = set(meta.get(key, []))
    return next(iter(values)) if len(values) == 1 else None

def main():
    evidence = json.loads(CAPTURE.read_text())
    fetches = json.loads((OUT/'merchant-fetches.json').read_text())
    as_of = evidence['observed_at']
    checks, ads, products, sources, metrics = [], [], [], [], []
    def check(name, passed, detail):
        checks.append({'name':name, 'passed':bool(passed), 'detail':detail})
    def source(ident, title, url, kind, observed_at, note):
        sources.append(dict(id=ident, title=title, url=url, kind=kind, observed_at=observed_at, note=note))
    def cell(value=None, status='missing', note=''):
        return dict(value=value, status=status, note=note)
    def metric(ident, label, group, meaning, formula='', values=None, source_ids=None):
        metrics.append(dict(id=ident, label=label, group=group, meaning=meaning, formula=formula, values=values or {k:cell() for k in ['jobbie','graze']}, source_ids=source_ids or ['saved-meta']))
    source('saved-meta','Saved Meta pilot evidence','https://www.facebook.com/ads/library/','Saved capture',as_of,'13 sampled ad cards. Captured earlier; not refreshed in this audit. No claim of complete inventory.')
    source('meta-docs','Meta transparency field definitions','https://br-fr.facebook.com/ads/library/api/?source=archive-landing-page','Documentation',None,'Conditional fields depend on category and delivery region. Documentation is not a pilot result.')
    source('apify','Apify Ad Library collector','https://apify.com/apify/facebook-ads-scraper','Credential required',None,'Documented public-field collector. No authenticated pilot call made.')
    source('adyntel','Adyntel Meta API','https://docs.adyntel.com/ad-libraries/meta','Credential required',None,'POST api.adyntel.com/facebook accepts a domain or Facebook page. No authenticated pilot call made.')
    source('foreplay','Foreplay Public API','https://docs.foreplay.co/','Credential required',None,'Creative archives and provider-generated transcripts; no authenticated pilot call made.')
    source('pathmatics','Sensor Tower Pathmatics','https://sensortower.com/product/digital-advertising/pathmatics','Coverage unverified',None,'Modeled spend/impressions; these two companies and creative-to-Library-ID matching have not been verified.')
    source('insights','Meta Business SDK','https://github.com/facebook/facebook-python-business-sdk','Advertiser access required',None,'Actual reporting requires authorization to the relevant account.')
    source('post-data','Public post engagement schema','https://apify.com/apify/facebook-posts-scraper/output-schema','Not collected',None,'Requires an exact public-post match. No matched post or paid/organic separation in this pilot.')
    source('shopify','Shopify public Product API','https://shopify.dev/docs/api/ajax/reference/product','Documentation',None,'Product pricing is distinct from advertising cost or sales revenue.')
    names = {'jobbie':'JOBBIE Nut Butter','graze':"Amazin’ Graze Malaysia"}
    for company in names:
        capture = evidence[company]
        raw_by_id = {}
        for card in capture['raw_cards']:
            match = re.search(r'Library ID:\s*(\d+)', card['text'])
            if match: raw_by_id[match.group(1)] = card
        for imported in capture['import']:
            ident = imported['library_id']; card = raw_by_id.get(ident)
            check(f'{ident}: source card exists', card is not None, 'Matched by exact Library ID, not by list position.')
            if card is None: continue
            text = card['text']; match = re.search(r'Started running on (\d+ \w+ \d{4})',text)
            start = dt.datetime.strptime(match.group(1), '%d %b %Y').date().isoformat() if match else None
            status = 'Active' if re.search(r'^Active$',text,re.M) else 'Unknown'
            group_match = re.search(r'(\d+) ads use this creative and text',text)
            page_links = [l for l in card['links'] if urlsplit(l['href']).hostname == 'www.facebook.com']
            destinations = []
            for link in card['links']:
                parsed = urlsplit(link['href'])
                if parsed.hostname == 'l.facebook.com':
                    target = parse_qs(parsed.query).get('u',[None])[0]
                    if target and target not in destinations: destinations.append(target)
            images = list({urlsplit(i['src']).path:i['src'] for i in card['images'] if not i.get('alt')}.values())
            avatar = next((i['src'] for i in card['images'] if i.get('alt') in ['Jobbie Nut Butter',"Amazin' Graze"]),None)
            ctas = list(dict.fromkeys(b for b in card['buttons'] if b in ['Shop Now','Learn More','Sign Up','Send Message','Contact Us']))
            body = imported['body']; body_kind = 'Link description' if 'No primary body was displayed' in imported.get('notes','') else 'Primary copy'
            check(f'{ident}: source date',start == imported['start_date'],'Parsed date in raw card equals stored start date.')
            check(f'{ident}: copy evidence',clean(body) in clean(text),'Whitespace-normalized saved copy occurs in raw card text.')
            check(f'{ident}: source link identity',parse_qs(urlsplit(imported['source_url']).query).get('id') == [ident],'Library URL query ID equals source-card ID; live link availability not tested.')
            check(f'{ident}: activity evidence',status == imported['status'],'Status at capture only; does not prove current delivery.')
            ads.append(dict(id=ident,company=company,title=imported['title'],title_kind='Copy-derived title' if 'Title derived' in imported.get('notes','') else 'Displayed headline',body=body,body_kind=body_kind,format=imported['format'],format_basis='Collector classification; not a numeric delivery metric',status=status,start_date=start,age_days=calendar_age(start,as_of) if start else None,observed_at=as_of,source_url=imported['source_url'],page_url=page_links[0]['href'] if page_links else None,page_id=capture['page_id'],landing_urls=destinations,images=images,avatar_url=avatar,video_posters=[v['poster'] for v in card['videos'] if v.get('poster')],video_urls=[v['src'] for v in card['videos'] if v.get('src','').startswith('https://')],cta=ctas,multiple_versions=True if 'This ad has multiple versions' in text else None,group_count=int(group_match.group(1)) if group_match else None,platforms=None,spend=None,impressions=None,reach=None,paid_clicks=None,ctr=None,raw_text=text,raw_pointer=f'{company}.raw_cards[Library ID={ident}]',copy_characters=len(body),copy_words=len(body.split()),hashtags=list(dict.fromkeys(re.findall(r'#[\w]+',body))),utm={key:values[0] for u in destinations for key,values in parse_qs(urlsplit(u).query).items() if key.startswith('utm_')},offer_mentions=re.findall(r'RM\s?\d+(?:\.\d{1,2})?|\d+%',body)))
    check('Pilot IDs are unique', len({a['id'] for a in ads}) == len(ads), 'One normalized row per captured Library ID.')
    # Read verified response bodies. HTTP 200 alone never qualifies as a valid product API.
    fetched = {r['id']:r for r in fetches}
    for r in fetches:
        if r.get('file'):
            check(f"{r['id']}: response integrity",hashlib.sha256((OUT/r['file']).read_bytes()).hexdigest()==r['sha256'],'SHA-256 of saved response matches collection manifest.')
        source(r['id'],r['id'].replace('-',' ').title(),r['url'],'Live HTTP response',r['checked_at'],f"HTTP {r['status']}; {r.get('content_type','')}. {r.get('error') or ''}")
    for ident in ['graze-vanilla','graze-granola','graze-trial','jobbie-product']:
        r=fetched[ident]; content=(OUT/r['file']).read_text(); parser=MetaParser();parser.feed(content)
        if r['status'] != 200: continue
        if ident.startswith('graze'):
            api=fetched[ident+'-json']; d=json.loads((OUT/api['file']).read_text()); divisor=100
            currency=only(parser.meta,'product:price:currency')
            # This store repeats price metadata and incorrectly places MYR in one
            # amount tag. Require all numeric amount tags to agree, never coerce it.
            amounts={v for v in parser.meta.get('product:price:amount',[]) if re.fullmatch(r'\d+(?:\.\d+)?',v)}
            visible_price=next(iter(amounts)) if len(amounts)==1 else None
            price=d['price']/100
        else:
            offset=content.index('product: {',content.index('new EasyStore.OptionSelectors'))+9
            d,_=json.JSONDecoder().raw_decode(content[offset:]);divisor=100
            currency=only(parser.meta,'og:price:currency');visible_price=only(parser.meta,'og:price:amount');price=float(d['price'])
        check(f'{ident}: currency evidence',currency=='MYR','Currency explicitly present in merchant product-page metadata; not inferred from country.')
        check(f'{ident}: price cross-check',visible_price is not None and abs(float(visible_price)-price)<0.005,'Product data price agrees with numeric HTML price metadata. Graze also has a malformed MYR amount tag; it is excluded, not coerced to a number.')
        variants=[]
        for v in d.get('variants',[]):
            vp=float(v['price'])/divisor; vc=float(v['compare_at_price'])/divisor if v.get('compare_at_price') is not None else None
            variants.append(dict(id=str(v['id']),title=v['title'],sku=v.get('sku'),price=vp,compare_at_price=vc,discount_pct=discount(vp,vc),available=v.get('available'),reported_inventory=v.get('inventory_quantity')))
        reviews=only(parser.meta,'reviewCount');rating=only(parser.meta,'ratingValue')
        if rating is not None:check(f'{ident}: rating range',0<=float(rating)<=5,'Consistent duplicate metadata values and rating within 0–5. Merchant-declared; reviews not independently audited.')
        raw_images=d.get('images',[])
        product_images=[('https:'+i if i.startswith('//') else i) if isinstance(i,str) else i.get('src',i.get('img_url')) for i in raw_images]
        matching=[a['id'] for a in ads if any(urlsplit(u).path.rstrip('/')==urlsplit(r['url']).path.rstrip('/') for u in a['landing_urls'])]
        products.append(dict(id=ident,company=r['company'],title=d['title'],product_id=str(d['id']),url=r['url'],api_url=fetched[ident+'-json']['url'] if ident.startswith('graze') else None,source_id=ident,observed_at=r['checked_at'],currency=currency,price=price,available=d.get('available'),variants=variants,review_count=int(reviews) if reviews is not None else None,rating=float(rating) if rating is not None else None,images=product_images,product_type=d.get('type'),vendor=d.get('vendor'),created_at=d.get('created_at'),published_at=d.get('published_at'),matched_ads=matching,match_note='Exact ad destination path match' if matching else 'Company product example; not attributed to a saved ad'))

    def per_company(fn, status='calculated', note='Saved sample only; not full company inventory.'):
        return {k:cell(fn([a for a in ads if a['company']==k],k),status,note) for k in names}
    metric('saved_count','Captured ad IDs','Company','Distinct Library IDs in the saved sample.','count(distinct Library ID)',per_company(lambda aa,k:len(aa)))
    metric('approx_results','Approximate results shown by Meta','Company','Historical search-result label. Does not establish a complete inventory or number of unique creatives.','',per_company(lambda aa,k:evidence[k]['reported_approximate_results'],'saved'))
    metric('page_id','Advertiser Page ID','Company','Recovered from the saved collection context.','',per_company(lambda aa,k:evidence[k]['page_id'],'saved','Saved collection context; page identity not freshly rechecked.'))
    metric('profile_url','Advertiser profile URL','Company','Page linked in the original ad card.','',per_company(lambda aa,k:aa[0]['page_url'],'saved'))
    metric('oldest','Oldest captured ad age','Company','Calendar days since source start at the snapshot date.','max(observation date − source start date)',per_company(lambda aa,k:max(a['age_days'] for a in aa)))
    metric('median','Median captured ad age','Company','Middle age of captured ads, without weighting by spend.','median(observation date − source start date)',per_company(lambda aa,k:statistics.median(a['age_days'] for a in aa)))
    metric('starts','Source starts by date','Company','Counts captured IDs by source start date.','group captured IDs by start date',per_company(lambda aa,k:{day:sum(a['start_date']==day for a in aa) for day in sorted({a['start_date'] for a in aa})}))
    metric('active','Active at saved check','Company','Status seen at capture, not a live status today.','count(captured status = Active)',per_company(lambda aa,k:sum(a['status']=='Active' for a in aa)))
    metric('formats','Captured format mix','Company','Collector-classified image, video and carousel records.','count by saved format',per_company(lambda aa,k:{f:sum(a['format']==f for a in aa) for f in sorted({a['format'] for a in aa})}))
    metric('same_copy','Distinct normalized copy texts','Company','Whitespace differences removed. Same text can still have different media and delivery.','count(distinct whitespace-normalized saved copy)',per_company(lambda aa,k:len({clean(a['body']) for a in aa})))
    for ident,label,key,meaning in [
        ('library_id','Library ID','id','Identity of each captured Library record.'),
        ('source_link','Ad Library link','source_url','ID-to-link consistency checked; live URL loading was not tested.'),
        ('start_date','Source start date','start_date','Parsed from the saved source card.'),
        ('calendar_age','Calendar age at capture','age_days','Elapsed days; not measured paid runtime.'),
        ('copy','Saved ad copy','body','See each ad for full text and whether this is primary copy or link description.'),
        ('headline','Headline / display title','title','Copy-derived labels are identified separately from actual headlines.'),
        ('format','Captured creative format','format','Collector classification, checked against saved media presence.'),
        ('cta','CTA text','cta','Only explicitly captured buttons, such as Shop Now or Learn More.'),
        ('destination','Destination URLs','landing_urls','Decoded from captured outbound links; never inferred from a company domain.'),
        ('images','Captured creative image URLs','images','Profile images excluded and paths deduplicated. URL count is not guaranteed carousel-card count; availability not rechecked.'),
        ('posters','Video poster URLs','video_posters','Saved thumbnails only; these do not provide a playable video.'),
        ('versions','Multiple-versions label','multiple_versions','True only where the label is explicitly captured; absence means unknown.'),
        ('group','Ads using this creative/text label','group_count','Shown count for a group. Do not add repeated group labels together.'),
        ('utm','UTM tracking parameters','utm','Campaign labels in destination URLs; not traffic or conversion counts.'),
        ('hashtags','Hashtags','hashtags','Literal hashtags extracted from saved copy.'),
        ('offer','Advertised price / percentage text','offer_mentions','Literal offer claims in the copy, including conditions; not verified checkout prices.'),
        ('word_count','Saved copy word count','copy_words','Whitespace-separated tokens; link-description copy remains labeled as such.'),
        ('characters','Saved copy character count','copy_characters','Unicode code points in the saved copy, including whitespace.')]:
        metric(ident,label,'Ad evidence',meaning,'See per-ad evidence table',per_company(lambda aa,k,key=key: f"{sum(a[key] is not None and a[key] != [] and a[key] != {} and a[key] != '' for a in aa)}/{len(aa)} records",'saved' if ident not in ['calendar_age','hashtags','word_count','characters','utm','offer'] else 'calculated','Values are inspectable per ad below; a captured URL is not a verified working asset.'))
    missing = [
        ('spend','Actual ad/company spend','Spend & performance','Requires authorized advertiser reporting. No verified competitor spend in this sample.','insights'),
        ('estimated_spend','Externally estimated spend','Spend & performance','Pathmatics pilot coverage and creative matching need verification. No estimate retrieved.','pathmatics'),
        ('spend_range','Public spend range','Spend & performance','Conditional political/issue disclosure; not present in these commercial cards.','meta-docs'),
        ('daily_spend','Daily / weekly / monthly spend','Spend & performance','Needs dated spend records. A lifetime range cannot reconstruct daily budgets.','insights'),
        ('impressions','Paid impressions','Spend & performance','Not captured. Impression-sort position is not an impression count.','insights'),
        ('estimated_impressions','Externally estimated impressions','Spend & performance','Potential measurement-provider output; coverage untested.','pathmatics'),
        ('reach','Reached audience','Spend & performance','No regional or global reach captured for these ads. Reach and impressions differ.','meta-docs'),
        ('frequency','Frequency','Spend & performance','Impressions ÷ reach, using the same period and population; inputs missing.','insights'),
        ('clicks','Paid link clicks','Spend & performance','Requires advertiser reporting; public reactions are not paid link clicks.','insights'),
        ('ctr','Paid link CTR','Spend & performance','Paid link clicks ÷ impressions × 100; inputs missing.','insights'),
        ('cpc','Cost per paid link click','Spend & performance','Spend ÷ paid link clicks; inputs missing.','insights'),
        ('cpm','Cost per 1,000 impressions','Spend & performance','Spend ÷ impressions × 1,000; inputs missing.','insights'),
        ('lpv','Landing-page views','Spend & performance','Requires authorized measurement; destination URL does not reveal visits.','insights'),
        ('conversions','Purchases / leads / conversions','Spend & performance','No advertiser or store analytics supplied. Product stock and promotion counters do not establish conversions.','insights'),
        ('cvr','Conversion rate','Spend & performance','Conversions ÷ explicitly chosen visits or clicks × 100; inputs and attribution scope missing.','insights'),
        ('revenue','Attributed purchase value / ROAS','Spend & performance','ROAS = attributed purchase value ÷ spend. Neither input is available; product price is not revenue.','insights'),
        ('runtime','Actual paid delivery duration','Timing & completeness','Start date and Active label do not reveal pauses, budget exhaustion or continuous delivery.','meta-docs'),
        ('history','Daily observation history','Timing & completeness','Only one capture exists. Need repeated successful checks with collection gaps preserved.','apify'),
        ('creation','Ad creation / delivery stop date','Timing & completeness','Not retained in the saved source cards; missing is not an ongoing-delivery assertion.','meta-docs'),
        ('platforms','Publisher platforms','Creative completeness','Platform icons were not decoded by the earlier capture. No platform names can be verified from its text.','apify'),
        ('videos','Playable video URLs / duration','Creative completeness','Two Graze video posters exist, but no saved playable URL or duration.','apify'),
        ('all_versions','All variants and carousel-card mapping','Creative completeness','Captured image URLs do not establish a complete ordered card/variant mapping.','apify'),
        ('collation','Creative-group identifier','Creative completeness','Some group counts are visible; stable collation IDs were not collected.','apify'),
        ('language','Source-reported languages','Creative completeness','Can be collected where supplied; text-language inference must be labeled separately.','meta-docs'),
        ('transcript','Video transcript / OCR','Creative completeness','Provider-derived output, not a Meta performance metric; no transcription or OCR run in this audit.','foreplay'),
        ('post_url','Verified original post URL','Public engagement','Ad Library URL is available, but no underlying public post has been matched.','post-data'),
        ('reactions','Post reactions / comments / shares','Public engagement','Requires a verified post and visible counts; would include any organic response.','post-data'),
        ('views','Public video views','Public engagement','No visible view counts collected; view definitions can differ by source.','post-data'),
        ('velocity','Public engagement growth per day','Public engagement','(Later count − earlier count) ÷ elapsed days. Need two matching-post observations; not paid efficiency.','post-data'),
        ('regional_reach','EU / UK reach and demographics','Regional transparency','Conditional regional disclosure; no such data captured for the pilot. Never substitute it for Malaysian reach.','meta-docs'),
        ('targeting','Target ages / gender / locations','Regional transparency','Conditional UK/EU transparency fields; no verified targeting in this pilot.','meta-docs'),
        ('payers','Beneficiary / payer / funding disclaimer','Regional transparency','Depends on category/region. Not retrieved for these ads.','meta-docs'),
        ('page_context','Page verification / followers / history','Company context','Page-level context not captured, and would not measure the ad’s response.','apify'),
    ]
    for ident,label,group,meaning,src in missing:
        status='access' if src in ['insights','pathmatics','foreplay'] else 'missing'
        metric(ident,label,group,meaning,values={k:cell(None,status,meaning) for k in names},source_ids=[src])
    for ident,label,key,meaning in [
        ('product_price','Current product price','price','Merchant-listed MYR price. Product examples are not always direct ad destinations.'),
        ('product_available','Product availability','available','Merchant-declared availability at collection; not independently verified stock.'),
        ('product_variants','Product variants / SKU','variants','Variant-level prices and compare-at prices; compare matching variants only.'),
        ('product_reviews','Product review count','review_count','Merchant-published product review count, unrelated to ad clicks or purchases.'),
        ('product_rating','Product rating','rating','Merchant-published product rating, not an ad-performance score.'),
        ('product_images','Product image URLs','images','Product-page assets; do not substitute them for captured ad creatives.'),
        ('product_dates','Product published date','published_at','Product publication date is unrelated to ad launch.'),
    ]:
        vals={}
        for company in names:
            pp=[p for p in products if p['company']==company]
            valid=[p for p in pp if p[key] is not None]
            vals[company]=cell({p['title']:p[key] if key not in ['variants','images'] else len(p[key]) for p in valid} or None,'live' if valid else 'missing','Live merchant data; inspect exact product links and ad matching below.')
        metric(ident,label,'Merchant enrichment',meaning,values=vals,source_ids=['graze-vanilla','graze-granola','graze-trial','jobbie-product'])
    jp=json.loads((OUT/fetched['jobbie-promotions']['file']).read_text())
    promotions=[{k:p.get(k) for k in ['title','description','starts_at','ends_at','is_enabled','target_type','value_type','value','prerequisite_subtotal_range','usage_count']} for p in jp.get('data',{}).get('promotions',[])]
    jr=json.loads((OUT/fetched['jobbie-recommend']['file']).read_text())
    gr=json.loads((OUT/fetched['graze-recommend-json']['file']).read_text())
    metric('promotions','Public promotion rules','Merchant enrichment','Current public promotion endpoint. Its usage_count is an undocumented counter, not verified sales or ad conversions.',values={'jobbie':cell(promotions,'live'),'graze':cell(None,'missing','Conditional offer copy captured; checkout eligibility not tested.')},source_ids=['jobbie-promotions'])
    metric('recommendations','Recommended product IDs','Merchant enrichment','Merchant recommendation output, not sales ranking or campaign attribution.',values={'jobbie':cell(jr.get('product_ids'),'live'),'graze':cell([{'id':str(p['id']),'title':p['title']} for p in gr.get('products',[])],'live','Up to 8 related products requested; not a complete product catalog.')},source_ids=['jobbie-recommend','graze-recommend-json'])
    metric('product_discount','Variant compare-at discount','Merchant enrichment','Arithmetic comparison with the same variant’s reference price. Not an independently verified historical price or checkout discount.','(compare-at price − price) ÷ compare-at price × 100',values={k:cell([{'product':p['title'],'variant':v['title'],'discount_pct':v['discount_pct']} for p in products if p['company']==k for v in p['variants']],'calculated') for k in names},source_ids=['graze-vanilla-json','graze-granola-json','graze-trial-json','jobbie-product'])
    inventory=[{'product':p['title'],'variant':v['title'],'value':v['reported_inventory']} for p in products if p['company']=='jobbie' for v in p['variants'] if v['reported_inventory'] is not None]
    metric('inventory','Page-reported inventory counter','Merchant enrichment','A public page field. Not independently verified stock; changes can reflect restocking or edits, not just sales.',values={'jobbie':cell(inventory,'live'),'graze':cell(None,'missing')},source_ids=['jobbie-product'])
    endpoints=[]
    for r in fetches:
        json_data=None
        if r.get('file'):
            try: json_data=json.loads((OUT/r['file']).read_text())
            except ValueError: pass
        result='JSON returned' if isinstance(json_data,dict) else 'HTML returned'
        if r.get('error') or r['status']!=200:result='Request failed'
        if r['id']=='jobbie-product-json':result='Not a JSON API: HTML fallback'
        endpoints.append(dict(id=r['id'],company=r['company'],method='GET',url=r['url'],discovery='Public page script' if r['id'] in ['jobbie-promotions','jobbie-recommend','graze-recommend','graze-product-view'] else 'Ad destination / merchant product / documented product route',status=result,http_status=r['status'],content_type=r.get('content_type'),checked_at=r['checked_at'],fields=r.get('json_keys',[]),field_paths=field_paths(json_data),parameters=parse_qs(urlsplit(r['url']).query),auth='None; public read-only request, no cookies sent',evidence=r.get('file'),sha256=r.get('sha256'),note='HTTP status and actual response format checked; no browser network trace captured.'))
    for ident,url,method,note in [
        ('meta-live','https://www.facebook.com/ads/library/','Browser','Browser access explicitly denied; no fresh Meta request or workaround attempted.'),
        ('meta-archive','https://graph.facebook.com/<API_VERSION>/ads_archive','GET','Official conditional archive API; token not configured, pilot query not executed.'),
        ('meta-insights','https://graph.facebook.com/<API_VERSION>/act_<ACCOUNT_ID>/insights','GET','Advertiser authorization required. Not called.'),
        ('apify-api','https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs','POST','Collector run requires a token and may incur charges; not called.'),
        ('adyntel-api','https://api.adyntel.com/facebook','POST','Provider key required; not called.'),
        ('foreplay-api','https://public.api.foreplay.co/api/spyder/brands','GET','Provider key required; not called.'),
        ('pathmatics-api','https://sensortower.com/product/connect','Contract-specific','Delivery options documented; exact entitled endpoints and pilot coverage unverified.'),
        ('graze-beacon','https://www.amazingraze.com.my/api/collect','Not invoked','Telemetry receiver observed in HTML; sending events cannot retrieve competitor analytics.'),
        ('jobbie-cart','https://www.jobbienutbutter.com/cart.json','GET — not invoked','Anonymous/session cart contents, not store sales; excluded from collection.'),
        ('graze-cart-add','https://www.amazingraze.com.my/cart/add','POST — not invoked','Cart mutation observed in page scripts; irrelevant to competitor data and not called.'),
        ('graze-cart-change','https://www.amazingraze.com.my/cart/change','POST — not invoked','Cart mutation observed in page scripts; not called.'),
    ]:
        endpoints.append(dict(id=ident,company='all',method=method,url=url,discovery='Documented API' if ident not in ['graze-beacon','jobbie-cart','graze-cart-add','graze-cart-change','meta-live'] else 'Public script / access attempt',status='Blocked' if ident=='meta-live' else 'Not tested / excluded',http_status=None,content_type=None,checked_at=None,fields=[],evidence=None,sha256=None,note=note))
    output=dict(version=1,built_at=dt.datetime.now(dt.timezone.utc).isoformat(),meta_observed_at=as_of,companies=[dict(id=k,name=v) for k,v in names.items()],limitations=['Saved Meta sample: not a complete company inventory. Fresh Facebook browser access was denied.','Validation checks confirm extraction and consistency, not the truth of merchant claims or actual ad effectiveness.','No paid provider account or advertiser reporting connection was available. No actual or externally estimated spend obtained.','Endpoint inventory covers inspected pages and documented candidates, not every endpoint the businesses operate.'],metrics=metrics,ads=ads,products=products,promotions=promotions,endpoints=endpoints,sources=sources,checks=checks,input_sha256=hashlib.sha256(CAPTURE.read_bytes()).hexdigest())
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'audit.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
    print(json.dumps({'ads':len(ads),'metrics':len(metrics),'products':len(products),'endpoints':len(endpoints),'checks':len(checks),'failed':[c for c in checks if not c['passed']]}))
    if any(not c['passed'] for c in checks): raise SystemExit('Evidence validation failed; inspect audit.json')

if __name__=='__main__':main()
