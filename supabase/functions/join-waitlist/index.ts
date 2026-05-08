import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Deno.serve is the modern (2026) built-in way to handle HTTP requests
Deno.serve(async (req) => {
  // 1. Handle Preflight CORS requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
        email, 
        phone, 
        gender, 
        target_gender, 
        referral_code, 
        referral_source, 
        turnstileToken 
    } = await req.json()

    // 2. Verify Turnstile Token with Cloudflare
    // This is the "Shield" that blocks the 535 bots from Japan
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: Deno.env.get('TURNSTILE_SECRET_KEY') || '',
        response: turnstileToken,
      }),
    })

    const verification = await verifyResponse.json()

    if (!verification.success) {
      console.error("Bot detected or invalid token:", verification)
      return new Response(JSON.stringify({ error: 'Security check failed. Please refresh and try again.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Connect to Supabase as an Admin
    // We use the Service Role Key to bypass RLS since the server is the trusted gatekeeper
    const supabaseAdmin = createClient(
		Deno.env.get('SUPABASE_URL') ?? '',
		Deno.env.get('SUPABASE_SECRET_DEFAULT_KEY') ?? ''
    );

    // 4. Insert into the 'waitlist' table
    const { error: insertError } = await supabaseAdmin
      .from('waitlist')
      .insert([{ 
          email, 
          phone, 
          gender, 
          target_gender, 
          referral_code, 
          referral_source 
      }])

    if (insertError) {
        // Log the error for you, but send a clean message to the user
        console.error("Database Insert Error:", insertError)
        return new Response(JSON.stringify({ error: insertError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // 5. Return Success
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})