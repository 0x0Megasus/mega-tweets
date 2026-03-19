import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import Sitemap from "vite-plugin-sitemap";
import { VitePWA } from "vite-plugin-pwa";

const siteUrl = "https://mega-novels-zhuu.vercel.app";
const staticRoutes = [
  "/",
  "/feed",
  "/groups",
  "/dm",
  "/people",
  "/notifications",
  "/profile",
];

export default defineConfig({
  plugins: [
    react(),
    Sitemap({
      hostname: siteUrl,
      dynamicRoutes: staticRoutes,
      generateRobotsTxt: false,
      readable: true,
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["app-icon.svg", "app-icon-192.png", "app-icon-512.png"],
      manifest: {
        name: "Mega Tweets",
        short_name: "MegaTweets",
        description: "Share tweets, chat in groups and DMs, and follow people on Mega Tweets.",
        theme_color: "#0e0f11",
        background_color: "#0e0f11",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webp,jpg,jpeg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "assets-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-firebase": ["firebase/app", "firebase/auth"],
          "vendor-icons": ["react-icons/fa"],
        },
      },
    },
  },
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
    proxy: {
      "/api": {
        target: "http://localhost:4041",
        changeOrigin: true,
      },
    },
  },
});
