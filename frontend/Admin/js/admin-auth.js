// Admin authentication utilities
// Checks for admin session, handles demo admin, protects admin pages

(function() {
  const ADMIN_SESSION_KEY = "adminSession";
  const CONFIG = {
    LOGIN_URL: "adminlogin.html",
    DEMO_CREDENTIALS: { adminId: "demo-admin", password: "Demo@1234" }
  };

  function getAdminSession() {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function checkAdminAuth() {
    if (window.location.pathname.indexOf("adminlogin.html") !== -1) {
      return;
    }

    const session = getAdminSession();
    if (!session || !session.loggedInAt) {
      window.location.href = CONFIG.LOGIN_URL;
      return;
    }

    if (session.isDemo) {
      return;
    }

    if (!session.token) {
      window.location.href = CONFIG.LOGIN_URL;
      return;
    }
  }

  function getAuthHeaders() {
    const session = getAdminSession();
    if (!session) return {};
    if (session.isDemo) {
      return { "X-Demo-Admin": "true" };
    }
    if (session.token) {
      return { "Authorization": "Bearer " + session.token };
    }
    return {};
  }

  function logoutAdmin() {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch (e) {}
    window.location.href = CONFIG.LOGIN_URL;
  }

  window.AdminAuth = {
    checkAuth: checkAdminAuth,
    getSession: getAdminSession,
    getHeaders: getAuthHeaders,
    logout: logoutAdmin
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAdminAuth);
  } else {
    checkAdminAuth();
  }
})();