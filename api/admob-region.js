export function GET(request) {
  const country = request.headers.get('x-vercel-ip-country');
  const region = process.env.VERCEL_ENV !== 'production' || !/^[A-Z]{2}$/.test(country ?? '')
    ? 'unknown' : country === 'US' ? 'US' : 'excluded';
  return Response.json({ region }, { headers: { 'Cache-Control': 'private, no-store' } });
}
