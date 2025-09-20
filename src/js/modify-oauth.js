/**
 * Modify OAuth Application Page JavaScript
 * Handles scope management and form submission for updating existing OAuth applications
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
const form = document.getElementById('modifyOAuthForm');
const submit = form.querySelector('input[type="submit"]');
const deleteBtn = document.getElementById('delete-btn');
const scopeInput = document.getElementById('scopeInput');
const scopeChips = document.getElementById('scopeChips');
const clearScopesBtn = document.getElementById('clearScopes');

// Application data from server (injected by EJS template)
let applicationId, existingScopes;

/**
 * Initialize the page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => { 
    submit.disabled = false;
    
    // Get application data from window object (set by EJS template)
    applicationId = window.applicationData?.id;
    existingScopes = window.applicationData?.scopes || [];
    
    // Initialize with existing scopes
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

// Initialize scopes from existing application data
function initializeScopes() {
    // Clear existing chips first
    scopeChips.innerHTML = '';
    
    // Add existing scopes as chips
    if (existingScopes && Array.isArray(existingScopes)) {
        existingScopes.forEach(scope => {
            if (scope && typeof scope === 'string') {
                addScope(scope);
            }
        });
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
        // Submit OAuth application update request
        const _fetch = await fetch('/oauth/update', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                id: applicationId,
                name, 
                description, 
                redirect_uris, 
                scopes 
            }) 
        });
        
        const response = await _fetch.json();
        
        if (_fetch.ok) {
            toToast('OAuth application updated successfully');
            // Redirect after short delay
            setTimeout(() => { 
                window.location.href = '/oauth'; 
            }, 800);
        } else {
            toToast(response.message || 'Failed to update OAuth application');
            submit.disabled = false;
        }
    } catch (err) {
        toToast('Error: ' + err.message);
        submit.disabled = false;
    }
});

/**
 * Delete Button Handler
 */
deleteBtn.addEventListener('click', async function() {
    if (!confirm('Are you sure you want to delete this OAuth application? This action cannot be undone and will invalidate all associated tokens.')) {
        return;
    }
    
    // Show loading state
    const originalText = deleteBtn.textContent;
    deleteBtn.textContent = 'Deleting...';
    deleteBtn.disabled = true;
    
    try {
        const _fetch = await fetch('/oauth/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: applicationId })
        });
        
        const response = await _fetch.json();
        
        if (_fetch.ok) {
            toToast('OAuth application deleted successfully');
            setTimeout(() => { 
                window.location.href = '/oauth'; 
            }, 800);
        } else {
            toToast(response.message || 'Failed to delete OAuth application');
        }
    } catch (error) {
        toToast('Error deleting OAuth application: ' + error.message);
    } finally {
        // Restore button state
        deleteBtn.textContent = originalText;
        deleteBtn.disabled = false;
    }
});