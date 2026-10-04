"""Export authorized daily ad reports for Ad Observatory.
Install: python -m pip install facebook-business
Set META_ACCESS_TOKEN, META_AD_ACCOUNT_ID (act_...), META_SINCE and META_UNTIL
in your local environment; never paste tokens into the dashboard.
Run: python meta-insights-export.py > insights.json
Required access: ads_read (or the account's applicable reporting permission).
Report scope: 7d click / 1d view, impression time, ad account timezone.
Large accounts may need shorter date ranges or the asynchronous Insights API.
"""
import json
import os
import sys
from datetime import date
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.adaccount import AdAccount


def main():
    required = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_SINCE', 'META_UNTIL']
    if any(not os.environ.get(key) for key in required):
        sys.exit('Set META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_SINCE and META_UNTIL.')
    since, until = os.environ['META_SINCE'], os.environ['META_UNTIL']
    if date.fromisoformat(since) > date.fromisoformat(until):
        sys.exit('META_SINCE must be on or before META_UNTIL.')
    FacebookAdsApi.init(access_token=os.environ['META_ACCESS_TOKEN'])
    account = AdAccount(os.environ['META_AD_ACCOUNT_ID'])
    metadata = account.api_get(fields=['currency', 'timezone_name'])
    cursor = account.get_insights(fields=[
        'account_id', 'ad_id', 'ad_name', 'account_currency', 'date_start', 'date_stop',
        'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'actions', 'action_values'
    ], params={
        'level': 'ad', 'time_increment': 1,
        'time_range': {'since': since, 'until': until},
        'action_attribution_windows': ['7d_click', '1d_view'],
        'action_report_time': 'impression', 'limit': 200
    })
    rows = [row.export_all_data() for row in cursor]
    json.dump({'scope': '7d click / 1d view · impression time · ' + metadata.get('timezone_name', 'account timezone'),
               'currency': metadata.get('currency'), 'data': rows}, sys.stdout, indent=2)


if __name__ == '__main__':
    main()
