export function showNotification(message, isError = false) {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.classList.remove("hidden");
    isError ? notification.classList.add("error") : notification.classList.remove("error");

    setTimeout(() => {
        notification.classList.add("hidden");
    }, 2000);
}
