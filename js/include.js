// include.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-include]").forEach(async el => {
    const file = el.getAttribute("data-include");
    if (!file) return;
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`Failed to load ${file}`);
      const content = await res.text();
      el.innerHTML = content;

      // Run any inline scripts
      el.querySelectorAll("script").forEach(oldScript => {
        const newScript = document.createElement("script");
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        document.body.appendChild(newScript);
      });
    } catch (err) {
      console.error(err);
      el.innerHTML = `<p style="color:red;">Error loading ${file}</p>`;
    }
  });

  // Optional: load alternate CSS if on /faculty
  if (window.location.pathname.startsWith('/faculty')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/faculty.css';
    document.head.appendChild(link);
  }
});