import {sqliteTable,text,integer,real,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const companies=sqliteTable('companies',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),domain:text('domain').notNull().default(''),page_id:text('page_id').notNull().default(''),market:text('market').notNull().default('MY'),category:text('category').notNull().default(''),notes:text('notes').notNull().default(''),created_at:text('created_at').notNull()},t=>[index('companies_owner').on(t.owner)]);
export const ads=sqliteTable('ads',{id:text('id').primaryKey(),owner:text('owner').notNull(),company_id:text('company_id').notNull(),library_id:text('library_id'),title:text('title').notNull(),body:text('body').notNull().default(''),format:text('format').notNull().default('Image'),status:text('status').notNull().default('Unknown'),start_date:text('start_date').notNull().default(''),source_url:text('source_url').notNull().default(''),landing_url:text('landing_url').notNull().default(''),image_url:text('image_url').notNull().default(''),market:text('market').notNull().default('MY'),hook:text('hook').notNull().default(''),angle:text('angle').notNull().default(''),notes:text('notes').notNull().default(''),hypothesis:text('hypothesis').notNull().default(''),board:text('board').notNull().default(''),pinned:integer('pinned').notNull().default(0),reach:integer('reach'),spend:real('spend'),currency:text('currency').notNull().default('MYR'),metric_source:text('metric_source').notNull().default(''),frequency_low:real('frequency_low'),frequency_high:real('frequency_high'),cpm_low:real('cpm_low'),cpm_high:real('cpm_high'),first_seen:text('first_seen').notNull(),last_seen:text('last_seen').notNull()},t=>[index('ads_owner_company').on(t.owner,t.company_id),uniqueIndex('ads_owner_library').on(t.owner,t.library_id)]);
export const observations=sqliteTable('observations',{id:text('id').primaryKey(),owner:text('owner').notNull(),ad_id:text('ad_id').notNull(),status:text('status').notNull(),observed_at:text('observed_at').notNull(),source:text('source').notNull()},t=>[index('observations_owner_ad').on(t.owner,t.ad_id)]);
export const activity=sqliteTable('activity',{id:text('id').primaryKey(),owner:text('owner').notNull(),message:text('message').notNull(),created_at:text('created_at').notNull()},t=>[index('activity_owner_date').on(t.owner,t.created_at)]);

export const performance=sqliteTable('performance',{id:text('id').primaryKey(),owner:text('owner').notNull(),company_id:text('company_id').notNull(),account_id:text('account_id').notNull(),ad_id:text('ad_id').notNull(),ad_name:text('ad_name').notNull(),date:text('date').notNull(),currency:text('currency').notNull(),attribution:text('attribution').notNull(),source:text('source').notNull(),imported_at:text('imported_at').notNull(),spend:real('spend'),impressions:real('impressions'),reach:real('reach'),clicks:real('clicks'),link_clicks:real('link_clicks'),landing_page_views:real('landing_page_views'),add_to_cart:real('add_to_cart'),checkouts:real('checkouts'),purchases:real('purchases'),revenue:real('revenue'),leads:real('leads'),video_plays:real('video_plays')},t=>[index('performance_owner_company').on(t.owner,t.company_id),uniqueIndex('performance_daily_scope').on(t.owner,t.account_id,t.ad_id,t.date,t.currency,t.attribution)]);

export const analysisModels=sqliteTable('analysis_models',{id:text('id').primaryKey(),owner:text('owner').notNull(),company_id:text('company_id').notNull(),model_json:text('model_json').notNull(),updated_at:text('updated_at').notNull()},t=>[uniqueIndex('analysis_models_owner_company').on(t.owner,t.company_id)]);

export const metaConnections=sqliteTable('meta_connections',{
  owner:text('owner').primaryKey(),
  app_id:text('app_id').notNull(),
  account_id:text('account_id').notNull(),
  api_version:text('api_version').notNull(),
  encrypted_credentials:text('encrypted_credentials').notNull(),
  has_app_secret:integer('has_app_secret').notNull().default(0),
  revision:text('revision').notNull(),
  updated_at:text('updated_at').notNull(),
  tested_at:text('tested_at'),
  test_result:text('test_result'),
});
