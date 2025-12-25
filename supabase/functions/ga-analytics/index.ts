import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  period: '7' | '30' | '90' | 'custom';
  startDate?: string;
  endDate?: string;
}

interface GAMetric {
  name: string;
  value: string;
}

interface GADimension {
  name: string;
  value: string;
}

interface GARow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}

// Generate JWT for Google API authentication
async function generateJWT(clientEmail: string, privateKey: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Process the private key - handle both literal \n and actual newlines
  // Also handle keys that might be wrapped in quotes
  let processedKey = privateKey;
  
  // Remove surrounding quotes if present
  if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
    processedKey = processedKey.slice(1, -1);
  }
  
  // Replace literal \n with actual newlines
  processedKey = processedKey.replace(/\\n/g, '\n');
  
  console.log('Processing private key, starts with:', processedKey.substring(0, 30));
  
  // Extract the base64 content from the PEM format
  const pemContents = processedKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '');
  
  console.log('PEM contents length:', pemContents.length);
  
  // Decode base64 to binary
  const binaryString = atob(pemContents);
  const binaryKey = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    binaryKey[i] = binaryString.charCodeAt(i);
  }
  
  console.log('Binary key length:', binaryKey.length);
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

// Get access token from Google
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await generateJWT(clientEmail, privateKey);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token error:', error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch data from GA4 Data API
async function fetchGAData(
  propertyId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[]
): Promise<GARow[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  
  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(name => ({ name })),
    limit: 100,
  };

  console.log('Fetching GA data:', JSON.stringify(body));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('GA API error:', error);
    throw new Error(`GA API error: ${error}`);
  }

  const data = await response.json();
  return data.rows || [];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const propertyId = Deno.env.get('GA_PROPERTY_ID');
    const clientEmail = Deno.env.get('GA_CLIENT_EMAIL');
    const privateKey = Deno.env.get('GA_PRIVATE_KEY');

    if (!propertyId || !clientEmail || !privateKey) {
      console.error('Missing GA credentials');
      return new Response(
        JSON.stringify({ error: 'GA credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { period = '30', startDate: customStartDate, endDate: customEndDate }: AnalyticsRequest = await req.json();
    
    // Calculate date range
    let startDate: string;
    let endDate: string;
    
    if (period === 'custom' && customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
      console.log(`Fetching analytics for custom period: ${startDate} to ${endDate}`);
    } else {
      endDate = 'today';
      startDate = `${period}daysAgo`;
      console.log(`Fetching analytics for period: ${period} days`);
    }

    // Get access token
    const accessToken = await getAccessToken(clientEmail, privateKey);

    // Fetch different reports in parallel
    const [overviewData, dailyData, devicesData, sourcesData, pagesData] = await Promise.all([
      // Overview metrics
      fetchGAData(propertyId, accessToken, startDate, endDate, [], [
        'activeUsers',
        'sessions', 
        'screenPageViews',
        'bounceRate',
        'averageSessionDuration',
        'newUsers'
      ]),
      // Daily breakdown
      fetchGAData(propertyId, accessToken, startDate, endDate, ['date'], [
        'activeUsers',
        'sessions',
        'screenPageViews'
      ]),
      // Device categories
      fetchGAData(propertyId, accessToken, startDate, endDate, ['deviceCategory'], [
        'activeUsers'
      ]),
      // Traffic sources
      fetchGAData(propertyId, accessToken, startDate, endDate, ['sessionSource'], [
        'activeUsers',
        'sessions'
      ]),
      // Top pages
      fetchGAData(propertyId, accessToken, startDate, endDate, ['pagePath'], [
        'screenPageViews',
        'activeUsers'
      ])
    ]);

    // Process overview
    const overview = overviewData[0] ? {
      activeUsers: parseInt(overviewData[0].metricValues?.[0]?.value || '0'),
      sessions: parseInt(overviewData[0].metricValues?.[1]?.value || '0'),
      pageViews: parseInt(overviewData[0].metricValues?.[2]?.value || '0'),
      bounceRate: parseFloat(overviewData[0].metricValues?.[3]?.value || '0'),
      avgSessionDuration: parseFloat(overviewData[0].metricValues?.[4]?.value || '0'),
      newUsers: parseInt(overviewData[0].metricValues?.[5]?.value || '0'),
    } : {
      activeUsers: 0,
      sessions: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      newUsers: 0,
    };

    // Process daily data
    const daily = dailyData.map(row => ({
      date: row.dimensionValues?.[0]?.value || '',
      users: parseInt(row.metricValues?.[0]?.value || '0'),
      sessions: parseInt(row.metricValues?.[1]?.value || '0'),
      pageViews: parseInt(row.metricValues?.[2]?.value || '0'),
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Process devices
    const devices = devicesData.map(row => ({
      device: row.dimensionValues?.[0]?.value || 'unknown',
      users: parseInt(row.metricValues?.[0]?.value || '0'),
    }));

    // Process sources (top 10)
    const sources = sourcesData
      .map(row => ({
        source: row.dimensionValues?.[0]?.value || '(direct)',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 10);

    // Process pages (top 10)
    const pages = pagesData
      .map(row => ({
        path: row.dimensionValues?.[0]?.value || '/',
        views: parseInt(row.metricValues?.[0]?.value || '0'),
        users: parseInt(row.metricValues?.[1]?.value || '0'),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    console.log('Analytics fetched successfully');

    return new Response(
      JSON.stringify({
        overview,
        daily,
        devices,
        sources,
        pages,
        period,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics';
    console.error('Error fetching analytics:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
