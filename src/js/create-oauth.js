/**
 * Create OAuth Application Page JavaScript
 * Handles OAuth application creation form submission
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('create-oauth-form');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                description: formData.get('description'),
                redirect_uris: formData.get('redirect_uris'),
                scopes: formData.get('scopes')
            };
            
            // Validate required fields
            if (!data.name || !data.name.trim()) {
                alert('Application name is required');
                return;
            }
            
            if (!data.redirect_uris || !data.redirect_uris.trim()) {
                alert('At least one redirect URI is required');
                return;
            }
            
            // Show loading state
            const submitButton = form.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Creating...';
            submitButton.disabled = true;
            
            try {
                const response = await fetch('/oauth/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('OAuth application created successfully!');
                    window.location.href = '/oauth';
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                alert('Error creating OAuth application: ' + error.message);
            } finally {
                // Restore button state
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});