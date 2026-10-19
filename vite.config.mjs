// Construye la landing (landing.html → index.html) y el panel (admin.html → /admin)
export default {
  build: {
    target: "es2022",
    rollupOptions: { input: { index: "landing.html", admin: "admin.html" } },
  },
  plugins: [{
    name: "landing-como-index",
    enforce: "post",
    generateBundle(_, bundle) {
      if (bundle["landing.html"]) bundle["landing.html"].fileName = "index.html";
    },
  }],
};
