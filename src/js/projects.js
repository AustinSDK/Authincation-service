async function _delete(x){
    document.body.innerHTML = "loading..."

    console.log(await (await fetch("/delete?id="+x)).text())

    window.location.href = "/projects"
}
function _modify(x){
    console.log(x)
    document.body.innerHTML = "loading..."
    window.location.href = `/project/${x}`
}