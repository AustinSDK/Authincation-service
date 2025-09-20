/**
 * OAuth Applications Page JavaScript
 * Handles OAuth application deletion and modification actions
 */

/**
 * Delete an OAuth application with confirmation
 * @param {number} x - Application ID to delete
 */
async function _delete(x) {
    // Confirm deletion action
    if (!confirm("Are you sure you want to delete this OAuth application? This action cannot be undone.")) {
        return;
    }
    
    // Show loading state
    document.body.innerHTML = "Loading...";

    try {
        // Send delete request to server
        const response = await fetch("/oauth/delete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id: x })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log(result.message);
            // Redirect to OAuth applications page after successful deletion
            window.location.href = "/oauth";
        } else {
            // Show error message and reload page
            alert("Error: " + result.message);
            window.location.reload();
        }
    } catch (error) {
        // Handle network or other errors
        alert("Error deleting OAuth application");
        window.location.reload();
    }
}

/**
 * Navigate to OAuth application modification page
 * @param {number} x - Application ID to modify
 */
function _modify(x) {
    console.log('Modifying OAuth application ID:', x);
    // Show loading state
    document.body.innerHTML = "Loading...";
    // Navigate to modify page
    window.location.href = `/oauth/${x}`;
}