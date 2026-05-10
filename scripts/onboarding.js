/**
 * Parity Onboarding State Management
 */

// 1. INITIAL STATE
let currentStep = 1;
const totalSteps = 6;
let selectedCityData = null;

// The "Lazy" Draft Object
let draft = JSON.parse(localStorage.getItem('parity_draft')) || {
    currentStep: 1,
    email: '',
    answers: {
        gender: '',
        seeking: '',
        city: '',
        saturday: ''
    }
};

// 2. INITIALIZE ON LOAD
document.addEventListener('DOMContentLoaded', () => {
    // Restore state from local storage
    currentStep = draft.currentStep || 1;
    
    // Pre-fill inputs from draft
    if (draft.email) document.getElementById('email').value = draft.email;
    if (draft.answers.saturday) document.getElementById('saturday').value = draft.answers.saturday;
    if (draft.answers.city) {
        document.getElementById('city-input').value = draft.answers.city;
        selectedCityData = draft.answers.city;
    }
    
    // Pre-select radio buttons
    ['gender', 'seeking'].forEach(name => {
        if (draft.answers[name]) {
            const radio = document.querySelector(`input[name="${name}"][value="${draft.answers[name]}"]`);
            if (radio) radio.checked = true;
        }
    });

    updateUI();
});

// 3. GOOGLE PLACES AUTOCOMPLETE
function initAutocomplete() {
    const input = document.getElementById('city-input');
    if (!input) return;

    const options = {
        types: ['(cities)'],
        componentRestrictions: { country: "us" },
        fields: ['address_components']
    };

    const autocomplete = new google.maps.places.Autocomplete(input, options);

    input.addEventListener('input', () => {
        selectedCityData = null; // Invalidate the selection as soon as they change the text
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) {
            selectedCityData = null;
            return;
        }

        let city = "";
        let state = "";

        place.address_components.forEach(c => {
            if (c.types.includes("locality")) city = c.long_name;
            if (c.types.includes("administrative_area_level_1")) state = c.short_name;
        });

        selectedCityData = `${city}, ${state}`;
        saveState(); // Lazy save when data changes
    });
}

// 4. NAVIGATION & VALIDATION
async function validateAndNext(step) {
    const container = document.getElementById(`step-${step}`);
    const cityInput = document.getElementById('city-input');

    // STEP 4: The New "Smart" Validation
    if (step === 4) {
        const userInput = cityInput.value.trim();
        
        if (!userInput) {
            alert("Please enter a city.");
            return;
        }

        // 1. Show a "loading" state on the button
        const btn = container.querySelector('.btn-primary');
        const originalText = btn.innerText;
        btn.innerText = "Checking...";
        btn.disabled = true;

        try {
            // 2. Ask Google Geocoder to verify the text
            const geocoder = new google.maps.Geocoder();
            const response = await geocoder.geocode({ 
                address: userInput,
                componentRestrictions: { country: 'US' } 
            });

            const result = response.results[0];
            
            // 3. Check if Google found a "locality" (a city)
            const isCity = result.types.includes("locality") || 
                           result.types.includes("neighborhood") || 
                           result.types.includes("administrative_area_level_3");

            if (result && isCity) {
                // Extract clean City, State format
                let city = "";
                let state = "";
                result.address_components.forEach(c => {
                    if (c.types.includes("locality")) city = c.long_name;
                    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
                });

                selectedCityData = `${city}, ${state}`;
                cityInput.value = selectedCityData; // Update the UI to look official
                draft.answers.city = selectedCityData;
            } else {
                alert("We couldn't find that city. Please try being more specific (e.g., 'Durham, NC').");
                btn.innerText = originalText;
                btn.disabled = false;
                return; 
            }
        } catch (error) {
            console.error(error);
            alert("Location service error. Please try again.");
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        // Reset button for next time
        btn.innerText = originalText;
        btn.disabled = false;
    }

    // --- Standard Validation for other steps continues here ---
    let valid = true;
    const inputs = container.querySelectorAll('input, textarea');
    // ... (rest of your standard validation code)

    if (valid) {
        currentStep++;
        updateUI();
        saveState();
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateUI();
        saveState();
    }
}

// 5. UI SYNCING
function updateUI() {
    // Hide all steps, show current
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    const currentEl = document.getElementById(`step-${currentStep}`);
    if (currentEl) currentEl.classList.add('active');

    // Handle Back Button visibility
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.style.display = (currentStep > 1 && currentStep < 6) ? 'block' : 'none';
    }

    // Update Progress Bar
    const progress = (currentStep / totalSteps) * 100;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = `${progress}%`;
}

// 6. PERSISTENCE
function saveState() {
    draft.currentStep = currentStep;
    localStorage.setItem('parity_draft', JSON.stringify(draft));
}

// Global exposure for the Google callback
window.initAutocomplete = initAutocomplete;