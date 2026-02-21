export default [
  {
    name: "All JS Chunks",
    path: ".next/static/chunks/**/*.js",
    limit: "900 KB",
    gzip: true,
    running: false,
  },
  {
    name: "CSS Bundle",
    path: ".next/static/chunks/*.css",
    limit: "150 KB",
    gzip: true,
    running: false,
  },
];
