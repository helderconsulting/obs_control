import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html',
    }),
    files: {
      assets: 'client/static',
      lib: 'client/src/lib',
      routes: 'client/src/routes',
      appTemplate: 'client/src/app.html',
    },
  },
};

export default config;
