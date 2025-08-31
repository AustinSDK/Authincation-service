/**
 * Projects Page JavaScript
 * Handles project deletion and modification actions
 */

/**
 * Delete a project with confirmation
 * @param {number} x - Project ID to delete
 */
async function _delete(x) {
    // Confirm deletion action
    if (!confirm("Are you sure you want to delete this project?")) {
        return;
    }
    
    // Show loading state
    document.body.innerHTML = "Loading...";

    try {
        // Send delete request to server
        const response = await fetch("/projects/delete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id: x })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log(result.message);
            // Redirect to projects page after successful deletion
            window.location.href = "/projects";
        } else {
            // Show error message and reload page
            alert("Error: " + result.message);
            window.location.reload();
        }
    } catch (error) {
        // Handle network or other errors
        alert("Error deleting project");
        window.location.reload();
    }
}

/**
 * Navigate to project modification page
 * @param {number} x - Project ID to modify
 */
function _modify(x) {
    console.log('Modifying project ID:', x);
    // Show loading state
    document.body.innerHTML = "Loading...";
    // Navigate to modify page
    window.location.href = `/project/${x}`;
}