// Mobile dropdown menu for admin
const fixMobileDropdown = function() {
  const btn = document.getElementById("menu-btn");
  const sidebar = document.getElementById("sidebar");
  if (!btn) return;
  
  let dropdown = document.querySelector(".mobile-dropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.className = "mobile-dropdown";
    document.body.appendChild(dropdown);
    
    const nav = document.createElement("nav");
    nav.className = "mobile-dropdown-nav";
    
    if (sidebar) {
      const sideLinks = sidebar.querySelectorAll(".side-nav a, .logout");
      sideLinks.forEach(link => {
        const a = document.createElement("a");
        a.href = link.href;
        if (link.id === "admin-logout") {
          a.href = "#";
          a.addEventListener("click", (e) => {
            e.preventDefault();
            if (window.AdminAuth) window.AdminAuth.logout();
          });
        }
        a.textContent = link.textContent;
        if (link.classList.contains("active")) a.classList.add("active");
        nav.appendChild(a);
      });
    }
    
    dropdown.appendChild(nav);
  }
  
  function toggleDropdown(e) {
    e.stopPropagation();
    dropdown.classList.toggle("active");
  }
  
  function closeDropdown() {
    dropdown.classList.remove("active");
  }
  
  btn.addEventListener("click", toggleDropdown);
  
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      closeDropdown();
    }
  });
  
  const dropdownLinks = dropdown.querySelectorAll("a");
  dropdownLinks.forEach(link => {
    if (link.id !== "admin-logout") {
      link.addEventListener("click", closeDropdown);
    }
  });
  
  window.addEventListener("resize", () => {
    if (window.innerWidth > 800) {
      closeDropdown();
    }
  });
};

document.addEventListener("DOMContentLoaded", function() {
  if (typeof fixMobileDropdown === "function") {
    fixMobileDropdown();
  }
});