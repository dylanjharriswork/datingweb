import supabase from './supabase.js';

// Elements
const waitlistForm = document.getElementById('waitlist-form');
const successState = document.getElementById('success-state');
const referralLinkInput = document.getElementById('referral-link');
const submitBtn = waitlistForm.querySelector('.btn-primary'); // Moved to outer scope
const legalCheckbox = document.getElementById('legal-checkbox');
const copyBtn = document.getElementById('copy-btn');
const copyStatus = document.getElementById('copy-status');

// Error Elements
const emailError = document.getElementById('email-error');
const emailCollisionError = document.getElementById('email-collision-error');
const phoneError = document.getElementById('phone-error');
const phoneCollisionError = document.getElementById('phone-collision-error');
const userGenderError = document.getElementById('user-gender-error');
const targetGenderError = document.getElementById('target-gender-error');
const legalError = document.getElementById('legal-error');

// Helpers
const generateReferralCode = (length = 6) => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    let code = '';
    for (let i = 0; i < length; i++) {
        code += alphabet[randomValues[i] % alphabet.length];
    }
    return code;
};

const getReferralFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref')?.toUpperCase() || null;
};

// Traditional function declaration (hoisted)
function resetBtn(originalText) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText || "Join the Waitlist";
}

// run immediately on load
window.addEventListener('DOMContentLoaded', () => {
    // 1. Handle persistence for existing signups
    const isSignedUp = localStorage.getItem('parity_signed_up');
    const savedLink = localStorage.getItem('parity_referral_link');

    if (isSignedUp === 'true' && savedLink) {
        waitlistForm.style.display = 'none';
        successState.style.display = 'block';
        referralLinkInput.value = savedLink;
        return; // Stop here if they're already done
    }

    // 2. Capture and save the referral code from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
        // Save it so it survives refreshes or navigation
        sessionStorage.setItem('parity_pending_ref', refCode.toUpperCase());
    }
});

// Submit Logic
waitlistForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Reset & Loading State
    [emailError, phoneError, userGenderError, targetGenderError, legalError].forEach(el => el.style.display = 'none');
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Joining...";

    const formData = new FormData(waitlistForm);
    const referredBy = sessionStorage.getItem('parity_pending_ref') || getReferralFromURL();// Check sessionStorage first, then URL as fallback
    
    // Turnstile Check
    const turnstileToken = formData.get('cf-turnstile-response');
    if (!turnstileToken) {
        alert("Please complete the security check.");
        resetBtn(originalText);
        return;
    }

    const email = formData.get('email')?.toLowerCase().trim();
    const phone = formData.get('phone')?.replace(/\D/g, '');
    const userGender = formData.get('user_gender');
    const targetGender = formData.get('target_gender');

    // Validation
    let hasError = false;
    if (!email?.endsWith('@unc.edu')) { emailError.style.display = 'block'; hasError = true; }
    if (phone?.length !== 10) { phoneError.style.display = 'block'; hasError = true; }
    if (!userGender) { userGenderError.style.display = 'block'; hasError = true; }
    if (!targetGender) { targetGenderError.style.display = 'block'; hasError = true; }
    if (!legalCheckbox.checked) { legalError.style.display = 'block'; hasError = true; }

    // FIXED: Guard clause correctly handles the return
    if (hasError) {
        resetBtn(originalText);
        return;
    }

    let success = false;
    let attempts = 0;
    let myNewCode = generateReferralCode();

    while (!success && attempts < 3) {
        try {
            const { error } = await supabase
                .from('waitlist')
                .insert([{ 
                    email, 
                    phone, 
                    gender: userGender, 
                    target_gender: targetGender,
                    referral_code: myNewCode, 
                    referral_source: referredBy          
                }]);

            if (error && error.code === '23505') {
                if (error.message.includes('referral_code')) {
                    myNewCode = generateReferralCode();
                    attempts++;
                    continue; 
                } 
                
                if (error.message.includes('email')) {
                    emailCollisionError.style.display = 'block';
                }
                if (error.message.includes('phone')) {
                    phoneCollisionError.style.display = 'block';
                }
                break;
            }

            if (error) throw error;

            // SUCCESS STATE
            success = true;
            const shareLink = `${window.location.origin}${window.location.pathname}?ref=${myNewCode}`;
            
            // Storage
            localStorage.setItem('parity_signed_up', 'true');
            localStorage.setItem('parity_referral_link', shareLink);

            // UI Update
            referralLinkInput.value = shareLink;
            waitlistForm.style.display = 'none';
            successState.style.display = 'block';

        } catch (err) {
            console.error("Critical Error:", err.message);
            alert("Something went wrong. Please try again later.");
            resetBtn(originalText);
            break; 
        }
    }
});

//copy button logic
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(referralLinkInput.value);
        copyStatus.style.display = 'block';
        setTimeout(() => { copyStatus.style.display = 'none'; }, 2000);
    } catch (err) {
        console.error('Failed to copy!', err);
    }
});