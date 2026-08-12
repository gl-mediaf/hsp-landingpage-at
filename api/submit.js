import crypto from 'crypto';

// ── Rate Limiting ──────────────────────────────────────────────
// Max 3 submissions per IP per hour. In-memory per Vercel instance.
const rateLimitMap = new Map();
const RATE_MAX = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();

  // Cleanup stale entries if map gets large
  if (rateLimitMap.size > 500) {
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.start > RATE_WINDOW_MS) rateLimitMap.delete(key);
    }
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

// ── Input Validation ───────────────────────────────────────────
function validate(body) {
  const { vorname, nachname, email, phone, motivation } = body || {};
  if (!vorname  || typeof vorname  !== 'string' || vorname.trim().length   < 1 || vorname.trim().length   > 100) return 'vorname';
  if (!nachname || typeof nachname !== 'string' || nachname.trim().length  < 1 || nachname.trim().length  > 100) return 'nachname';
  if (!email    || typeof email    !== 'string' || !email.includes('@')        || email.length             > 254) return 'email';
  if (!phone    || typeof phone    !== 'string' || phone.trim().length     < 5 || phone.trim().length      > 30)  return 'phone';
  if (!motivation || typeof motivation !== 'string' || motivation.trim().length < 1 || motivation.trim().length > 2000) return 'motivation';
  const { alter } = body;
  if (alter && (isNaN(Number(alter)) || Number(alter) < 16 || Number(alter) > 99)) return 'alter';
  return null;
}

// ── Helpers ────────────────────────────────────────────────────
function hash(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function sanitize(value, maxLen = 500) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

// ── Allowed origins ────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://starten.hsp-derjob.de',
  'https://hsp-landingpage.vercel.app',
];

// ── Handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Origin check — only accept requests from known domains
  const origin = req.headers['origin'] || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Honeypot — bots fill this, real users don't
  if (req.body?._hp) {
    return res.status(200).json({ ok: true }); // silent reject
  }

  // Validate required fields
  const invalid = validate(req.body);
  if (invalid) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const {
    vorname, nachname, alter,
    email, phone, erreichbarkeit,
    stadt, plz, land, motivation,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    fbclid, fbclid_ts, gclid, ScCid, ttclid, tiktok_event_id,
    ab_variant,
  } = req.body;

  const fields = {
    'Datum':      new Date().toISOString(),
    'Vorname':    sanitize(vorname, 100),
    'Nachname':   sanitize(nachname, 100),
    'Email':      sanitize(email, 254),
    'Phone':      sanitize(phone, 30),
    'Motivation': sanitize(motivation, 2000),
    'Stadt':      sanitize(stadt, 100),
    'PLZ':        sanitize(plz, 20),
    'Land':       sanitize(land, 100),
    'Status':     'Beworben',
  };

  if (erreichbarkeit) fields['Erreichbarkeit'] = sanitize(erreichbarkeit, 100);
  if (utm_source)     fields['Source']         = sanitize(utm_source, 200);
  if (utm_medium)     fields['Medium']         = sanitize(utm_medium, 200);
  if (utm_campaign)   fields['Campaign']       = sanitize(utm_campaign, 200);
  if (utm_content)    fields['Content']        = sanitize(utm_content, 200);
  if (utm_term)       fields['Zielgruppe']     = sanitize(utm_term, 200);
  if (fbclid)         fields['fbclid']         = sanitize(fbclid, 200);
  if (gclid)          fields['gclid']          = sanitize(gclid, 200);
  if (ScCid)          fields['Content'] = (fields['Content'] ? fields['Content'] + ' | ScCid:' : 'ScCid:') + sanitize(ScCid, 200);

  try {
    // Airtable
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/appnSlhPDnFbHZGnh/tblL8ttCgeBrPZ7fn`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );

    if (!airtableRes.ok) {
      const err = await airtableRes.text();
      console.error('Airtable error:', err);
      return res.status(500).json({ error: 'Airtable error' });
    }

    // Make Webhook
    if (process.env.MAKE_WEBHOOK_URL) {
      try {
        await fetch(process.env.MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              formName:  'hsp26 // Starten LP 🔴',
              field0:    sanitize(vorname, 100),
              field1:    sanitize(nachname, 100),
              field2:    sanitize(motivation, 2000),
              field3:    sanitize(email, 254),
              field4:    sanitize(phone, 30),
              field5:    sanitize(erreichbarkeit, 100),
              field6:    sanitize(alter, 10),
              field7:    sanitize(utm_medium, 200),
              field8:    sanitize(utm_source, 200),
              field9:    sanitize(utm_campaign, 200),
              field10:   sanitize(utm_term, 200),
              field11:   sanitize(utm_content, 200),
              field12:   sanitize(fbclid, 200),
              field13:   sanitize(gclid, 200),
              field14:   sanitize(land, 100),
              field15:   sanitize(stadt, 100),
              field16:   sanitize(plz, 20),
            },
          }),
        });
      } catch (makeErr) {
        console.error('Make webhook error:', makeErr);
      }
    }

    // Meta CAPI — Lead Event
    if (process.env.META_CAPI_TOKEN) {
      const pixelId = '1094687270905953';
      const eventTime = Math.floor(Date.now() / 1000);

      const userData = {};
      if (email)    { userData.em = hash(email); userData.external_id = hash(email); }
      if (phone)    userData.ph = hash(phone.replace(/\s+/g, ''));
      if (vorname)  userData.fn = hash(vorname);
      if (nachname) userData.ln = hash(nachname);
      if (stadt)    userData.ct = hash(stadt);
      if (plz)      userData.zp = hash(plz);
      if (land)     userData.country = hash(land);
      if (fbclid)   userData.fbc = `fb.1.${fbclid_ts || Date.now()}.${fbclid}`;

      const capiPayload = {
        data: [{
          event_name:       'Lead',
          event_time:       eventTime,
          event_source_url: 'https://starten.hsp-derjob.de/danke',
          action_source:    'website',
          user_data:        userData,
        }],
      };

      try {
        const capiRes = await fetch(
          `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${process.env.META_CAPI_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capiPayload),
          }
        );
        if (!capiRes.ok) {
          const err = await capiRes.text();
          console.error('Meta CAPI error:', err);
        }
      } catch (capiErr) {
        console.error('Meta CAPI exception:', capiErr);
      }
    }

    // TikTok Events API — CompleteRegistration (server-side)
    if (process.env.TIKTOK_ACCESS_TOKEN) {
      const ttPayload = {
        pixel_code:      'C29B5QNMU8Q03RAIFDR0',
        event_source:    'web',
        event_source_id: 'C29B5QNMU8Q03RAIFDR0',
        data: [{
          event:      'CompleteRegistration',
          event_time: Math.floor(Date.now() / 1000),
          event_id:   sanitize(tiktok_event_id, 100) || `hsp_server_${Date.now()}`,
          user: {
            ...(ttclid && { ttclid: sanitize(ttclid, 500) }),
            email:      hash(email),
            phone_number: hash(phone?.replace(/\s+/g, '')),
            ip:         ip !== 'unknown' ? ip : undefined,
            user_agent: req.headers['user-agent'] || '',
            locale:     'de-DE',
          },
          properties: {
            currency: 'EUR',
            value:    0,
            contents: [{ content_id: 'hsp_bewerbung', content_name: 'HSP Ferienjob Bewerbung' }],
          },
          page: {
            url:      'https://starten.hsp-derjob.de/danke',
            referrer: req.headers['referer'] || '',
          },
        }],
      };
      try {
        const ttRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Token': process.env.TIKTOK_ACCESS_TOKEN,
          },
          body: JSON.stringify(ttPayload),
        });
        if (!ttRes.ok) {
          console.error('TikTok Events API error:', await ttRes.text());
        }
      } catch (ttErr) {
        console.error('TikTok Events API exception:', ttErr);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Submit error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
