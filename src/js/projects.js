async function _delete(x){
    if (!confirm("Are you sure you want to delete this project?")) {
        return;
    }
    
    document.body.innerHTML = "loading..."

    try {
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
            window.location.href = "/projects";
        } else {
            alert("Error: " + result.message);
            window.location.reload();
        }
    } catch (error) {
        alert("Error deleting project");
        window.location.reload();
    }
}
function _modify(x){
    console.log(x)
    document.body.innerHTML = "loading..."
    window.location.href = `/project/${x}`
}