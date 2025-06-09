// NAV FETCHER
fetch('nav.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('nav-container').innerHTML = html;

    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
      hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
      });
    }
  });
//

// FOOTER FETCHER
fetch('/includes/footer.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('footer-container').innerHTML = html;
  });
//

document.addEventListener("DOMContentLoaded", () => {
  // Hamburger menu
  const menuToggle = document.getElementById("menu-toggle");
  const contactMenu = document.getElementById("contact-menu");

  if (menuToggle && contactMenu) {
    menuToggle.addEventListener("click", () => {
      contactMenu.classList.toggle("show");
    });
  }

  // Dark mode toggle
  const darkToggle = document.getElementById("manual-dark-toggle");
  darkToggle?.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
  });
});