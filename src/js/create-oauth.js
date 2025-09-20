/**
 * Create OAuth Application Page JavaScript
 * Handles permission management and form submission for creating new OAuth applications
 */

// Toast notification utility function
function toToast(msg) {
    Toastify({ 
        text: msg, 
        duration: 3000, 
        gravity: 'top', 
        position: 'right', 
        style: { 
            background: 'rgb(212,56,56)', 
            color: '#fff' 
        } 
    }).showToast();
}

// DOM elements
const form = document.getElementById('createOAuthForm');
const submit = form.querySelector('input[type="submit"]');
const scopeInput = document.getElementById('scopeInput');
const scopeChips = document.getElementById('scopeChips');
const clearScopesBtn = document.getElementById('clearScopes');

/**
 * Initialize the page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => { 
    submit.disabled = false; 
    // Initialize with any existing scopes if this is an edit
    initializeScopes();
});

/**
 * Scope Management Functions
 */

// Get all current scopes as an array
function getScopes() {
    return Array.from(scopeChips.querySelectorAll('.chip')).map(c => c.dataset.value);
}

// Add a new scope chip
function addScope(raw) {
    const v = (raw || '').trim().toLowerCase();
    if (!v) return; 
    
    if (getScopes().includes(v)) {
        toToast('Scope already exists');
        return;
    }
    
    // Create scope chip element
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.value = v;
    chip.innerHTML = `<span>${v}</span><span class="x" aria-label="Remove">×</span>`;
    
    // Add click handler to remove chip
    chip.addEventListener('click', () => {
        chip.remove();
        updateScopesDisplay();
    });
    
    scopeChips.appendChild(chip);
    updateScopesDisplay();
}

// Initialize scopes from existing data (for edit scenarios)
function initializeScopes() {
    // Clear existing chips first
    scopeChips.innerHTML = '';
    
    // Parse any comma-separated scopes from the input field
    const inputValue = scopeInput.value.trim();
    if (inputValue) {
        const scopes = inputValue.split(',').map(s => s.trim()).filter(s => s.length > 0);
        scopes.forEach(scope => {
            if (scope) {
                addScope(scope);
            }
        });
        scopeInput.value = ''; // Clear the input after processing
    }
}

// Update accessibility attributes for screen readers
function updateScopesDisplay() {
    const scopes = getScopes();
    if (scopes.length === 0) {
        scopeChips.setAttribute('aria-label', 'No scopes added');
    } else {
        scopeChips.setAttribute('aria-label', `${scopes.length} scope${scopes.length === 1 ? '' : 's'}: ${scopes.join(', ')}`);
    }
}

/**
 * Event Listeners
 */

// Add scope when Enter key is pressed OR comma is typed
scopeInput.addEventListener('keydown', e => { 
    if (e.key === 'Enter' || e.key === ',') { 
        e.preventDefault(); 
        processScopeInput();
    }
});

// Add scope when user clicks away from input
scopeInput.addEventListener('blur', () => {
    if (scopeInput.value.trim()) {
        processScopeInput();
    }
});

// Process input for comma-separated scopes
function processScopeInput() {
    const inputValue = scopeInput.value.trim();
    if (!inputValue) return;
    
    // Split by commas and process each scope
    const scopes = inputValue.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    scopes.forEach(scope => {
        if (scope) {
            addScope(scope);
        }
    });
    
    scopeInput.value = ''; // Clear the input after processing
}

// Clear all scopes
clearScopesBtn.addEventListener('click', () => { 
    scopeChips.innerHTML = ''; 
    updateScopesDisplay();
});

/**
 * Form Submission Handler
 */
form.addEventListener('submit', async e => {
    e.preventDefault();
    submit.disabled = true;
    
    // Get form data
    const name = document.getElementById('t_name').value;
    const description = document.getElementById('t_description').value;
    const redirect_uris = document.getElementById('t_redirect_uris').value;
    const scopes = getScopes();
    
    // Validate required fields
    if (!name.trim()) { 
        toToast('Application name is required'); 
        submit.disabled = false; 
        return; 
    }
    
    if (!redirect_uris.trim()) {
        toToast('At least one redirect URI is required');
        submit.disabled = false;
        return;
    }
    
    try {
        // Submit OAuth application creation request
        const _fetch = await fetch('/oauth/create', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ name, description, redirect_uris, scopes }) 
        });
        
        const response = await _fetch.json();
        
        if (_fetch.ok) {
            toToast('OAuth application created successfully');
            // Redirect after short delay
            setTimeout(() => { 
                window.location.href = '/oauth'; 
            }, 800);
        } else {
            toToast(response.message || 'Failed to create OAuth application');
            submit.disabled = false;
        }
    } catch (err) {
        toToast('Error: ' + err.message);
        submit.disabled = false;
    }
});