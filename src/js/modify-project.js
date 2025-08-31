/**
 * Modify Project Page JavaScript
 * Handles permission management and form submission for updating existing projects
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
const form = document.getElementById('createProjectForm');
const submit = form.querySelector('input[type="submit"]');
const permInput = document.getElementById('permInput');
const permChips = document.getElementById('permChips');
const clearPermsBtn = document.getElementById('clearPerms');

// Project data from server (injected by EJS template)
let projectId, existingPermissions;

/**
 * Initialize the page when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => { 
    submit.disabled = false;
    submit.value = 'Update Project';
    
    // Get project data from window object (set by EJS template)
    projectId = window.projectData?.id;
    existingPermissions = window.projectData?.permissions || [];
    
    // Initialize with existing permissions
    initializePermissions();
});

/**
 * Permission Management Functions
 */

// Get all current permissions as an array
function getPerms() {
    return Array.from(permChips.querySelectorAll('.chip')).map(c => c.dataset.value);
}

// Add a new permission chip
function addPerm(raw) {
    const v = (raw || '').trim().toLowerCase();
    if (!v) return; 
    
    if (getPerms().includes(v)) {
        toToast('Permission already exists');
        return;
    }
    
    // Create permission chip element
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.value = v;
    chip.innerHTML = `<span>${v}</span><span class="x" aria-label="Remove">×</span>`;
    
    // Add click handler to remove chip
    chip.addEventListener('click', () => {
        chip.remove();
        updatePermissionsDisplay();
    });
    
    permChips.appendChild(chip);
    updatePermissionsDisplay();
}

// Initialize permissions from existing project data
function initializePermissions() {
    // Clear existing chips first
    permChips.innerHTML = '';
    
    // Add existing permissions as chips
    if (existingPermissions && Array.isArray(existingPermissions)) {
        existingPermissions.forEach(perm => {
            if (perm && typeof perm === 'string') {
                addPerm(perm);
            }
        });
    }
}

// Update accessibility attributes for screen readers
function updatePermissionsDisplay() {
    const perms = getPerms();
    if (perms.length === 0) {
        permChips.setAttribute('aria-label', 'No permissions added');
    } else {
        permChips.setAttribute('aria-label', `${perms.length} permission${perms.length === 1 ? '' : 's'}: ${perms.join(', ')}`);
    }
}

/**
 * Event Listeners
 */

// Add permission when Enter key is pressed OR comma is typed
permInput.addEventListener('keydown', e => { 
    if (e.key === 'Enter' || e.key === ',') { 
        e.preventDefault(); 
        processPermissionInput();
    }
});

// Add permission when user clicks away from input
permInput.addEventListener('blur', () => {
    if (permInput.value.trim()) {
        processPermissionInput();
    }
});

// Process input for comma-separated permissions
function processPermissionInput() {
    const inputValue = permInput.value.trim();
    if (!inputValue) return;
    
    // Split by commas and process each permission
    const permissions = inputValue.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    permissions.forEach(perm => {
        if (perm) {
            addPerm(perm);
        }
    });
    
    permInput.value = ''; // Clear the input after processing
}

// Clear all permissions
clearPermsBtn.addEventListener('click', () => { 
    permChips.innerHTML = ''; 
    updatePermissionsDisplay();
});

/**
 * Form Submission Handler
 */
form.addEventListener('submit', async e => {
    e.preventDefault();
    submit.disabled = true;
    
    // Get form data
    const name = document.getElementById('t_username').value;
    const description = document.getElementById('t_description').value;
    const link = document.getElementById('t_link').value || '/';
    const permissions = getPerms();
    
    // Validate required fields
    if (!name.trim()) { 
        toToast('Project name is required'); 
        submit.disabled = false; 
        return; 
    }
    
    try {
        // Submit project update request
        const _fetch = await fetch('/projects/update', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                id: projectId,
                name, 
                description, 
                link, 
                permissions 
            }) 
        });
        
        const response = await _fetch.json();
        
        if (_fetch.ok) {
            toToast('Project updated successfully');
            // Redirect after short delay
            setTimeout(() => { 
                window.location.href = '/projects'; 
            }, 800);
        } else {
            toToast(response.message || 'Failed to update project');
            submit.disabled = false;
        }
    } catch (err) {
        toToast('Error: ' + err.message);
        submit.disabled = false;
    }
});
