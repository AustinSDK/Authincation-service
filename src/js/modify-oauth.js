/**
 * Modify OAuth Application Page JavaScript
 * Handles OAuth application update and deletion
 */

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('update-oauth-form');
    const deleteBtn = document.getElementById('delete-btn');
    
    // Handle form submission for updates
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {
                id: document.getElementById('application-id').value,
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
            submitButton.textContent = 'Updating...';
            submitButton.disabled = true;
            
            try {
                const response = await fetch('/oauth/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('OAuth application updated successfully!');
                    window.location.reload();
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                alert('Error updating OAuth application: ' + error.message);
            } finally {
                // Restore button state
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
    
    // Handle delete button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            if (!confirm('Are you sure you want to delete this OAuth application? This action cannot be undone.')) {
                return;
            }
            
            const applicationId = document.getElementById('application-id').value;
            
            // Show loading state
            const originalText = deleteBtn.textContent;
            deleteBtn.textContent = 'Deleting...';
            deleteBtn.disabled = true;
            
            try {
                const response = await fetch('/oauth/delete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ id: parseInt(applicationId) })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('OAuth application deleted successfully!');
                    window.location.href = '/oauth';
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                alert('Error deleting OAuth application: ' + error.message);
            } finally {
                // Restore button state
                deleteBtn.textContent = originalText;
                deleteBtn.disabled = false;
            }
        });
    }
});